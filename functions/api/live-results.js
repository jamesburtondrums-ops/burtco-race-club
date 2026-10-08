// Cloudflare Pages Function: same-origin, cached, credential-protected live result lookup.
// Configure RACING_API_USERNAME and RACING_API_PASSWORD in Pages production secrets.
// Exposes only results for today's published selections (never API credentials).
const normalize = value => String(value || '').toLowerCase()
  .replace(/\((ire|gb|fr|usa)\)/g, '').replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const nameOf = x => x?.horse || x?.horse_name || x?.name || '';
const courseOf = x => x?.course || x?.course_name || x?.venue || '';
const asResult = runner => {
  const raw = String(runner?.position ?? runner?.pos ?? runner?.finish_position ?? runner?.status ?? '').trim();
  const pos = /^\d+(st|nd|rd|th)?$/i.test(raw) ? Number.parseInt(raw, 10) : null;
  if (!pos && !/^(NR|PU|F|UR|BD|RO|RR|DSQ|DNF|REF|VOID)$/i.test(raw)) return null;
  return { ...(pos ? {position:pos,status:'Weighed in'} : {status:raw.toUpperCase()}),
    ...(runner?.sp ? {sp:String(runner.sp)} : {}) };
};
const json = (data, code=200) => new Response(JSON.stringify(data), {
  status:code, headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=30'}
});
export async function onRequestGet({request, env, waitUntil}) {
  if (!env.RACING_API_USERNAME || !env.RACING_API_PASSWORD)
    return json({connected:false,reason:'Live results API credentials are not configured.'});
  const cache = caches.default;
  const key = new Request(new URL('/api/live-results', request.url).toString());
  const cached = await cache.match(key);
  if (cached) return cached;
  const auth = 'Basic '+btoa(env.RACING_API_USERNAME+':'+env.RACING_API_PASSWORD);
  const headers = {'accept':'application/json','authorization':auth};
  try {
    let response = await fetch('https://api.theracingapi.com/v1/results/today?limit=100', {headers});
    let plan = 'Standard';
    if (response.status===401 || response.status===403) {
      response = await fetch('https://api.theracingapi.com/v1/results/today/free?limit=100', {headers});
      plan = 'Free';
    }
    if (!response.ok) return json({connected:false,reason:'Racing results feed returned HTTP '+response.status});
    const payload = await response.json();
    const results = Array.isArray(payload.results) ? payload.results : [];
    const page = await env.ASSETS.fetch(new Request(new URL('/data/races.json', request.url)));
    if (!page.ok) throw new Error('Selections unavailable');
    const data = await page.json();
    const selections = ['todaySelections','midshotsToday','longshotsToday']
      .flatMap(group => data[group] || []);
    const updates = [];
    for (const selection of selections) {
      const race = results.find(r =>
        (!r.date || r.date===data.snapshotDate) &&
        normalize(courseOf(r))===normalize(selection.course) &&
        Array.isArray(r.runners) && r.runners.some(h=>normalize(nameOf(h))===normalize(selection.horse))
      );
      if (!race) continue;
      const runner = race.runners.find(h=>normalize(nameOf(h))===normalize(selection.horse));
      const result = asResult(runner);
      if (!result) continue;
      const starterCount = race.runners.filter(h=>!/^(NR|non.?runner|withdrawn)$/i.test(String(h?.position||h?.status||''))).length;
      updates.push({horse:selection.horse,course:selection.course,time:selection.time,
        date:data.snapshotDate,result,runnerCount:Number(race.field_size)||starterCount});
    }
    const result = json({connected:true,source:'The Racing API ('+plan+')',
      checkedAt:new Date().toISOString(),date:data.snapshotDate,updates});
    waitUntil(cache.put(key,result.clone()));
    return result;
  } catch (err) {
    return json({connected:false,reason:'Live results temporarily unavailable.'});
  }
}