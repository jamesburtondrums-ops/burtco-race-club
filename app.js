const state={data:null,ledger:null,live:null,liveSerial:"",view:"today",filter:"ALL",serial:""};
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
 if(status&&/non.?runner|nr/i.test(status))return {text:"NR",cls:"result-nr"};
 if(status&&/void|abandon|cancel/i.test(status))return {text:String(status),cls:"result-nr"};
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
 const status=String(r.status||'');
 if(/\bnr\b|non.?runner|withdrawn|void|abandon|cancel/i.test(status))return {status:'void',returnAmount:e.winStake+e.placeStake};
 const pos=positionOf(e);
 if(pos===null){if(/fell|pulled.?up|unseated|refused|brought.?down|disqualified|not.?finished|\bdnf\b/i.test(status))return {status:'lost',returnAmount:0};return {status:'open',returnAmount:0};}
 if(pos>1&&e.betType==='win')return {status:'lost',returnAmount:0};
 const odds=decimalOdds(e.settlementOdds)||decimalOdds(e.selectionOdds);
 if(e.betType==='win'){
   if(pos>1)return {status:'lost',returnAmount:0};
   return odds?{status:'won',returnAmount:e.winStake*odds}:{status:'unpriced',returnAmount:0};
 }
 const runnerCount=Number(e.runnerCount);
 const places=runnerCount>0?(runnerCount<=4?1:runnerCount<=7?2:3):Number(e.placesPaid)||null;
 if(pos>1&&places!==null&&pos>places)return {status:'lost',returnAmount:0};
 if(!odds||!places)return {status:'unpriced',returnAmount:0};
 const placeWin=pos<=places;
 const placeReturn=placeWin?e.placeStake*(1+(odds-1)*0.25):0;
 return {status:pos===1?'won':placeWin?'placed':'lost',returnAmount:(pos===1?e.winStake*odds:0)+placeReturn};
}
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
function tracker(){
 const ledger=state.ledger;if(!ledger)return '';
 const entries=ledger.entries||[];const starting=Number(ledger.startingBank)||1000;
 let stakes=0,returns=0,settledStake=0,winners=0,finished=0,pending=0,settledCount=0;
 for(const e of entries){const stake=Number(e.winStake||0)+Number(e.placeStake||0);stakes+=stake;const s=settlement(e);if(s.status==='open'||s.status==='unpriced'){pending+=stake;}else{settledStake+=stake;returns+=s.returnAmount;settledCount++;}
 if(positionOf(e)!==null){finished++;if(positionOf(e)===1)winners++;}
 }
 const balance=starting-stakes+returns;
 const profit=returns-settledStake;
 return '<section class="tracker-panel" aria-label="Paper betting profit tracker"><div class="tracker-heading"><strong>Profit & Strike Rate Tracker</strong><span>Paper betting · '+entries.length+' selections · £10 win / £5 E/W (£10 total)</span></div><div class="tracker-stats">'+
 '<div><span>Bank balance</span><strong>'+money(balance)+'</strong></div>'+
 '<div><span>Settled P/L</span><strong class="'+(profit>=0?'tracker-positive':'tracker-negative')+'">'+(profit>=0?'+':'')+money(profit)+'</strong></div>'+
 '<div><span>Win strike rate</span><strong>'+(finished?(winners/finished*100).toFixed(1)+'%':'—')+'</strong><small>'+winners+' winners / '+finished+' known finishes</small></div>'+
 '<div><span>Open / unpriced stakes</span><strong>'+money(pending)+'</strong><small>'+settledCount+' fully settled bets</small></div>'+
 '</div><p class="tracker-footnote">Starting bank '+money(starting)+' · Total stakes '+money(stakes)+' · Settled returns '+money(returns)+'. Balance includes deductions for open bets; settled P/L excludes them. Win strike rate counts known race finishes, including E/W selections. Each-way pays ¼ odds: 1 place for 1–4 runners, 2 for 5–7, and 3 for 8+. Missing field sizes or prices are not estimated.</p></section>';
}

