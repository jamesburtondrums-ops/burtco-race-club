import fs from 'node:fs/promises';

const file = new URL('../data/races.json', import.meta.url);
const data = JSON.parse(await fs.readFile(file, 'utf8'));
const now = new Date().toISOString();

const groups = ['todaySelections', 'midshotsToday', 'longshotsToday'];
const selections = groups.flatMap(group => (data[group] || []).map(selection => ({ group, selection })));

const normal = value => String(value || '')
  .toLowerCase()
  .replace(/\(ire\)|\(gb\)/g, '')
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const sameHorse = (a, b) => normal(a) === normal(b);
const sameCourse = (a, b) => {
  const x = normal(a), y = normal(b);
  return x === y || x.includes(y) || y.includes(x);
};

const listFrom = (payload, keys) => {
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return Array.isArray(payload) ? payload : [];
};

const runnersOf = race => {
  for (const key of ['runners', 'horses', 'entries', 'runner']) {
    if (Array.isArray(race?.[key])) return race[key];
  }
  return [];
};

const horseNameOf = runner => runner?.horse || runner?.horse_name || runner?.name || runner?.runner_name || '';
const courseOf = race => race?.course || race?.course_name || race?.venue || race?.track || '';

const fractionalFrom = odd => odd?.fractional || odd?.fractional_odds || odd?.price || odd?.odds || odd?.display;
const decimalFrom = odd => {
  const raw = odd?.decimal ?? odd?.decimal_odds ?? odd?.decimal_price;
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  const f = String(fractionalFrom(odd) || '').match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  return f ? Number(f[1]) / Number(f[2]) + 1 : null;
};

function bestOdds(runner) {
  const arrays = [runner?.odds, runner?.prices, runner?.bookmakers].filter(Array.isArray);
  const odds = arrays.flat();
  if (odds.length) {
    const candidates = odds
      .map(o => ({ text: fractionalFrom(o), decimal: decimalFrom(o), bookmaker: o?.bookmaker || o?.name || o?.firm }))
      .filter(o => o.text);
    if (candidates.length) {
      candidates.sort((a, b) => (b.decimal || 0) - (a.decimal || 0));
      return candidates[0];
    }
  }
  const text = runner?.odds || runner?.price || runner?.fractional || runner?.fractional_odds;
  return typeof text === 'string' ? { text, decimal: null, bookmaker: null } : null;
}

function resultForRunner(runner) {
  const rawPosition = runner?.position ?? runner?.pos ?? runner?.finish_position ?? runner?.placing ?? null;
  const casualty = runner?.casualty || runner?.outcome || runner?.status;
  const sp = runner?.sp || runner?.starting_price || runner?.startingPrice || null;
  let position = rawPosition;
  if (typeof position === 'string' && /^\d+$/.test(position)) position = Number(position);
  if (position === 0) position = null;
  if (position !== null && position !== undefined && position !== '') {
    return { position, status: 'Weighed in', sp, source: 'The Racing API', updatedAt: now };
  }
  if (casualty) {
    return { status: String(casualty), sp, source: 'The Racing API', updatedAt: now };
  }
  return null;
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers: { accept: 'application/json', ...headers } });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  return res.json();
}

let cards = [];
let results = [];
let feedName = '';

const customUrl = process.env.RACING_DATA_API_URL;
const customToken = process.env.RACING_DATA_API_TOKEN;
const apiUser = process.env.RACING_API_USERNAME;
const apiPass = process.env.RACING_API_PASSWORD;

if (customUrl) {
  const headers = customToken ? { authorization: `Bearer ${customToken}` } : {};
  const payload = await fetchJson(customUrl, headers);
  cards = listFrom(payload, ['racecards', 'races', 'meetings']);
  results = listFrom(payload, ['results', 'settled']);
  feedName = 'Configured racing feed';
} else if (apiUser && apiPass) {
  const auth = 'Basic ' + Buffer.from(`${apiUser}:${apiPass}`).toString('base64');
  const headers = { authorization: auth };
  // Account tiers differ: Standard provides SP and prices; Free provides positions.
  // Do not request 500 results: the official results endpoint caps limit at 100.
  async function firstAvailable(urls) {
    let last;
    for (const url of urls) {
      try { return { payload: await fetchJson(url, headers), endpoint: url }; }
      catch (err) {
        last = err;
        if (!/-> (401|403)\\b/.test(String(err))) throw err;
        console.log('Feed tier lacks access to '+url.split('?')[0]+'; trying next tier');
      }
    }
    throw last;
  }
  const resultResponse = await firstAvailable([
    'https://api.theracingapi.com/v1/results/today?limit=100',
    'https://api.theracingapi.com/v1/results/today/free?limit=100'
  ]);
  results = listFrom(resultResponse.payload, ['results', 'races']);
  // Prices are optional. Results must still work if only the Free plan is enabled.
  try {
    const cardResponse = await firstAvailable([
      'https://api.theracingapi.com/v1/racecards/standard?day=today&limit=100',
      'https://api.theracingapi.com/v1/racecards/free?day=today&limit=100'
    ]);
    cards = listFrom(cardResponse.payload, ['racecards', 'races']);
  } catch (err) {
    console.warn('Racecards unavailable; results will still update: '+String(err));
  }
  feedName = 'The Racing API ('+(resultResponse.endpoint.includes('/free')?'Free':'Standard')+')';
} else {
  console.log('No live racing feed credentials configured. Add RACING_API_USERNAME + RACING_API_PASSWORD, or RACING_DATA_API_URL.');
  process.exit(0);
}

