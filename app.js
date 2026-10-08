const state={data:null,ledger:null,live:null,liveSerial:"",view:"today",filter:"ALL",serial:"",refreshing:false,refreshMessage:"",refreshCheckedAt:null,search:null,searchError:"",webConfirmed:{},searchCheckedAt:null};
const val=v=>v===undefined||v===null||v===""?"—":v;
const contextOf=x=>x.v42||x.v41||null;
const probabilityOf=x=>contextOf(x)?.winProbability??null;
const primeOf=x=>contextOf(x)?.isPrime===true;
const starsOf=x=>contextOf(x)?.stars??0;
const stars=n=>'<span class="stars">'+Array.from({length:5},(_,i)=>i<n?'★':'☆').join('')+'</span>';
const confidenceLabel=x=>primeOf(x)?"PRIME":starsOf(x)?Array.from({length:5},(_,i)=>i<starsOf(x)?"★":"☆").join(""):"WATCH";
const timeValue=t=>{const m=String(t||"").match(/(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):9999};
const chronological=items=>[...(items||[])].sort((a,b)=>timeValue(a.time)-timeValue(b.time)||String(a.course||"").localeCompare(String(b.course||"")));
const keyOf=(x,type)=>[type,x.time,x.course,x.horse].join("|").replace(/[^a-z0-9|_-]/gi,"-");
const ordinal=n=>{const x=Number(n);if(!Number.isFinite(x))return String(n);const mod100=x%100;if(mod100>=11&&mod100<=13)return x+"th";return x+(x%10===1?"st":x%10===2?"nd":x%10===3?"rd":"th")};
function raceHasPassed(x){if(!state.data?.snapshotDate||!x.time)return false;const d=new Date(state.data.snapshotDate+"T"+x.time+":00");return Number.isFinite(d.getTime())&&Date.now()>d.getTime()+10*60*1000}
function resultInfo(x){
 const r=x.result;
 if(r&&typeof r==="string")return {text:r,cls:"result-finished"};
 const status=r?.status||x.resultStatus||x.status;
 if(status&&/non.?runner|^nr$|withdrawn|scratched/i.test(status))return {text:"NR",cls:"result-nr"};
 if(status&&/void|abandon|cancel/i.test(status))return {text:String(status),cls:"result-nr"};
 if(status&&/^(F|PU|UR|BD|RO|RR|REF|DSQ|DNF|DISQ)$/i.test(status))return {text:"Result: "+status,cls:"result-finished"};
 const pos=r?.position??r?.place??x.finishPosition??x.position;
 if(pos!==undefined&&pos!==null&&pos!=="")return {text:"Result: "+ordinal(pos),cls:Number(pos)===1?"result-won":"result-finished"};
 if(r?.text)return {text:r.text,cls:"result-finished"};
 if(raceHasPassed(x))return {text:"Result pending",cls:"result-pending"};
 return null;
}

const money=n=>'£'+Number(n||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
function decimalOdds(s){
 const text=String(s||'').trim();
 if(!text||/[–~]|\bforecast\b|\bbest\b|\bfrom\b/i.test(text))return null;
 const m=text.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)(?:\s|$)/);
 if(m)return 1+Number(m[1])/Number(m[2]);
 if(/^evens?$/i.test(text))return 2;
 return null;
}
function positionOf(e){
 const p=e.result?.position??e.result?.place??null;
 if(p===null||p===''||p===undefined)return null;
 const n=Number(p);return Number.isFinite(n)&&n>0?n:null;
}
function settlement(e){
 const r=e.result;
 if(!r)return {status:'open',returnAmount:0};
 const status=String(r.status||'').trim();
 const stake=Number(e.winStake||0)+Number(e.placeStake||0);
 if (/^(NR|NON.RUNNER|WITHDRAWN|SCRATCHED|VOID|ABANDONED|CANCELLED)$/i.test(status) ||
   /non.?runner|withdrawn|void|abandon|cancel/i.test(status))
   return {status:'void',returnAmount:stake};
 const pos=positionOf(e);
 if(pos===null){
   if(/^(F|PU|UR|BD|RO|RR|REF|DSQ|DNF|DISQ|UNPLACED)$/i.test(status) ||
      /fell|pulled.?up|unseated|refused|brought.?down|disqualified|not.?finished/i.test(status))
     return {status:'lost',returnAmount:0};
   return {status:'open',returnAmount:0};
 }
 if(e.betType==='win' && pos!==1)return {status:'lost',returnAmount:0};
 const count=Number(e.runnerCount);
 const places=count>0?(count<=4?1:count<=7?2:3):(Number(e.placesPaid)||null);
 if(e.betType==='each-way' && (places!==null?pos>places:pos>3))
   return {status:'lost',returnAmount:0};
 const odds=decimalOdds(e.settlementOdds)||decimalOdds(e.selectionOdds);
 if(!odds)return {status:'unpriced',returnAmount:0};
 if(e.betType==='win')return {status:'won',returnAmount:Number(e.winStake)*odds};
 if(!places)return {status:'unpriced',returnAmount:0};
 const placed=pos<=places;
 const placeReturn=placed*Number(e.placeStake)*(1+(odds-1)*0.25);
 const winReturn=pos===1?Number(e.winStake)*odds:0;
 return {status:pos===1?'won':placed?'placed':'lost',returnAmount:winReturn+placeReturn};
}
function isFinisher(e){
 if(positionOf(e)!==null)return true;
 const status=String(e.result?.status||'');
 return /^(F|PU|UR|BD|RO|RR|REF|DSQ|DNF|DISQ|UNPLACED)$/i.test(status) ||
   /fell|pulled.?up|unseated|refused|brought.?down|disqualified|not.?finished/i.test(status);
}
function trackerStats(entries){
 let totalStake=0,openStake=0,settledStake=0,totalReturn=0;
 let settled=0,winCount=0,known=0,ewPlaced=0,ewKnown=0,voided=0;
 let todayKnown=0,todayWins=0;
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
 for(const e of entries){
  const stake=Number(e.winStake||0)+Number(e.placeStake||0);
  totalStake+=stake;
  const outcome=settlement(e);
  if(outcome.status==='open'||outcome.status==='unpriced'){openStake+=stake}
  else{settled++;settledStake+=stake;totalReturn+=outcome.returnAmount;if(outcome.status==='void')voided++}
  if(isFinisher(e)){
    known++;
    if(positionOf(e)===1)winCount++;
    if(e.date===today){todayKnown++;if(positionOf(e)===1)todayWins++;}
    if(e.betType==='each-way'){
      const n=Number(e.runnerCount),places=n>0?(n<=4?1:n<=7?2:3):Number(e.placesPaid)||null;
      if(places){ewKnown++;if(positionOf(e)!==null && positionOf(e)<=places)ewPlaced++;}
    }
  }
 }
 return {totalStake,openStake,settledStake,totalReturn,settled,winCount,known,ewPlaced,ewKnown,voided,todayKnown,todayWins,profit:totalReturn-settledStake};
}
function signMoney(n){return (n<0?'-':'+')+money(Math.abs(n));}