function nav(){return [["today","Today"],["midshots","Mid Shots 10/1–18/1"],["longshots","Longshots 20/1+"],["sources","Sources"]].map(([v,t])=>'<button class="'+(state.view===v?'active':'')+'" data-view="'+v+'">'+t+'</button>').join("")}
function filters(){const x=["ALL","PRIME","★★★★★","★★★★☆","★★★☆☆","WATCH"];return '<div class="meeting-tabs">'+x.map(f=>'<button data-filter="'+f+'" class="'+(state.filter===f?'active':'')+'">'+f+'</button>').join("")+'</div>'}
function resultBadge(x){const r=resultInfo(x);return r?'<span class="result-badge '+r.cls+'">'+r.text+'</span>':''}
function summaryBadges(x,type){
 if(type==="main"){const p=probabilityOf(x);return '<span class="selection-tier '+(primeOf(x)?'prime':'')+'">'+confidenceLabel(x)+'</span>'+(p!==null?'<span class="probability">'+Number(p).toFixed(1)+'%</span>':'')}
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
   '<div class="source-line">Source: '+val(x.source)+'</div>'+
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
function sources(){return '<div class="section-head"><div><h3>Sources</h3><p>Current research and cross-check sources.</p></div></div><div class="source-grid">'+(state.data.sources||[]).map(s=>'<div class="source-card"><h4>'+s.name+'</h4><p><strong>'+s.status+'</strong><br>'+s.role+'</p></div>').join("")+'</div>'}
function rememberOpen(){state.openKeys=new Set([...document.querySelectorAll('.selection-row[open]')].map(x=>x.dataset.key))}
function restoreOpen(){(state.openKeys||new Set()).forEach(k=>{const el=[...document.querySelectorAll('.selection-row')].find(x=>x.dataset.key===k);if(el)el.open=true})}
function render(){if(!state.data)return;rememberOpen();const body=state.view==="today"?today():state.view==="midshots"?midshots():state.view==="longshots"?longshots():sources();document.querySelector("#app").innerHTML='<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-mark">R</div><div><h1>Racing Intelligence</h1><small>Daily GB + IRE selections</small></div></div><div class="nav">'+nav()+'</div></div></header><main class="main">'+body+'<div class="footer-note">'+(state.data.liveFeed?.refreshedAt?'Racing feed checked: '+new Date(state.data.liveFeed.refreshedAt).toLocaleString('en-GB',{timeZone:'Europe/London',hour12:false})+' · '+(state.data.liveFeed.provider||'Connected source')+'. ':'Live racing feed has not updated this dataset. Prices may be stale until a licensed feed is connected and its scheduled refresh succeeds. ')+'Displayed selections and results are preserved from the last published snapshot.</div></main>';bind();restoreOpen()}
function bind(){document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()})}
async function load(initial=false){
 try{
  const [r,l]=await Promise.all([fetch("./data/races.json?"+Date.now(),{cache:"no-store"}),fetch("./data/bet-ledger.json?"+Date.now(),{cache:"no-store"})]);
  if(!r.ok||!l.ok)throw new Error("Unable to load betting records");
  const [raceText,ledgerText]=await Promise.all([r.text(),l.text()]);
  const serial=raceText+ledgerText;
  if(initial||serial!==state.serial){state.serial=serial;state.data=JSON.parse(raceText);state.ledger=JSON.parse(ledgerText);applyLiveResults();render()}
 }catch(e){if(initial)document.querySelector("#app").innerHTML='<main class="main"><div class="panel">Unable to load racing data or tracker.</div></main>';else console.error(e)}
}
async function loadLive(){
 try{
  const response=await fetch('./api/live-results',{cache:'no-store'});
  if(!response.ok)return;
  const payload=await response.json();
  const serial=JSON.stringify(payload);
  if(serial!==state.liveSerial){
   state.liveSerial=serial;state.live=payload;applyLiveResults();
   if(state.data)render();
  }
 }catch(err){console.warn('Live results connection unavailable',err)}
}
load(true).then(loadLive);
setInterval(()=>{if(!document.hidden){load(false).then(loadLive)}},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){load(false).then(loadLive)}});