const flattenMeetings = items => items.flatMap(item => {
  if (Array.isArray(item?.races)) return item.races.map(race => ({ ...race, course: courseOf(race) || courseOf(item) }));
  return [item];
});
cards = flattenMeetings(cards);
results = flattenMeetings(results);

let oddsChanges = 0;
let resultChanges = 0;

for (const { selection } of selections) {
  const cardRace = cards.find(race =>
    sameCourse(courseOf(race), selection.course) &&
    (!race.date || race.date === data.snapshotDate) &&
    runnersOf(race).some(runner => sameHorse(horseNameOf(runner), selection.horse))
  );
  if (cardRace) {
    const count = Number(cardRace.field_size || cardRace.fieldSize || cardRace.runners_count);
    if (Number.isInteger(count) && count > 0 && count !== selection.runnerCount) {
      selection.runnerCount = count;
      resultChanges++;
    }
    const runner = runnersOf(cardRace).find(r => sameHorse(horseNameOf(r), selection.horse));
    const latest = bestOdds(runner);
    if (latest?.text && latest.text !== selection.odds) {
      if (!selection.oddsAtSelection) selection.oddsAtSelection = selection.odds;
      selection.odds = latest.text;
      selection.oddsBookmaker = latest.bookmaker || selection.oddsBookmaker || null;
      selection.oddsUpdatedAt = now;
      oddsChanges++;
    }
    if (runner?.status && /non.?runner|withdrawn|scratched|nr/i.test(String(runner.status))) {
      if (selection.result?.status !== 'NR') {
        selection.result = { status: 'NR', source: feedName, updatedAt: now };
        resultChanges++;
      }
    }
  }

  const resultRace = results.find(race =>
    sameCourse(courseOf(race), selection.course) &&
    runnersOf(race).some(runner => sameHorse(horseNameOf(runner), selection.horse))
  );
  if (resultRace) {
    const confirmed = Number(resultRace.field_size || resultRace.fieldSize) || runnersOf(resultRace).filter(r => !/^(NR|non.?runner|withdrawn)$/i.test(String(r?.position || r?.status || ''))).length;
    if (confirmed > 0 && confirmed !== selection.runnerCount) {
      selection.runnerCount = confirmed;
      resultChanges++;
    }
    const runner = runnersOf(resultRace).find(r => sameHorse(horseNameOf(r), selection.horse));
    const nextResult = resultForRunner(runner);
    if (nextResult) {
      const before = JSON.stringify({position:selection.result?.position??null,status:selection.result?.status??null,sp:selection.result?.sp??null});
      const after = JSON.stringify({position:nextResult.position??null,status:nextResult.status??null,sp:nextResult.sp??null});
      if (before !== after) {
        selection.result = { ...nextResult, source: feedName };
        resultChanges++;
      }
    }
  }
}

// Persist the first recorded price/stake for each selection independently of live odds.
const ledgerFile = new URL('../data/bet-ledger.json', import.meta.url);
const ledger = JSON.parse(await fs.readFile(ledgerFile, 'utf8'));
let ledgerChanges = 0;
for (const { group, selection } of selections) {
  const betType = group === 'todaySelections' ? 'win' : 'each-way';
  const id = [data.snapshotDate, selection.course, selection.time, selection.horse, betType].join('|').toLowerCase();
  let entry = ledger.entries.find(e => e.id === id);
  if (!entry) {
    entry = { id, date: data.snapshotDate, course: selection.course, time: selection.time,
      horse: selection.horse, betType, winStake: betType === 'win' ? 10 : 5,
      placeStake: betType === 'win' ? 0 : 5,
      selectionOdds: selection.oddsAtSelection || selection.odds,
      settlementOdds: selection.result?.sp || null,
      ewFraction: betType === 'each-way' ? 0.25 : null,
      runnerCount: Number(selection.runnerCount || selection.runners || selection.fieldSize) || null,
      placesPaid: betType === 'each-way' && Number(selection.runnerCount || selection.runners || selection.fieldSize) ? (Number(selection.runnerCount || selection.runners || selection.fieldSize) <= 4 ? 1 : Number(selection.runnerCount || selection.runners || selection.fieldSize) <= 7 ? 2 : 3) : null, terms: selection.terms || null,
      result: selection.result || null };
    ledger.entries.push(entry);
    ledgerChanges++;
  }
  const actualCount = Number(selection.runnerCount) || null;
  if (betType === 'each-way' && actualCount && entry.runnerCount !== actualCount) {
    entry.runnerCount = actualCount;
    entry.placesPaid = actualCount <= 4 ? 1 : actualCount <= 7 ? 2 : 3;
    ledgerChanges++;
  }
  const nextResult = selection.result || null;
  if (JSON.stringify(entry.result) !== JSON.stringify(nextResult) && nextResult) {
    entry.result = nextResult;
    ledgerChanges++;
  }
  if (!entry.settlementOdds && nextResult?.sp) {
    entry.settlementOdds = nextResult.sp;
    ledgerChanges++;
  }
}
if (ledgerChanges) {
  await fs.writeFile(ledgerFile, JSON.stringify(ledger, null, 2) + '\n');
  console.log('Paper betting ledger updated: ' + ledgerChanges + ' changes');
}

if (!oddsChanges && !resultChanges) {
  console.log(`Live refresh checked via ${feedName}: no odds or result changes.`);
  process.exit(0);
}

data.liveFeed = {
  provider: feedName,
  refreshedAt: now,
  oddsChanges,
  resultChanges
};
if (resultChanges) data.resultsUpdatedAt = now;
if (oddsChanges) data.oddsUpdatedAt = now;

await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
console.log(`Live refresh complete via ${feedName}: ${oddsChanges} odds changes, ${resultChanges} result changes.`);
