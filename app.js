let DATA=null;let activeCourse=null;let filter='all';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
async function boot(){
  try{const r=await fetch('./data/racing.json',{cache:'no-store'});DATA=await r.json();renderAll()}
  catch(e){$('#health').textContent='Data load failed';console.error(e)}
}
function renderAll(){
  $('#snapshot').textContent=DATA.meta.snapshot;
  $('#updated').textContent=new Date(DATA.meta.updated_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  $('#mode').textContent=DATA.meta.mode;
  $('#market').textContent=DATA.meta.market_connected?'Connected':'Not connected';
  $('#health').textContent=DATA.meta.market_connected?'Feeds connected':'Verified demo mode';
  activeCourse=activeCourse||DATA.meetings[0].course;
  renderSignals();renderTabs();renderRaces();renderTracker();renderSources();
}
function renderSignals(){
  const q=$('#search').value.trim().toLowerCase();
  const arr=DATA.signals.filter(s=>{
    const hay=[s.horse,s.course,s.race,s.trainer,s.jockey,...s.badges].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(filter==='all'||s.grade===filter||s.discipline===filter);
  });
  $('#signals').innerHTML=arr.map(s=>`
    <article class="signal" data-race="${esc(s.race_id)}">
      <div class="signal-top"><span class="pill ${s.market==='Not connected'?'off':'pos'}">${esc(s.market)}</span><span class="grade">${esc(s.grade)}</span></div>
      <h3>${esc(s.horse)}</h3><div class="race-ref">${esc(s.course)} ${esc(s.time)} · ${esc(s.race)}</div>
      <div class="badges">${s.badges.map(b=>`<span class="pill pos">${esc(b)}</span>`).join('')}</div>
      <p>${esc(s.summary)}</p>
      <div class="bars">${Object.entries(s.scorecard).slice(0,4).map(([k,v])=>`<div class="bar"><span>${esc(k)}</span><div class="track"><div class="fill" style="width:${v.score}%"></div></div><b>${esc(v.label)}</b></div>`).join('')}</div>
    </article>`).join('')||'<p>No runners match the current filter.</p>';
  $$('.signal').forEach(x=>x.onclick=()=>openRace(x.dataset.race));
}
function renderTabs(){
  $('#tabs').innerHTML=DATA.meetings.map(m=>`<button class="tab ${m.course===activeCourse?'active':''}" data-course="${esc(m.course)}">${esc(m.course)} <small>· ${m.races.length}</small></button>`).join('');
  $$('.tab').forEach(b=>b.onclick=()=>{activeCourse=b.dataset.course;renderTabs();renderRaces()});
}
function renderRaces(){
  const m=DATA.meetings.find(x=>x.course===activeCourse); if(!m)return;
  $('#races').innerHTML=m.races.map(r=>`<article class="race ${r.deep?'hot':''}" ${r.deep?`data-race="${esc(r.id)}"`:''}><time>${esc(r.time)}</time><small>${esc(r.name||r.type)}</small>${r.deep?'<div class="intelligence">INTELLIGENCE AVAILABLE →</div>':'<div class="intelligence" style="color:#999">CARD INDEXED</div>'}</article>`).join('');
  $$('.race.hot').forEach(x=>x.onclick=()=>openRace(x.dataset.race));
}
function renderTracker(){
  $('#tracker').innerHTML=DATA.tracker.map(t=>`<div class="tracker-item"><strong>${esc(t.horse)}</strong><span>${esc(t.reason)}</span><span class="pill warn">${esc(t.trigger)}</span></div>`).join('');
}
function renderSources(){
  $('#sources').innerHTML=DATA.sources.map(s=>`<div class="source"><div><b>${esc(s.name)}</b><br><small>${esc(s.purpose)}</small></div><span class="pill ${s.status==='connected'?'pos':s.status==='reference'?'warn':'off'}">${esc(s.status)}</span></div>`).join('');
}
function openRace(id){
  const race=DATA.deep_races[id]; if(!race)return;
  $('#raceBody').innerHTML=`
    <span class="kicker">${esc(race.course)} · ${esc(race.time)}</span>
    <h2>${esc(race.name)}</h2>
    <p class="note">${esc(race.conditions)}</p>
    <div class="fact-model">
      <div><h4>VERIFIED FACT</h4><p>${esc(race.verified_fact)}</p></div>
      <div><h4>MODEL VIEW</h4><p>${esc(race.model_view)}</p></div>
    </div>
    <h3>Signal matrix</h3><div class="matrix">${Object.entries(race.matrix).map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
    <h3>Runners</h3>
    <div style="overflow:auto"><table class="runner-table"><thead><tr><th>Horse</th><th>Age/Wt</th><th>OR</th><th>Draw</th><th>Jockey / Trainer</th><th>Evidence</th></tr></thead><tbody>
    ${race.runners.map(r=>`<tr><td><b>${esc(r.horse)}</b></td><td>${esc(r.age_weight)}</td><td>${esc(r.or||'—')}</td><td>${esc(r.draw||'—')}</td><td>${esc(r.jockey)}<br><small>${esc(r.trainer)}</small></td><td>${esc(r.note)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="fact-model"><div><h4>MARKET EVIDENCE</h4><p>${esc(race.market)}</p></div><div><h4>RISKS / MISSING DATA</h4><p>${esc(race.risks)}</p></div></div>`;
  $('#raceDialog').showModal();
}
$('#search').addEventListener('input',renderSignals);
$$('.chip').forEach(b=>b.onclick=()=>{$$('.chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;renderSignals()});
$('#sourcesBtn').onclick=()=>$('#sourcesDialog').showModal();
$$('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());
boot();