function applyLiveResults(){
 if(!state.data||!state.ledger||!state.live?.connected||state.live.date!==state.data.snapshotDate)return;
 const updates=state.live.updates||[];
 const groups=['todaySelections','midshotsToday','longshotsToday'];
 for(const group of groups)for(const pick of state.data[group]||[]){
   const update=updates.find(u=>u.horse===pick.horse&&u.course===pick.course&&u.time===pick.time);
   if(!update)continue;
   pick.result={...pick.result,...update.result,source:state.live.source,updatedAt:state.live.checkedAt};
   if(Number(update.runnerCount)>0)pick.runnerCount=Number(update.runnerCount);
   const type=group==='todaySelections'?'win':'each-way';
   const id=[state.data.snapshotDate,pick.course,pick.time,pick.horse,type].join('|').toLowerCase();
   const entry=state.ledger.entries.find(e=>e.id===id);
   if(entry){
     entry.result={...entry.result,...pick.result};
     if(pick.result.sp)entry.settlementOdds=pick.result.sp;
     if(pick.runnerCount){entry.runnerCount=pick.runnerCount;entry.placesPaid=pick.runnerCount<=4?1:pick.runnerCount<=7?2:3;}
   }
 }
}

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const webKey=(date,course,time,horse)=>[date,course,time,horse].join('|').toLowerCase();
function applyWebConfirmations(){
 if(!state.data||!state.ledger)return;
 for(const group of ['todaySelections','midshotsToday','longshotsToday'])
  for(const pick of state.data[group]||[]){
   if(pick.result?.position)continue;
   const confirmed=state.webConfirmed[webKey(state.data.snapshotDate,pick.course,pick.time,pick.horse)];
   if(!confirmed||!Number(confirmed.position))continue;
   pick.result={position:confirmed.position,status:'Weighed in',source:confirmed.source,
    sourceUrl:confirmed.verifiedUrls?.[0]||'',updatedAt:confirmed.checkedAt};
   const type=group==='todaySelections'?'win':'each-way';
   const betId=[state.data.snapshotDate,pick.course,pick.time,pick.horse,type].join('|').toLowerCase();
   const entry=state.ledger.entries.find(e=>e.id===betId);
   if(entry&&!entry.result?.position)entry.result={...pick.result};
  }
}
function rememberWebResults(){
 try{if(typeof localStorage!=='undefined')
  localStorage.setItem('racing-verified-web-results-v1',JSON.stringify(state.webConfirmed));
 }catch(e){console.warn('Browser storage unavailable',e)}
}
function searchPanel(){
 if(!state.search&&!state.searchError)return '';
 const results=state.search?.results||[];
 const hits=results.reduce((n,p)=>n+p.hits.length,0);
 const matched=results.filter(p=>p.confirmed).length;
 const errors=results.filter(p=>!p.checked).length;
 const head='<section class="web-search-panel"><div class="web-search-heading"><div><h3>Web results search</h3><p>'+
  (state.searchError?escapeHtml(state.searchError):'Searched '+results.length+' unfinished selections across indexed results from Sporting Life, Racing TV, At The Races, Sky Sports and other publishers. '+hits+' relevant links found; '+matched+' independently corroborated. '+(errors?'Search unavailable for '+errors+' selections.':''))+
  '</p></div><span>'+escapeHtml(state.search?.checkedAt?new Date(state.search.checkedAt).toLocaleTimeString('en-GB',{timeZone:'Europe/London'}):'')+'</span></div>';
 return head+(results.length?
  '<div class="web-search-list">'+results.map(p=>{
   const query='"'+p.horse+'" '+p.course+' '+p.date+' racing result';
   const searchLink='https://www.google.com/search?q='+encodeURIComponent(query);
   const label=p.confirmed?'<span class="web-search-verified">Confirmed from multiple sources</span>':
    p.hits.length?'<span class="web-search-review">Review result</span>':'<span class="web-search-missing">No matching indexed page yet</span>';
   return '<details class="web-search-row" '+(p.confirmed?'open':'')+'><summary><b>'+escapeHtml(p.horse)+'</b><span>'+escapeHtml(p.course)+' · '+escapeHtml(p.time||'')+'</span>'+label+'</summary><div class="web-search-hits">'+
    (p.hits.length?p.hits.map(hit=>'<div class="web-search-hit"><a href="'+escapeHtml(hit.url)+'" rel="noopener noreferrer" target="_blank">'+escapeHtml(hit.source)+' ↗</a><p>'+escapeHtml(hit.title)+(hit.position?' · '+hit.position+' place':'')+'</p><small>'+escapeHtml(hit.snippet)+'</small></div>').join(''):'<p>No matching web results found in this search. This is not a confirmed losing result.</p>')+
    '<a class="web-search-google" href="'+escapeHtml(searchLink)+'" target="_blank" rel="noopener noreferrer">Search other websites for '+escapeHtml(p.horse)+' ↗</a>'+
    '</div></details>';
  }).join('')+'</div>':'')+
 '<p class="web-search-caution">The tracker changes only when two separate racing publishers explicitly agree on a finishing position. Other web results are provided for verification. Searches are on demand; this is not an official results feed.</p></section>';
}
async function searchRaceResults(){
 try{
  const res=await fetch('./api/search-results?checked='+Date.now(),{cache:'no-store'});
  if(!res.ok)throw Error('Search service returned HTTP '+res.status);
  const payload=await res.json();
  if(!payload.ok)throw Error(payload.error||'Unable to search public results');
  state.search=payload;state.searchError='';state.searchCheckedAt=payload.checkedAt;
  if(payload.date===state.data?.snapshotDate){
   for(const record of payload.results||[]){
    if(!record.confirmed)continue;
    const key=webKey(payload.date,record.course,record.time,record.horse);
    if(!state.webConfirmed[key])state.webConfirmed[key]={...record.confirmed,checkedAt:payload.checkedAt};
   }
   rememberWebResults();applyWebConfirmations();
  }
  return true;
 }catch(error){
  state.searchError='Web search unavailable: '+(error?.message||String(error));
  state.search=null;return false;
 }
}

