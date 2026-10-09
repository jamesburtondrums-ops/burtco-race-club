const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v)||0);
const signed=v=>(Number(v)>0?'+':'')+money(v);
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
 const signalRows=(research.factors||[]).map(f=>'<div class="research-factor"><strong>'+esc(f.name)+'</strong><small>'+esc(f.source)+'</small></div>').join('');
 const sources=(research.sources||[]).map(p=>'<a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">'+esc(p.title)+' ↗</a>').join('');
 const researchPanel='<section class="sheet"><div class="section-title"><div><h2>Historical research laboratory</h2>'+
 '<p>Running style, track layout, handicap marks, race comments and sectional pace. Factor engineering runs in shadow mode until tested.</p></div></div>'+
 researchMetrics+
 '<p class="research-readiness"><strong>'+(coverage.quantitativeRetrainReady?'Archive threshold met — evaluate prospectively':'Historical validation not yet ready')+'</strong><span>'+esc(validation.reason||'Require an independent chronological held-out test before changing predictions')+'</span></p>'+
 '<div class="research-factors">'+signalRows+'</div>'+
 '<div class="research-sources"><strong>Research references</strong><div>'+sources+'</div></div>'+
 '<p class="research-disclaimer">The existing paper ledger has '+esc(coverage.recordedTipBets??0)+' recorded bets over '+esc(coverage.recordedTipDates??0)+' race dates; it does not contain 500 verified full historical races. This panel never invents sectionals or retrospective performance figures. Changes are tested out-of-sample before use.</p></section>';
 const methodology=report.methodology||{};
 const standards='<section class="sheet methodology"><h2>How the figures are measured</h2>'+
  '<p><b>Win strike rate:</b> '+esc(methodology.strikeRate||'Wins / known finished runners')+'</p>'+
  '<p><b>E/W place rate:</b> '+esc(methodology.placeRate||'Places / EW runners with known terms')+'</p>'+
  '<p><b>Profit:</b> '+esc(methodology.profit||'Settled returns less settled stakes')+'</p>'+
  '<p><b>Evidence standard:</b> '+esc(methodology.caveat||'No unverified accuracy claim')+'</p></section>';
 $('report-content').innerHTML=cards+chart+table+changes+researchPanel+standards;
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
