const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v)||0);
const signed=v=>(Number(v)>0?'+':'')+money(v);
const ordinal=n=>{const x=Number(n);if(!Number.isInteger(x)||x<=0)return '?';return x+(x%100>=11&&x%100<=13?'th':x%10===1?'st':x%10===2?'nd':x%10===3?'rd':'th')};
const percent=v=>v===null||v===undefined?'—':Number(v).toFixed(1)+'%';
const readable=d=>{try{return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00Z'))}catch{return d}};
let loading=false;
async function jsonFetch(path,opts={}){
 const response=await fetch(path,{...opts,credentials:'same-origin',cache:'no-store'});
 let data;try{data=await response.json()}catch{data={error:'Unexpected server response'}}
 if(!response.ok)throw Object.assign(new Error(data.error||'Request unsuccessful'),{code:response.status});
 return data;
}
function loginMode(message=''){
 $('login-panel').hidden=false;$('office-panel').hidden=true;$('report-content').hidden=true;
 $('login-error').textContent=message;
 if(!message)$('pin').value='';
}
async function showOffice(){
 $('login-panel').hidden=true;$('office-panel').hidden=false;
 await loadReport();
}
async function checkSession(){
 try{await jsonFetch('./api/backoffice/session');await showOffice()}
 catch{loginMode()}
}
function card(label,value,description,subClass=''){
 return '<div class="metric"><span>'+esc(label)+'</span><strong class="'+subClass+'">'+esc(value)+'</strong><small>'+esc(description)+'</small></div>';
}
function render(report){
 const days=report.daily||[],last=days.at(-1),tot=report.overview||{};
 const maxAbs=Math.max(1,...days.map(d=>Math.abs(Number(d.settledProfit)||0)));
 const cards='<div class="metric-grid">'+[
  card('Paper bank available',money(tot.availableBank),'After stakes and all credited returns'),
  card('Cumulative settled P/L',signed(tot.settledProfit),'Excludes results still pending',Number(tot.settledProfit)<0?'loss':'gain'),
  card('Win strike rate',percent(tot.winStrikeRate),(tot.winners||0)+' winners from '+(tot.knownResults||0)+' finished selections'),
  card('E/W place strike rate',percent(tot.ewPlaceRate),'Only runners with known qualifying place terms')
 ].join('')+'</div>';
 const chart='<section class="sheet"><div class="section-title"><div><h2>Daily performance</h2><p>Daily profit/loss and running-bank progression</p></div><span>'+days.length+' recorded day'+(days.length===1?'':'s')+'</span></div>'+
  '<div class="performance-grid"><div class="pl-chart">'+days.map(d=>{
    const pl=Number(d.settledProfit)||0;
    const w=Math.max(1,Math.abs(pl)/maxAbs*100);
    return '<div class="pl-row"><span>'+esc(readable(d.date))+'</span><div class="pl-track"><div class="pl-fill '+(pl<0?'negative':'positive')+'" style="width:'+w+'%"></div></div><b class="'+(pl<0?'loss':'gain')+'">'+esc(signed(pl))+'</b></div>';
  }).join('')+'</div><div class="performance-side"><strong>'+esc(money(last?.cumulative?.availableBank))+'</strong><span>Latest paper bank</span><strong>'+esc(money(last?.cumulative?.pendingStakes))+'</strong><span>Currently unresolved stakes</span></div></div></section>';
 const rows=days.slice().reverse().map(d=>{
  const c=d.cumulative||{};
  return '<tr><th scope="row">'+esc(readable(d.date))+'</th><td>'+d.selectionCount+(d.comboTickets?' + '+d.comboTickets+' L15':'')+'</td>'+
  '<td>'+esc(String(d.winners)+' / '+String(d.resultCount))+'</td><td>'+esc(percent(d.winStrikeRate))+'</td>'+
  '<td>'+esc(percent(d.ewPlaceRate))+'</td><td class="'+(d.settledProfit<0?'loss':'gain')+'">'+esc(signed(d.settledProfit))+'</td>'+
  '<td>'+esc(money(d.unresolvedStakes))+'</td><td>'+esc(money(c.availableBank))+'</td></tr>';
 }).join('');
 const table='<section class="sheet"><div class="section-title"><div><h2>Daily tracker journal</h2><p>One entry per race date, including historical results and unpriced/pending stakes</p></div></div>'+
  '<div class="table-scroll"><table><thead><tr><th>Date</th><th>Picks</th><th>Wins</th><th>Win SR</th><th>E/W place</th><th>Settled P/L</th><th>Open stakes</th><th>Bank</th></tr></thead>'+
  '<tbody>'+rows+'</tbody></table></div></section>';
 const notes=(report.tuning||[]).slice().reverse().map(item=>{
  const shortKind=item.kind==='limitation'?'Evidence gap':item.kind==='process'?'Process change':'Selection rule';
  return '<article class="change-row"><div class="change-top"><span class="kind">'+esc(shortKind)+'</span><time>'+esc(readable(item.date))+'</time></div>'+
   '<h3>'+esc(item.title)+'</h3><p>'+esc(item.description)+'</p>'+
   '<small>'+esc(item.evidenceStatus||'Rule adjustment documented; not statistically verified')+'</small></article>';
 }).join('');
 const changes='<section class="sheet"><div class="section-title"><div><h2>System changes & research</h2>'+
 '<p>Documented adjustments made to research and selection rules, not invented autonomous learning</p></div></div>'+
 '<div class="change-list">'+(notes||'<p>No changes recorded yet.</p>')+'</div></section>';
 const research=report.research||{},coverage=research.coverage||{},validation=research.validation||{};
 const researchMetrics='<div class="research-metrics">'+[
  card('Historical races in database',String(coverage.sourcedHistoricalRaces??0),'Sourced full-field race histories, distinct race dates/times'),
  card('Run-style comments stored',String(coverage.withRunComments??0),'Tagged notes with attributable prior-race sources'),
  card('Sectional datasets',String(coverage.withSectionals??0),'Furlong splits with publication rights'),
  card('Selection outcomes retained',String(coverage.confirmedFinishedOutcomes??0),'Only observed results; not full-field validation data')
 ].join('')+'</div>';
 const audit=research.priceAudit||{},baselineRows=(audit.oddsBands||[]).map(row=>
   '<tr><th scope="row">'+esc(row.oddsBand)+'</th><td>'+esc(row.observations)+'</td><td>'+esc(row.winners)+'</td>'+
   '<td>'+percent(row.winRatePercent)+'</td><td>'+esc(row.impliedExpectedWins??'—')+'</td>'+
   '<td>'+esc(row.marketImpliedBrier??'—')+'</td></tr>').join('');
 const auditTable='<div class="research-audit"><h3>Odds versus outcomes: baseline</h3>'+
  '<p>This is a descriptive check against raw market-implied chances, not a trained model. Bets without a clear saved price are excluded.</p>'+
  '<div class="table-scroll"><table><thead><tr><th>Quoted odds</th><th>Known picks</th><th>Wins</th><th>Strike</th><th>Market expected wins</th><th>Brier</th></tr></thead><tbody>'+baselineRows+'</tbody></table></div>'+
  '<small>'+esc(audit.conclusions||'No reliable accuracy conclusion yet')+'</small></div>';
 const signalRows=(research.factors||[]).map(f=>'<div class="research-factor"><strong>'+esc(f.name)+'</strong><small>'+esc(f.source)+'</small></div>').join('');
 const sources=(research.sources||[]).map(p=>'<a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">'+esc(p.title)+' ↗</a>').join('');
 const tracks=(research.tracks||[]).map(course=>'<details class="course-profile"><summary><strong>'+esc(course.course)+'</strong><small>'+esc(course.surface)+' · '+esc(course.configuration)+'</small></summary>'+
  '<div class="course-profile-body"><p><b>Track direction:</b> '+esc(course.direction)+'</p>'+
  (course.details?Object.entries(course.details).map(([key,value])=>'<p><b>'+esc(key.replace(/([A-Z])/g,' $1'))+':</b> '+esc(value)+'</p>').join(''):'')+
  '<p><b>Measured draw/pace bias:</b> Not yet quantified from a controlled historic sample.</p>'+
  (course.sourceUrls||[]).map(url=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Course source ↗</a>').join(' ')+'</div></details>').join('');
 const coursePanel='<div class="research-course-panel"><h3>Track-type profiles</h3><p>Course and distance are kept separate. No generic pace or draw bias is claimed without a comparable sample.</p><div class="course-profiles">'+tracks+'</div></div>';
 const researchPanel='<section class="sheet"><div class="section-title"><div><h2>Historical research laboratory</h2>'+
 '<p>Running style, track layout, handicap marks, race comments and sectional pace. Factor engineering runs in shadow mode until tested.</p></div></div>'+
 researchMetrics+
 '<p class="research-readiness"><strong>'+(coverage.quantitativeRetrainReady?'Archive threshold met — evaluate prospectively':'Historical validation not yet ready')+'</strong><span>'+esc(validation.reason||'Require an independent chronological held-out test before changing predictions')+'</span></p>'+
 '<div class="research-factors">'+signalRows+'</div>'+
 auditTable+
 coursePanel+
 '<div class="research-sources"><strong>Research references</strong><div>'+sources+'</div></div>'+
 '<p class="research-disclaimer">The existing paper ledger has '+esc(coverage.recordedTipBets??0)+' recorded bets over '+esc(coverage.recordedTipDates??0)+' race dates; it does not contain 500 verified full historical races. This panel never invents sectionals or retrospective performance figures. Changes are tested out-of-sample before use.</p></section>';
 const methodology=report.methodology||{};
 const standards='<section class="sheet methodology"><h2>How the figures are measured</h2>'+
  '<p><b>Win strike rate:</b> '+esc(methodology.strikeRate||'Wins / known finished runners')+'</p>'+
  '<p><b>E/W place rate:</b> '+esc(methodology.placeRate||'Places / EW runners with known terms')+'</p>'+
  '<p><b>Profit:</b> '+esc(methodology.profit||'Settled returns less settled stakes')+'</p>'+
  '<p><b>Evidence standard:</b> '+esc(methodology.caveat||'No unverified accuracy claim')+'</p></section>';

 const trainerView=research.trainerView||{},candidates=trainerView.selections||[];
 const tagLabel=t=>String(t).replace(/-/g,' ');
 const trainerRows=candidates.map(x=>{
  const tr=x.track||{},profile=tr.target||{},hyp=x.hypotheses||[],missing=tr.missing||[];
  const tags=(profile.terrainTags||[]).map(t=>'<span class="terrain-pill">'+esc(tagLabel(t))+'</span>').join('');
  const sources=(profile.sourceUrls||[]).map((url,i)=>'<a href="'+esc(url)+'" rel="noopener noreferrer" target="_blank">Course guide '+(i+1)+' ↗</a>').join(' ');
  const observations=tr.directRuns||0,similar=tr.similarLayoutRuns||0,sections=(tr.sectionalParComparisons||[]).length;
  const identified=profile.status==='course geometry documented';
  return '<details class="trainer-runner"><summary><strong>'+esc(x.horse)+'</strong><small>'+esc(x.course)+' · '+esc(x.time)+' · '+esc(x.trainer||'Trainer unrecorded')+
   ' · '+esc(identified?'TRACK MAPPED':'TRACK UNVERIFIED')+'</small></summary>'+
   '<div class="trainer-body"><p><b>Race context:</b> '+esc(x.raceDescriptor||'Trip/class not recorded')+'</p>'+
   '<p><b>Course configuration:</b> '+esc(identified?profile.configuration:profile.reason||'Unknown')+'</p>'+
   '<div class="terrain-tags">'+(tags||'<span class="terrain-pill">Unclassified</span>')+'</div>'+
   '<p><b>Past comparable starts:</b> '+observations+' same layout · '+similar+' broadly similar layouts · '+sections+' sourced sectional/par comparisons.</p>'+
   (hyp.length?'<div class="trainer-subtitle">Potential entry signals — not proof of trainer intent</div><ul>'+hyp.map(h=>
      '<li>'+esc(h.label)+' — '+esc(h.evidence)+'. <em>'+esc(h.certainty)+'</em></li>').join('')+'</ul>':
      '<p><b>Trainer/owner intent:</b> Unverified; no evidence sufficient for a race-placement inference.</p>')+
   '<p class="trainer-gaps"><b>Still needed:</b> '+esc(missing.join('; ')||'Independent walk-forward validation before a price or win-probability adjustment')+'</p>'+
   '<p><b>Decision gate:</b> '+esc(x.gate)+'</p>'+
   (sources?'<div class="research-sources">'+sources+'</div>':'')+
   '</div></details>';
 }).join('');
 const trainerPanel='<section class="sheet"><div class="section-title"><div><h2>Trainer\'s View — race placement & track suitability</h2>'+
  '<p>Each runner is checked against the exact course layout, race trip and dated past evidence. Trainer intentions are hypotheses, never insider facts.</p></div><span>'+esc(trainerView.date||'No card')+'</span></div>'+
  '<p class="research-readiness"><strong>'+esc(String(trainerView.historicalRunners||0))+' licensed past-run observations</strong>'+
  '<span>The published racecard is a historic snapshot, not today\'s current tips. These diagnostics do not change saved selections or infer sectionals.</span></p>'+
  '<div class="trainer-list">'+(trainerRows||'<p>There are no published selections to audit.</p>')+'</div></section>';
 const external=research.externalResearch||{},publishers=external.sources||[],extCoverage=external.coverage||[];
 const publisherCards=publishers.map(p=>'<article class="research-factor"><strong><a href="'+esc(p.url)+
  '" target="_blank" rel="noopener noreferrer">'+esc(p.name)+' ↗</a></strong>'+
  '<small>'+esc(p.kind)+'</small><p>'+esc((p.areas||[]).join(' · '))+'</p>'+
  '<small>'+esc(p.rules||'Independent source: verify context and publication time')+'</small></article>').join('');
 const extAuditRows=extCoverage.map(x=>{
  const observed=x.observations||[];
  const links=observed.map(e=>'<a href="'+esc(e.sourceUrl)+'" target="_blank" rel="noopener noreferrer">'+
   esc(e.provider)+' — '+esc(e.factor)+' ('+esc(e.stance)+')</a>').join(' · ');
  return '<tr><th scope="row">'+esc(x.horse)+'</th><td>'+esc(x.course)+' '+esc(x.time)+'</td>'+
   '<td>'+esc(String(x.sourceCount||0))+'/3</td><td>'+esc(x.status)+'</td>'+
   '<td>'+(links||'Not captured before the off')+'</td></tr>';
 }).join('');
 const externalPanel='<section class="sheet"><div class="section-title"><div><h2>Independent racing research</h2>'+
  '<p>OLBG · myracing · The Winners Enclosure — compare published reasoning, not follower counts.</p></div>'+
  '<span>'+esc(String(external.notesStored||0))+' saved verified pre-race notes</span></div>'+
  '<div class="research-factors">'+publisherCards+'</div>'+
  '<p class="research-disclaimer">These are attributed links for manual source review, not automatic live feeds. Tips, opinions and trainer trends are only recorded when a race-matched source was checked before the off. Missing reviews never reduce a horse\'s grade; provider agreement never directly increases a win-probability score.</p>'+
  '<div class="table-scroll"><table><thead><tr><th>Selection</th><th>Race</th><th>Sources</th><th>Evidence</th><th>Checked references</th></tr></thead><tbody>'+
  (extAuditRows||'<tr><td colspan="5">No published runners to compare.</td></tr>')+
  '</tbody></table></div></section>';
 
 const timings=research.raceTimeResearch||{},cases=timings.caseStudies||[];
 const clockPanels=cases.map(c=>{
  const a=c.analysis||{},p=a.positions||{},pace=a.pace||{},cmp=c.comparison||{},clock=a.time||{},race=c.race||{};
  const trail=(p.trail||[]).map(q=>'<span class="sectional-pos">'+esc(q.furlong)+'f <b>'+escapeHtml(ordinal(Number(q.position)))+'</b></span>').join('');
  return '<article class="timing-case"><div class="timing-title"><h3>'+esc(c.selectedHorse)+' — '+esc(race.course)+' '+esc(race.raceTime)+'</h3>'+
   '<small>'+esc(race.date)+' · '+esc(race.surface)+' · '+esc(race.going)+' · '+esc(race.distanceFurlongs.toFixed(2))+'f</small></div>'+
   '<div class="timing-metrics">'+
    '<div><small>Official race-winning time</small><b>'+esc(race.winningTimeSeconds)+'s</b></div>'+
    '<div><small>Horse own measured time</small><b>'+esc(clock.seconds)+'s</b></div>'+
    '<div><small>Finish and movement</small><b>'+esc(ordinal(p.endPosition))+' · '+(Number(p.positionsGained)>0?'+':'')+esc(p.positionsGained)+' places</b></div>'+
    '<div><small>Closing speed / field rank</small><b>'+esc(pace.publishedFinishingSpeedPercent)+'% · #'+esc(pace.finishingSpeedRank)+'</b></div>'+
    '<div><small>Peak speed / field rank</small><b>'+esc(pace.topSpeedMph)+' mph · #'+esc(pace.topSpeedRank)+'</b></div>'+
    '<div><small>Last 2f vs winner</small><b>'+esc(cmp.horseClosingTime)+'s vs '+esc(cmp.rivalClosingTime)+'s</b></div>'+
    '</div><div class="timing-positions">'+trail+'</div>'+
    '<p class="research-disclaimer">'+esc(c.interpretation)+'</p>'+
    '<p class="research-disclaimer"><b>Data timing:</b> '+esc(c.verification)+' Winner official '+esc(race.winningTimeSeconds)+'s vs tracker '+esc(c.opponent?.time?.seconds)+'s. No race-specific par FSP connected. Not a proven future speed rating.</p>'+
    '<div class="research-sources"><a href="'+esc(race.sourceUrl)+'" target="_blank" rel="noopener noreferrer">View published result and sectionals ↗</a></div></article>';
 }).join('');
 const timingPanel='<section class="sheet"><div class="section-title"><div><h2>Horse time & sectional research</h2>'+
  '<p>Individual finishing clocks, furlong-by-furlong running position and evidence of finishing effort, sourced from historic results.</p></div><span>MANUAL RESEARCH</span></div>'+
  '<p class="research-readiness"><strong>Measured times first; margin-based estimates second</strong>'+
  '<span>'+esc(timings.scope||'Manual timing verification')+'. Official winning time is not the individual time of every runner; winning time plus beaten lengths only gives a conditional approximation.</span></p>'+
  (clockPanels||'<p>No independently verified past timing example yet.</p>')+'</section>';
  $('report-content').innerHTML=cards+chart+table+changes+trainerPanel+timingPanel+externalPanel+researchPanel+standards;
 $('report-content').hidden=false;
 $('report-loading').hidden=true;
}
async function loadReport(){
 if(loading)return;
 loading=true;$('report-loading').hidden=false;$('report-loading').textContent='Checking the current racing ledger…';
 try{render(await jsonFetch('./api/backoffice/report'))}
 catch(e){
  if(e.code===401){loginMode('Session expired. Enter your PIN again.');return}
  $('report-loading').textContent=e.message||'Could not load the back office';
 }finally{loading=false}
}
$('pin-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const pin=$('pin').value.trim(),btn=$('sign-in');btn.disabled=true;btn.textContent='Checking…';
 $('login-error').textContent='';
 try{
  await jsonFetch('./api/backoffice/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin})});
  $('pin').value='';await showOffice();
 }catch(e){$('pin').value='';$('login-error').textContent=e.message||'Access denied'}
 finally{btn.disabled=false;btn.textContent='Unlock back office'}
});
$('refresh-office').addEventListener('click',loadReport);
$('sign-out').addEventListener('click',async()=>{
 try{await jsonFetch('./api/backoffice/logout',{method:'POST'})}catch{}
 loginMode();
});
checkSession();