function tracker(){
 const ledger=state.ledger;
 if(!ledger)return '';
 const entries=ledger.entries||[];
 const stats=trackerStats(entries);
 const starting=Number(ledger.startingBank??1000);
 const bank=starting-stats.totalStake+stats.totalReturn;
 const settledBank=starting+stats.profit;
 const roi=stats.settledStake>0?stats.profit/stats.settledStake*100:null;
 const winRate=stats.known?stats.winCount/stats.known*100:null;
 const ewRate=stats.ewKnown?stats.ewPlaced/stats.ewKnown*100:null;
 const today=stats.todayKnown?stats.todayWins+'/'+stats.todayKnown+' ('+(stats.todayWins/stats.todayKnown*100).toFixed(1)+'%)':'Awaiting finished races';
 const rate=v=>v===null?'—':v.toFixed(1)+'%';
 return '<section class="tracker-panel" aria-label="Live paper betting profit and strike rate">'+
 '<div class="tracker-heading"><div><strong>Profit & strike-rate tracker</strong><span class="tracker-kicker">£1,000 starting bank · £10 win or £5 each-way · '+entries.length+' selections recorded</span></div><span class="tracker-live-label">'+(state.live?.connected?'Live result checks active':'Web-verified results · automatic updates not active')+'</span></div>'+
 '<div class="tracker-toolbar"><button type="button" data-refresh-results class="refresh-results-btn" '+(state.refreshing?'disabled aria-busy="true"':'')+'>'+(state.refreshing?'Checking results…':'↻ Refresh race results')+'</button><a class="tracker-source-link" href="https://www.sportinglife.com/racing/fast-results" target="_blank" rel="noopener noreferrer">Sporting Life fast results ↗</a></div>'+
 '<p class="tracker-refresh-message" aria-live="polite" role="status">'+(state.refreshMessage||'Refresh checks for newly published results; the public source link opens separately.')+'</p>'+
 '<div class="tracker-stats">'+
 '<div><span>Available bank</span><strong>'+money(bank)+'</strong><small>After all stakes and credited returns</small></div>'+
 '<div><span>Settled profit / loss</span><strong class="'+(stats.profit>=0?'tracker-positive':'tracker-negative')+'">'+signMoney(stats.profit)+'</strong><small>'+stats.settled+' settled · '+(roi===null?'—':rate(roi))+' return on settled stakes</small></div>'+
 '<div><span>Win strike rate</span><strong>'+rate(winRate)+'</strong><small>'+stats.winCount+' winners from '+stats.known+' known outcomes</small></div>'+
 '<div><span>Each-way place rate</span><strong>'+rate(ewRate)+'</strong><small>'+stats.ewPlaced+' placed from '+stats.ewKnown+' known E/W outcomes</small></div>'+
 '</div><div class="tracker-bottom"><div><span>Running bank after settled bets:</span> <b>'+money(settledBank)+'</b></div><div><span>Outstanding / unpriced stakes:</span> <b>'+money(stats.openStake)+'</b></div><div><span>Today’s strike rate:</span> <b>'+today+'</b></div></div>'+
 '<p class="tracker-footnote">Total stakes '+money(stats.totalStake)+' · Credited returns '+money(stats.totalReturn)+' · Non-runners refunded. Each-way returns: ¼ odds, 1 paid place for 1–4 runners, 2 for 5–7, and 3 for 8+. Only confirmed results count toward strike rates; missing prices or field sizes remain unresolved. Settlements use recorded SP where available, otherwise a single unambiguous quoted price. Paper tracking only.</p>'+
 '</section>';
}
function liveStatus(){
 const l=state.live,connected=l?.connected===true;
 const checked=connected&&l.checkedAt?new Date(l.checkedAt).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',second:'2-digit'}):null;
 const webCheck=state.data?.resultVerification?.checkedAt;
 const webStatus=webCheck?new Date(webCheck).toLocaleString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'not checked';
 const note=connected?'Results feed connected · Last check '+checked+' · New finishing positions update the tracker automatically':
   'Web-verified results · Last checked '+webStatus+' · Further updates require manual verification or a licensed data connection';
 return '<div class="live-connection '+(connected?'live-connected':'live-disconnected')+'" role="status">'+note+'</div>';
}

function nav(){return [["today","Today"],["midshots","Mid Shots 10/1–18/1"],["longshots","Longshots 20/1+"],["history","Results history"],["sources","Sources"]].map(([v,t])=>'<button class="'+(state.view===v?'active':'')+'" data-view="'+v+'">'+t+'</button>').join("")}
function filters(){const x=["ALL","PRIME","★★★★★","★★★★☆","★★★☆☆","WATCH"];return '<div class="meeting-tabs">'+x.map(f=>'<button data-filter="'+f+'" class="'+(state.filter===f?'active':'')+'">'+f+'</button>').join("")+'</div>'}
function resultBadge(x){const r=resultInfo(x);return r?'<span class="result-badge '+r.cls+'">'+r.text+'</span>':''}
function summaryBadges(x,type){
 if(type==="main"){const p=probabilityOf(x);return (x.restoredFromPreviousVersion?'<span class="selection-tier restored">EARLIER PICK</span>':'')+'<span class="selection-tier '+(primeOf(x)?'prime':'')+'">'+confidenceLabel(x)+'</span>'+(p!==null?'<span class="probability">'+Number(p).toFixed(1)+'%</span>':'')}
 if(type==="mid")return '<span class="selection-tier mid">'+(x.view||"MID-SHOT")+'</span>';
 return '<span class="selection-tier long">'+(x.placeView||"E/W")+'</span>';
}
function commonDetails(x){
 const q=contextOf(x);
 return '<div class="detail-grid">'+
   (q?'<div class="detail-stat"><span>Win probability</span><b>'+val(q.winProbability!==undefined?Number(q.winProbability).toFixed(1)+'%':null)+'</b></div><div class="detail-stat"><span>Market rank</span><b>'+val(q.marketRank?'#'+q.marketRank:null)+'</b></div><div class="detail-stat"><span>Coverage</span><b>'+val(q.criticalCoverage!==undefined?q.criticalCoverage+'%':null)+'</b></div><div class="detail-stat"><span>Predictability</span><b>'+val(q.racePredictability!==undefined?q.racePredictability+'/100':null)+'</b></div>':'')+
   (x.or!==undefined?'<div class="detail-stat"><span>OR</span><b>'+val(x.or)+'</b></div>':'')+
   (x.ts!==undefined?'<div class="detail-stat"><span>TS</span><b>'+val(x.ts)+'</b></div>':'')+
   (x.rpr!==undefined?'<div class="detail-stat"><span>RPR</span><b>'+val(x.rpr)+'</b></div>':'')+
 '</div>'+
 ((x.tags||[]).length?'<div class="signal-list">'+x.tags.map(t=>'<span class="tag">'+t+'</span>').join("")+'</div>':'')+
 (q?.contextSummary?'<div class="context-summary"><strong>Context verdict</strong><p>'+q.contextSummary+'</p></div>':'')+
 (q?.contextFactors?'<div class="factor-grid">'+q.contextFactors.map(f=>'<div class="factor-row"><span>'+f.name+'</span><b class="factor-status">'+f.status+'</b><small>'+f.detail+'</small></div>').join("")+'</div>':'');
}
function selectionRow(x,type){
 const k=keyOf(x,type), isMain=type==="main";
 const intro=isMain?(x.reason||""):(x.reason||"");
 const risk=x.risk||"—";
 const special=type==="mid"?'<div class="ew-view"><strong>'+val(x.view)+'</strong><small>'+val(x.terms)+'</small></div>':type==="long"?'<div class="ew-view"><strong>'+val(x.placeView)+'</strong><small>'+val(x.terms)+'</small></div>':'';
 const typeStars=type==="mid"&&x.midStars?stars(x.midStars):type==="long"&&x.ewStars?stars(x.ewStars):'';
 const bet=(state.ledger?.entries||[]).find(e=>e.id===[state.data.snapshotDate,x.course,x.time,x.horse,type==="main"?"win":"each-way"].join("|").toLowerCase());
 const settled=bet?settlement(bet):null;
 const stake=bet?Number(bet.winStake||0)+Number(bet.placeStake||0):0;
 const profit=settled&& !["open","unpriced"].includes(settled.status)?settled.returnAmount-stake:null;
 const betLine=bet?'<div class="bet-line"><b>Paper bet: '+(bet.betType==="win"?"£10 WIN":"£5 E/W (£10 total)")+'</b><span>Recorded price: '+val(bet.selectionOdds)+'</span><span>'+(profit!==null?'Return '+money(settled.returnAmount)+' · P/L '+(profit>=0?'+':'')+money(profit):'Settlement pending / terms unverified')+'</span></div>':'';

 return '<details class="selection-row" data-key="'+k+'"><summary class="selection-summary">'+
   '<div class="selection-time">'+val(x.time)+'</div>'+
   '<div class="selection-main"><div class="selection-name-line"><strong>'+val(x.horse)+'</strong>'+summaryBadges(x,type)+'</div><span>'+val(x.course)+'</span></div>'+
   '<div class="selection-odds"><span>Odds</span><strong>'+val(x.odds)+'</strong></div>'+
   '<div class="selection-result">'+resultBadge(x)+'</div>'+
   '<div class="selection-chevron">⌄</div>'+
 '</summary><div class="selection-details">'+betLine+typeStars+special+commonDetails(x)+
   '<div class="detail-copy"><strong>'+(type==="long"?'Why it can outrun the price':type==="mid"?'Why it can win / place':'Decision')+'</strong><p>'+intro+'</p></div>'+
   '<div class="detail-risk"><strong>Risk</strong><p>'+risk+'</p></div>'+
   '<div class="source-line">Source: '+val(x.source)+(x.result?.sourceUrl?' · <a target="_blank" rel="noopener noreferrer" href="'+x.result.sourceUrl+'">Verify result ↗</a>':'')+'</div>'+
 '</div></details>';
}
function listBlock(items,type,emptyText){const sorted=chronological(items);return sorted.length?'<div class="selection-list">'+sorted.map(x=>selectionRow(x,type)).join("")+'</div>':'<div class="panel"><p class="meta">'+emptyText+'</p></div>'}
function today(){
 const d=state.data;
 const picks=(d.todaySelections||[]).filter(x=>{const label=confidenceLabel(x);if(state.filter==="ALL")return true;if(state.filter==="WATCH")return label==="★☆☆☆☆"||label==="RECHECK"||label==="WATCH";return label===state.filter});
 return '<section class="page-intro"><div><div class="eyebrow">'+String(d.snapshotDate||"").toUpperCase()+' · GB + IRE</div><h2>Today\'s selections</h2><p>Selections are listed strictly by race time. Tap any runner to open the full reasoning, ratings, context and risk.</p></div><div class="quick-stats"><span><b>'+val(d.coverage?.meetings)+'</b> meetings</span><span><b>'+val(d.coverage?.races)+'</b> races scanned</span><span><b>'+val(d.todaySelections?.length)+'</b> selections</span><span><b>'+(d.todaySelections||[]).filter(primeOf).length+'</b> PRIME</span></div></section>'+filters()+listBlock(picks,"main","No selections match this filter.");
}
function midshots(){const d=state.data,ms=d.midshotsToday||[];return '<section class="page-intro mid-intro"><div><div class="eyebrow">10/1–18/1 WIN + E/W RADAR</div><h2>Mid Shots</h2><p>'+val(d.midshotsPolicy?.publicNote)+'</p></div><div class="quick-stats"><span><b>'+ms.length+'</b> candidates</span><span><b>10/1–18/1</b> price band</span></div></section><div class="rule-note mid-rule">'+val(d.midshotsPolicy?.priceRule)+'</div>'+listBlock(ms,"mid","No mid-shot selections currently qualify.")}
function longshots(){const d=state.data,ls=d.longshotsToday||[];return '<section class="page-intro long-intro"><div><div class="eyebrow">20/1+ EACH-WAY RADAR</div><h2>Longshots</h2><p>'+val(d.longshotsPolicy?.publicNote)+'</p></div><div class="quick-stats"><span><b>'+ls.length+'</b> candidates</span><span><b>'+val(d.longshotsPolicy?.minOdds)+'</b> minimum</span></div></section><div class="rule-note long-rule">'+val(d.longshotsPolicy?.priceRule)+'</div>'+listBlock(ls,"long","No longshots currently qualify.")}
function history(){
 const entries=[...(state.ledger?.entries||[])].sort((a,b)=>String(b.date||'')===String(a.date||'')?
  timeValue(a.time)-timeValue(b.time):String(b.date||'').localeCompare(String(a.date||'')));
 const outcomes=entries.filter(e=>e.result);
 const settled=entries.filter(e=>!['open','unpriced'].includes(settlement(e).status)).length;
 const intro='<section class="page-intro history-intro"><div><div class="eyebrow">PERSISTENT PAPER BET HISTORY</div><h2>Results history</h2><p>Previous selections and results stay here when the daily racecard changes. Tap any horse to review its recorded stake, odds and payout.</p></div><div class="quick-stats"><span><b>'+entries.length+'</b> bets</span><span><b>'+outcomes.length+'</b> results</span><span><b>'+settled+'</b> settled</span></div></section>';
 const rows=entries.map(e=>{
  const result=e.result||null,position=positionOf(e),outcome=settlement(e),stake=Number(e.winStake||0)+Number(e.placeStake||0);
  const done=!['open','unpriced'].includes(outcome.status),pl=outcome.returnAmount-stake;
  const label=position?ordinal(position)+(String(result?.status||'').includes('User reported')?' · reported':''):result?.status?String(result.status):'Pending';
  return '<details class="history-record"><summary><span class="history-time">'+escapeHtml(e.date||'')+' <b>'+escapeHtml(e.time||'')+'</b></span>'+
   '<span class="history-horse"><strong>'+escapeHtml(e.horse)+'</strong><small>'+escapeHtml(e.course||'')+' · '+(e.betType==='win'?'£10 win':'£5 each way')+'</small></span>'+
   '<span class="history-position '+(position===1?'history-won':result?'history-finished':'history-pending')+'">'+escapeHtml(label)+'</span>'+
   '<span class="history-pl '+(done?(pl>=0?'tracker-positive':'tracker-negative'):'')+'">'+(done?signMoney(pl):'Pending')+'</span><span class="history-arrow">⌄</span></summary>'+
   '<div class="history-details"><div>Recorded price <b>'+escapeHtml(e.selectionOdds||'—')+'</b></div>'+
   '<div>Starting price <b>'+escapeHtml(e.settlementOdds||result?.sp||'Not confirmed')+'</b></div>'+
   '<div>Stake <b>'+money(stake)+'</b></div>'+
   '<div>Return <b>'+(done?money(outcome.returnAmount):'Pending confirmation')+'</b></div>'+
   (result?.source?'<p>Result source: '+escapeHtml(result.source)+'</p>':'')+
   (result?.sourceUrl?'<a href="'+escapeHtml(result.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Verify published result ↗</a>':'')+'</div></details>';
 }).join('');
 return intro+'<div class="history-list">'+(rows||'<div class="panel">No recorded bets yet.</div>')+'</div>';
}

function sources(){return '<div class="section-head"><div><h3>Sources</h3><p>Current research and cross-check sources.</p></div></div><div class="source-grid">'+(state.data.sources||[]).map(s=>'<div class="source-card"><h4>'+s.name+'</h4><p><strong>'+s.status+'</strong><br>'+s.role+'</p></div>').join("")+'</div>'}
function rememberOpen(){state.openKeys=new Set([...document.querySelectorAll('.selection-row[open]')].map(x=>x.dataset.key))}
function restoreOpen(){(state.openKeys||new Set()).forEach(k=>{const el=[...document.querySelectorAll('.selection-row')].find(x=>x.dataset.key===k);if(el)el.open=true})}
function render(){if(!state.data)return;rememberOpen();const body=state.view==="today"?today():state.view==="midshots"?midshots():state.view==="longshots"?longshots():state.view==="history"?history():sources();document.querySelector("#app").innerHTML='<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-mark">R</div><div><h1>Racing Intelligence</h1><small>Daily GB + IRE selections</small></div></div><div class="nav">'+nav()+'</div></div></header><main class="main">'+tracker()+liveStatus()+searchPanel()+body+'<div class="footer-note">'+(state.data.liveFeed?.refreshedAt?'Racing feed checked: '+new Date(state.data.liveFeed.refreshedAt).toLocaleString('en-GB',{timeZone:'Europe/London',hour12:false})+' · '+(state.data.liveFeed.provider||'Connected source')+'. ':'Results have been verified against public racing websites where available. Automatic website data collection is not enabled. Prices may be stale. ')+'Displayed selections and results are preserved from the last published snapshot.</div></main>';bind();restoreOpen()}
function bind(){document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});document.querySelector("[data-refresh-results]")?.addEventListener("click",refreshResults)}
function knownResultSignature(){
 if(!state.data||!state.ledger)return '';
 const picks=['todaySelections','midshotsToday','longshotsToday'].flatMap(group=>(state.data[group]||[]).map(x=>[group,x.horse,x.course,x.time,x.result?.position??'',x.result?.status??'',x.result?.sp??'',x.runnerCount??'']));
 const ledgerResults=(state.ledger.entries||[]).map(e=>[e.id,e.result?.position??'',e.result?.status??'',e.result?.sp??'',e.settlementOdds??'',e.runnerCount??'']);
 return JSON.stringify([picks,ledgerResults]);
}
function checkedTime(){
 return new Date().toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
async function refreshResults(){
 if(state.refreshing)return;
 state.refreshing=true;
 state.refreshMessage='Searching the web for fresh race results and checking the betting ledger…';
 const before=knownResultSignature();
 render();
 let fileOk=false,liveOk=false;
 try{
  fileOk=await load(false);
  liveOk=await loadLive();
  await searchRaceResults();
 }finally{
  const newResults=knownResultSignature()!==before;
  state.refreshCheckedAt=new Date().toISOString();
  state.refreshing=false;
  if(newResults)state.refreshMessage='Updated at '+checkedTime()+': results or settlement details changed. Bank and strike rates recalculated.';
  else if(!fileOk)state.refreshMessage='Unable to reload published results. Please check your connection and try again.';
  else if(state.search?.ok)state.refreshMessage='Searched '+state.search.searchCount+' outstanding horses at '+checkedTime()+'. '+state.search.confirmedCount+' results independently corroborated; open Web results search below to inspect sources.';
  else if(state.searchError)state.refreshMessage='Checked published results, but external web search could not complete. '+state.searchError;
  else if(state.live?.connected && liveOk)state.refreshMessage='Checked at '+checkedTime()+': no new confirmed results available.';
  else state.refreshMessage='Checked at '+checkedTime()+': no newer published results. Live feed is not connected; check Sporting Life for the latest results.';
  render();
 }
}
function preservePublishedHistory(incoming,previous){
 if(!previous||incoming?.snapshotDate!==previous?.snapshotDate)return incoming;
 const key=x=>[x.horse,x.course,x.time].join('|').toLowerCase();
 for(const group of ['todaySelections','midshotsToday','longshotsToday']){
  const next=incoming[group]||[],old=previous[group]||[],known=new Map(next.map(x=>[key(x),x]));
  for(const prior of old){
   if(prior.restoredFromPreviousVersion)continue;
   const match=known.get(key(prior));
   // Published selection roster is authoritative: do not resurrect deleted horses.
   if(match&&prior.result&&!match.result)match.result=prior.result;
  }
  incoming[group]=next;
 }
 return incoming;
}
function preserveLedgerHistory(incoming,previous){
 if(!previous)return incoming;
 incoming.entries=incoming.entries||[];
 const byId=new Map(incoming.entries.map(e=>[e.id,e]));
 for(const old of previous.entries||[]){
  if(old.restoredFromPreviousVersion)continue;
  const match=byId.get(old.id);
  // Keep only bets deliberately retained in the published ledger.
  if(match&&old.result&&!match.result)match.result=old.result;
 }
 return incoming;
}

async function load(initial=false){
 try{
  const [r,l]=await Promise.all([fetch("./data/races.json?"+Date.now(),{cache:"no-store"}),fetch("./data/bet-ledger.json?"+Date.now(),{cache:"no-store"})]);
  if(!r.ok||!l.ok)throw new Error("Unable to load betting records");
  const [raceText,ledgerText]=await Promise.all([r.text(),l.text()]);
  const serial=raceText+ledgerText;
  if(initial||serial!==state.serial){state.serial=serial;state.data=preservePublishedHistory(JSON.parse(raceText),state.data);state.ledger=preserveLedgerHistory(JSON.parse(ledgerText),state.ledger);applyLiveResults();applyWebConfirmations();render()}
  return true;
 }catch(e){
  if(initial)document.querySelector("#app").innerHTML='<main class="main"><div class="panel">Unable to load racing data or tracker.</div></main>';
  else console.error(e);
  return false;
 }
}
async function loadLive(){
 try{
  const response=await fetch('./api/live-results',{cache:'no-store'});
  if(!response.ok)throw new Error("Results endpoint unavailable: "+response.status);
  const payload=await response.json();
  const serial=JSON.stringify(payload);
  if(serial!==state.liveSerial){
   state.liveSerial=serial;state.live=payload;applyLiveResults();
   if(state.data)render();
  }
  return payload.connected===true;
 }catch(err){
  console.warn('Live results connection unavailable',err);
  state.live={connected:false,reason:'Could not contact the results source'};
  return false;
 }
}
try{if(typeof localStorage!=='undefined')state.webConfirmed=JSON.parse(localStorage.getItem('racing-verified-web-results-v1')||'{}')}catch(e){state.webConfirmed={}}
load(true).then(loadLive);
setInterval(()=>{if(!document.hidden&&!state.refreshing){load(false).then(loadLive)}},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!state.refreshing){load(false).then(loadLive)}});
