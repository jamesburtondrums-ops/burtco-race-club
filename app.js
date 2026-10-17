import {assessWinConfidence,publicSummary,positivePoints} from './selection-quality.mjs';
const state={data:null,ledger:null,live:null,liveSerial:"",view:"today",filter:"ALL",serial:"",refreshing:false,refreshMessage:"",refreshCheckedAt:null,search:null,searchError:"",webConfirmed:{},searchCheckedAt:null};
const val=v=>v===undefined||v===null||v===""?"—":v;
const contextOf=x=>x.v42||x.v41||null;
const probabilityOf=x=>x.calibratedWinProbability===true?contextOf(x)?.winProbability??null:null;
const primeOf=x=>contextOf(x)?.isPrime===true;
const starsOf=x=>contextOf(x)?.stars??0;
const stars=n=>'<span class="stars">'+Array.from({length:5},(_,i)=>i<n?'★':'☆').join('')+'</span>';
const confidenceLabel=x=>primeOf(x)?"PRIME":String(x.confidenceTier||"").startsWith("CONDITIONAL")?"CONDITIONAL":x.tier==="STRONG"?"STRONG":starsOf(x)?Array.from({length:5},(_,i)=>i<starsOf(x)?"★":"☆").join(""):"WATCH";
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
// Decimal multiplier from an unambiguous fractional quotation.
// 5/2 -> 3.5, i.e. £10 returns £35 including the original stake.
// Favourite markers such as 9/4f are not part of the quoted price.
function decimalOdds(s){
 const text=String(s||'').trim();
 if(!text||/[–~]|\bforecast\b|\bbest\b|\bfrom\b/i.test(text))return null;
 const m=text.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?:\s*(?:f|jf|fav|favourite|joint[- ]favourite))?$/i);
 if(m){
  const n=Number(m[1]),d=Number(m[2]);
  return d>0&&Number.isFinite(n/d)?1+n/d:null;
 }
 if(/^(?:evens?|evs)(?:\s*(?:f|jf|fav|favourite|joint[- ]favourite))?$/i.test(text))return 2;
 return null;
}
const gbp=n=>Math.round((n+Number.EPSILON)*100)/100;
// Best documented paper price across preserved early quote, bookmaker market
// comparison and later SP. This is a hypothetical, NOT an accepted bookmaker bet.
// For live cards the bookmaker observations must be dated and sourced.
function appliedPrice(early,starting,priceBasis,bestAvailable=null){
 const original=decimalOdds(early),sp=decimalOdds(starting),best=decimalOdds(bestAvailable);
 if(priceBasis==='early'){
  if(original===null)return {odds:null,label:null,improved:false};
  const candidates=[{odds:original,label:String(early).trim(),source:'early'},
   {odds:sp,label:String(starting||'').trim(),source:'SP'},
   {odds:best,label:String(bestAvailable||'').trim(),source:'bookmaker'}].filter(x=>x.odds!==null);
  candidates.sort((a,b)=>b.odds-a.odds);
  return {...candidates[0],improved:candidates[0].odds>original};
 }
 return sp!==null?{odds:sp,label:String(starting).trim(),source:'legacy',improved:false}:
  {odds:original,label:original!==null?String(early).trim():null,source:'legacy',improved:false};
}
function entryPrice(entry){
 return appliedPrice(entry.selectionOdds,entry.settlementOdds||entry.result?.sp,entry.priceBasis,entry.bestAvailableOdds);
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
 // Simulate BOG: best of the saved early quote and the reported starting price.
 const odds=entryPrice(e).odds;
 if(!odds)return {status:'unpriced',returnAmount:0};
 if(e.betType==='win')return {status:'won',returnAmount:gbp(Number(e.winStake)*odds)};
 if(!places)return {status:'unpriced',returnAmount:0};
 const placed=pos<=places;
 const fraction=Number.isFinite(Number(e.ewFraction))&&Number(e.ewFraction)>0?Number(e.ewFraction):0.25;
 // Each-way has separate £-denominated WIN and PLACE stakes. Round each component.
 const placeReturn=placed?gbp(Number(e.placeStake)*(1+(odds-1)*fraction)):0;
 const winReturn=pos===1?gbp(Number(e.winStake)*odds):0;
 return {status:pos===1?'won':placed?'placed':'lost',returnAmount:gbp(winReturn+placeReturn)};
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
 const today=state.data?.snapshotDate||new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
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
 const groups=['betSelections','todaySelections','midshotsToday','longshotsToday','lucky15Only'];
 for(const group of groups)for(const pick of state.data[group]||[]){
   const update=updates.find(u=>u.horse===pick.horse&&u.course===pick.course&&u.time===pick.time);
   if(!update)continue;
   pick.result={...pick.result,...update.result,source:state.live.source,updatedAt:state.live.checkedAt};
   if(Number(update.runnerCount)>0)pick.runnerCount=Number(update.runnerCount);
   const type=group==='betSelections'?(pick.betType==='each-way'?'each-way':'win'):group==='todaySelections'?'win':'each-way';
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
 for(const group of ['betSelections','todaySelections','midshotsToday','longshotsToday','lucky15Only'])
  for(const pick of state.data[group]||[]){
   if(pick.result?.position)continue;
   const confirmed=state.webConfirmed[webKey(state.data.snapshotDate,pick.course,pick.time,pick.horse)];
   if(!confirmed||!Number(confirmed.position))continue;
   pick.result={position:confirmed.position,status:'Weighed in',source:confirmed.source,
    sourceUrl:confirmed.verifiedUrls?.[0]||'',updatedAt:confirmed.checkedAt};
   const type=group==='betSelections'?(pick.betType==='each-way'?'each-way':'win'):group==='todaySelections'?'win':'each-way';
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

function lucky15Calc(ticket){
 const rows=ticket.legs.map(leg=>{
  const p=state.data?.snapshotDate===ticket.date?
   ['todaySelections','midshotsToday','longshotsToday','lucky15Only'].flatMap(g=>state.data[g]||[])
    .find(x=>x.horse===leg.horse&&x.course===leg.course&&x.time===leg.time):null;
  const result=p?.result||leg.result||null;
  const count=Number(p?.runnerCount||leg.runnerCount)||null;
  const places=count?(count<=4?1:count<=7?2:3):null;
  const odds=appliedPrice(leg.selectionOdds,leg.settlementOdds||result?.sp,ticket.priceBasis==='early'||leg.priceBasis==='early'?'early':ticket.priceBasis,leg.bestAvailableOdds).odds;
  const pos=Number(result?.position)||null;
  const status=String(result?.status||'');
  let win=null,place=null;
  if(/^(NR|NON.RUNNER|WITHDRAWN|SCRATCHED|VOID|ABANDONED|CANCELLED)$/i.test(status)){win=1;place=1}
  else if(pos>3||(pos&&places&&pos>places)){win=0;place=0}
  else if(pos&&places&&odds){win=pos===1?odds:0;place=pos<=places?1+(odds-1)*Number(ticket.eachWayFraction||0.25):0}
  else if(/^(F|PU|UR|BD|RO|RR|REF|DSQ|DNF|DISQ)$/i.test(status)){win=0;place=0}
  return {...leg,result,places,win,place};
 });
 const stake=Number(ticket.totalStake||30);
 if(rows.some(x=>x.win===null||x.place===null))return {ticket,legs:rows,stake,status:'open',returnAmount:0};
 let payout=0;
 for(let mask=1;mask<16;mask++){
  let wf=1,pf=1;for(let i=0;i<4;i++)if(mask&(1<<i)){wf*=rows[i].win;pf*=rows[i].place}
  // Every combination is a separate win/place bet, paid to the nearest penny.
  const unit=Number(ticket.stakePerLinePerSide||0);
  payout+=gbp(unit*wf)+gbp(unit*pf);
 }
 return {ticket,legs:rows,stake,status:'settled',returnAmount:gbp(payout)};
}
function exoticSummary(){
 const tickets=(state.ledger?.lucky15Tickets||[]).map(lucky15Calc);
 return {tickets,stake:tickets.reduce((a,x)=>a+x.stake,0),
  pendingStake:tickets.filter(x=>x.status==='open').reduce((a,x)=>a+x.stake,0),
  settledStake:tickets.filter(x=>x.status==='settled').reduce((a,x)=>a+x.stake,0),
  returns:tickets.reduce((a,x)=>a+x.returnAmount,0)};
}
function lucky15LegEligible(leg){
 const quote=String(leg.selectionOdds||'').trim();
 const fraction=quote.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
 const strictlyAbove=!!fraction&&Number(fraction[1])/Number(fraction[2])>5.5;
 const withdrawn=/^(NR|NON.RUNNER|WITHDRAWN|SCRATCHED|VOID)$/i.test(String(leg.result?.status||'').trim());
 return strictlyAbove&&!withdrawn;
}
function lucky15Page(){
 const research=state.data?.latestResearchLucky15;
 const newResearchLine=research?'<div class="panel" style="margin-bottom:16px"><h3>Latest research Lucky 15</h3><p>'+research.legs.map(escapeHtml).join(' · ')+'</p><small>'+escapeHtml(research.status)+' The ticket displayed below is the previously recorded paper ticket, retained for audit.</small></div>':'';

 const ticket=(state.ledger?.lucky15Tickets||[]).find(t=>t.date===state.data?.snapshotDate);
 if(!ticket)return newResearchLine+'<div class="panel">No Lucky 15 prepared for this racecard.</div>';
 const x=lucky15Calc(ticket);
 const allPricesEligible=x.legs.length===4&&x.legs.every(lucky15LegEligible);
 const validationText=allPricesEligible?'4 of 4 legs strictly above 11/2 at their recorded reference prices':
  'Ticket does NOT meet the >11/2 non-runner and price rules; check the runners and revise the ticket before use';
 const known=['todaySelections','midshotsToday','longshotsToday','lucky15Only'].flatMap(g=>state.data[g]||[]);
 const rows=x.legs.map((leg,i)=>{
  const pick=known.find(p=>p.horse===leg.horse&&p.course===leg.course&&p.time===leg.time)||{};
  const confidence=leg.confidenceTier||pick.confidenceTier||'Form-based E/W selection';
  const isNearPrime=confidence.includes('NEAR-PRIME')||confidence.includes('FORM-STRONG');
  const label=confidence;
  const placeCount=leg.places?'Top '+leg.places+' paid places':'Final runner count pending';
  const result=leg.result?.position?ordinal(leg.result.position):escapeHtml(leg.result?.status||'Awaiting race');
  const applied=appliedPrice(leg.selectionOdds,leg.settlementOdds||leg.result?.sp,ticket.priceBasis==='early'||leg.priceBasis==='early'?'early':ticket.priceBasis,leg.bestAvailableOdds);
  const later=leg.settlementOdds||leg.result?.sp;
  return '<div class="l15-leg"><b>'+(i+1)+'</b><div><strong>'+escapeHtml(leg.horse)+'</strong>'+
   '<small>'+escapeHtml(leg.course)+' · '+escapeHtml(leg.time)+' · '+placeCount+'</small>'+
   '<small class="'+(isNearPrime?'l15-near-prime':'l15-value')+'">'+escapeHtml(label)+'</small></div>'+
   '<div><strong>'+escapeHtml(applied.label||leg.selectionOdds)+'</strong><small>'+result+'</small>'+
   (later?'<small>SP '+escapeHtml(later)+'</small>':'')+
   (applied.improved?'<small>BOG '+escapeHtml(applied.label)+'</small>':'')+'</div></div>'+
   '<details class="l15-leg-research"><summary>Positive evidence for '+escapeHtml(leg.horse)+'</summary>'+
   '<p>'+escapeHtml(publicSummary(pick))+'</p>'+
   '<ul class="selection-positives">'+positivePoints(pick).map(p=>'<li>'+escapeHtml(p)+'</li>').join('')+'</ul>'+
   (pick.risk?'<details class="l15-review-risk"><summary>Points to monitor</summary><p class="l15-leg-risk">'+escapeHtml(pick.risk)+'</p></details>':'')+
   (pick.sourceUrl?'<a href="'+escapeHtml(pick.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Check published racecard and odds ↗</a>':'')+'</details>';
 }).join('');
 const checkedAt=ticket.updatedAt||state.data?.verifiedAt;
 const checked=checkedAt?new Date(checkedAt).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'overnight';
 return newResearchLine+'<section class="l15-panel"><div class="l15-heading"><div><div class="eyebrow">'+escapeHtml(new Date(ticket.date+"T12:00:00Z").toLocaleDateString("en-GB",{timeZone:"Europe/London",weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase())+' · EARLY PRICE PAPER BET</div>'+
 '<h2>Each-way Lucky 15</h2><p>Four separate races · 15 win combinations and 15 place combinations. Reviewed '+checked+'.</p></div><b>'+money(x.stake)+'</b></div>'+
 '<div class="l15-combinations"><span>4 singles</span><span>6 doubles</span><span>4 trebles</span><span>1 fourfold</span></div>'+
 '<div class="l15-price-rule '+(allPricesEligible?'l15-rule-ok':'l15-rule-warning')+'" role="status"><strong>Strict price floor: greater than 11/2</strong><span>'+validationText+'</span></div>'+
 '<p class="l15-note">£1 each way on 15 combinations = £30 total stake. Every leg is at least 6/1 in this saved, unplaced paper ticket. The higher prices mean lower implied chances and cannot be classified as guaranteed or calibrated Prime tips.</p>'+
 '<p class="l15-note">House settlement policy: ¼ win odds for place returns; 1 place up to 4 runners, 2 places for 5–7, and 3 places for 8+. Actual bookmakers may use different terms.</p>'+
 '<div class="l15-legs">'+rows+'</div><div class="l15-outcome">'+(x.status==='settled'?'Return '+money(x.returnAmount)+' · P/L '+signMoney(x.returnAmount-x.stake):'£30 reserved in paper bank · Settlement pending all four results')+'</div>'+
 '<p class="l15-note">Reference prices may change, and real bookmakers can pay different place terms. Recheck all four runners, accepted prices and each-way places before treating the draft ticket as eligible. This is a virtual tracking ticket, not an actual bookmaker bet. All paper tickets from 9 October use the early prices saved when the selections were published; later SPs are shown for comparison only. Non-runners use provisional unit-factor treatment.</p></section>';
}

function tracker(){
 const ledger=state.ledger;
 if(!ledger)return '';
 const entries=ledger.entries||[];
 const stats=trackerStats(entries);
 const combos=exoticSummary();
 const starting=Number(ledger.startingBank??1000);
 const bank=starting-stats.totalStake-combos.stake+stats.totalReturn+combos.returns;
 const settledBank=starting+stats.profit+combos.returns-combos.settledStake;
 const combinedProfit=stats.profit+combos.returns-combos.settledStake;
 const settledStakes=stats.settledStake+combos.settledStake;
 const roi=settledStakes?combinedProfit/settledStakes*100:null;
 const winRate=stats.known?stats.winCount/stats.known*100:null;
 const ewRate=stats.ewKnown?stats.ewPlaced/stats.ewKnown*100:null;
 const today=stats.todayKnown?stats.todayWins+'/'+stats.todayKnown+' ('+(stats.todayWins/stats.todayKnown*100).toFixed(1)+'%)':'Awaiting finished races';
 const rate=v=>v===null?'—':v.toFixed(1)+'%';
 return '<section class="tracker-panel" aria-label="Live paper betting profit and strike rate">'+
 '<div class="tracker-heading"><div><strong>Profit & strike-rate tracker</strong><span class="tracker-kicker">£1,000 starting bank · £10 win or £5 each-way · '+entries.length+' singles recorded · '+combos.tickets.length+' Lucky 15 ticket</span></div><span class="tracker-live-label">'+(state.live?.connected?'Live result checks active':'Web-verified results · automatic updates not active')+'</span></div>'+
 '<div class="tracker-toolbar"><button type="button" data-refresh-results class="refresh-results-btn" '+(state.refreshing?'disabled aria-busy="true"':'')+'>'+(state.refreshing?'Checking results…':'↻ Refresh race results')+'</button><a class="tracker-source-link" href="https://www.sportinglife.com/racing/fast-results" target="_blank" rel="noopener noreferrer">Sporting Life fast results ↗</a></div>'+
 '<p class="tracker-refresh-message" aria-live="polite" role="status">'+(state.refreshMessage||'Refresh checks for newly published results; the public source link opens separately.')+'</p>'+
 '<div class="tracker-stats">'+
 '<div><span>Available bank</span><strong>'+money(bank)+'</strong><small>After all stakes and credited returns</small></div>'+
 '<div><span>Settled profit / loss</span><strong class="'+(combinedProfit>=0?'tracker-positive':'tracker-negative')+'">'+signMoney(combinedProfit)+'</strong><small>'+stats.settled+' settled · '+(roi===null?'—':rate(roi))+' return on settled stakes</small></div>'+
 '<div><span>Win strike rate</span><strong>'+rate(winRate)+'</strong><small>'+stats.winCount+' winners from '+stats.known+' known outcomes</small></div>'+
 '<div><span>Each-way place rate</span><strong>'+rate(ewRate)+'</strong><small>'+stats.ewPlaced+' placed from '+stats.ewKnown+' known E/W outcomes</small></div>'+
 '</div><div class="tracker-bottom"><div><span>Running bank after settled bets:</span> <b>'+money(settledBank)+'</b></div><div><span>Outstanding / unpriced stakes:</span> <b>'+money(stats.openStake+combos.pendingStake)+'</b></div><div><span>Today’s strike rate:</span> <b>'+today+'</b></div></div>'+
 '<p class="tracker-footnote">Total stakes '+money(stats.totalStake+combos.stake)+' (including '+money(combos.stake)+' Lucky 15) · Credited returns '+money(stats.totalReturn+combos.returns)+' · Non-runners refunded. Each-way returns: ¼ odds, 1 paid place for 1–4 runners, 2 for 5–7, and 3 for 8+. Only confirmed results count toward strike rates; missing prices or field sizes remain unresolved. Paper returns use the highest documented pre-race researched quote, subsequently sourced bookmaker offer or reported SP. Actual execution, BOG qualification and bookmaker each-way terms are NOT verified. Original research quotes remain unchanged. All credited returns include original stake. Historical paper simulations only.</p>'+
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

// Only one featured runner per race across WIN, Mid Shots and Longshots.
// For safety if future content accidentally overlaps, higher-ranked sections win.
// This changes presentation only; archived paper-bet results are never mutated.
function exclusiveSelectionGroups(){
 const d=state.data||{},sections=['todaySelections','midshotsToday','longshotsToday','lucky15Only'];
 const featured={todaySelections:[],midshotsToday:[],longshotsToday:[],lucky15Only:[]};
 const races=new Set(),horses=new Set();
 for(const section of sections)for(const p of d[section]||[]){
  if(!p||!p.horse||!p.course||!p.time)continue;
  if(section==='todaySelections'&&(p.raceDayReview?.action==='withdraw-win'||!assessWinConfidence(p).qualified))continue;
  const race=String(p.course).trim().toLowerCase()+'|'+String(p.time).trim();
  const horse=String(p.horse).trim().toLowerCase();
  if(races.has(race)||horses.has(horse))continue;
  races.add(race);horses.add(horse);featured[section].push(p);
 }
 return featured;
}

function nav(){return [["today","Bet Selections"],["racecards","All runners"],["history","Results history"],["sources","Sources"]].map(([v,t])=>'<button class="'+(state.view===v?'active':'')+'" data-view="'+v+'">'+t+'</button>').join("")}
function filters(){const x=["ALL","PRIME","STRONG","CONDITIONAL","WATCH"];return '<div class="meeting-tabs">'+x.map(f=>'<button data-filter="'+f+'" class="'+(state.filter===f?'active':'')+'">'+f+'</button>').join("")+'</div>'}
function resultBadge(x){const r=resultInfo(x);return r?'<span class="result-badge '+r.cls+'">'+r.text+'</span>':''}
function summaryBadges(x,type){
 if(type==="main"){const q=assessWinConfidence(x);return '<span class="selection-tier strong">'+escapeHtml(q.level)+' WIN CONTENDER</span>'+(x.winRank?'<span class="selection-tier mid">'+escapeHtml(x.winRank)+'</span>':'');}
 if(type==="mid")return '<span class="selection-tier mid">'+(x.view||"MID-SHOT")+'</span>';
 return '<span class="selection-tier long">'+(x.placeView||"E/W")+'</span>';
}
function commonDetails(x){
 const q=contextOf(x);
 return '<div class="detail-grid">'+
   (q?(x.calibratedWinProbability===true&&q.winProbability!==undefined?'<div class="detail-stat"><span>Calibrated win probability</span><b>'+Number(q.winProbability).toFixed(1)+'%</b></div>':'')+'<div class="detail-stat"><span>Market rank</span><b>'+val(q.marketRank?'#'+q.marketRank:null)+'</b></div><div class="detail-stat"><span>Coverage</span><b>'+val(q.criticalCoverage!==undefined?q.criticalCoverage+'%':null)+'</b></div><div class="detail-stat"><span>Predictability</span><b>'+val(q.racePredictability!==undefined?q.racePredictability+'/100':null)+'</b></div>':'')+
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
 const intro=publicSummary(x);
 const points=positivePoints(x);
 const liveReview=x.raceDayReview||null;
 const liveReviewBrief=liveReview?.headline?'<p><strong>Latest race-day check:</strong> '+escapeHtml(liveReview.headline)+'</p>':'';
 const brief='<div class="selection-brief"><p>'+escapeHtml(intro)+'</p>'+liveReviewBrief+
   (points.length?'<ul class="selection-positives">'+points.map(p=>'<li>'+escapeHtml(p)+'</li>').join('')+'</ul>':'')+'</div>';
 const risk=x.risk||"—";
 const liveReviewSources=liveReview?.sourceUrls?.filter(u=>typeof u==='string'&&/^https:\/\//.test(u)).slice(0,4).map((u,i)=>'<a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(u)+'">Current source '+(i+1)+' ↗</a>').join(' · ')||'';
 const liveReviewDetails=liveReview?.detail?'<div class="selection-confidence-note"><strong>Race-day recheck · '+escapeHtml(liveReview.status||'reviewed')+' · '+escapeHtml(liveReview.checkedAt?new Date(liveReview.checkedAt).toLocaleString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'}):'')+'</strong><span>'+escapeHtml(liveReview.detail)+'</span>'+(liveReview?.observedPrice?'<span>Observed current odds: '+escapeHtml(liveReview.observedPrice)+' (original price preserved)</span>':'')+(liveReviewSources?'<span>'+liveReviewSources+'</span>':'')+'</div>':'';
 const special=type==="mid"?'<div class="ew-view"><strong>'+val(x.view)+'</strong><small>'+val(x.terms)+'</small></div>':type==="long"?'<div class="ew-view"><strong>'+val(x.placeView)+'</strong><small>'+val(x.terms)+'</small></div>':'';
 const typeStars=type==="mid"&&x.midStars?stars(x.midStars):type==="long"&&x.ewStars?stars(x.ewStars):'';
 const bet=(state.ledger?.entries||[]).find(e=>e.id===[state.data.snapshotDate,x.course,x.time,x.horse,type==="main"?"win":"each-way"].join("|").toLowerCase());
 const settled=bet?settlement(bet):null;
 const stake=bet?Number(bet.winStake||0)+Number(bet.placeStake||0):0;
 const profit=settled&& !["open","unpriced"].includes(settled.status)?settled.returnAmount-stake:null;
 const chosen=bet?entryPrice(bet):null;
 const betLine=bet?'<div class="bet-line"><b>Paper bet: '+(bet.betType==="win"?"£10 WIN":"£5 E/W (£10 total)")+'</b><span>Early price: '+escapeHtml(val(bet.selectionOdds))+'</span>'+
 (bet.settlementOdds||bet.result?.sp?'<span>Reported SP: '+escapeHtml(val(bet.settlementOdds||bet.result.sp))+'</span>':'')+
 (bet.bestAvailableOdds?'<span>Best documented bookmaker price: '+escapeHtml(bet.bestAvailableOdds)+'</span>':'')+
 (chosen?.label?'<span>Return calculated at: '+escapeHtml(chosen.label)+(chosen.improved?' (best available)':'')+'</span>':'')+
 '<span>'+(profit!==null?'Return '+money(settled.returnAmount)+' · P/L '+(profit>=0?'+':'')+money(profit):'Settlement pending / terms unverified')+'</span></div>':'';

 return '<details class="selection-row" data-key="'+k+'"><summary class="selection-summary">'+
   '<div class="selection-time">'+val(x.time)+'</div>'+
   '<div class="selection-main"><div class="selection-name-line"><strong>'+val(x.horse)+'</strong>'+summaryBadges(x,type)+'</div><span>'+val(x.course)+'</span></div>'+
   '<div class="selection-odds"><span>'+((x.result?.status==='NR')?'Non-runner':'Best documented odds')+'</span><strong>'+escapeHtml((x.result?.status==='NR')?'NR':((bet&&entryPrice(bet).label)||x.bestAvailableOdds?.odds||x.currentOdds||x.odds))+'</strong></div>'+
   '<div class="selection-result">'+resultBadge(x)+'</div>'+
   '<div class="selection-chevron">⌄</div>'+brief+
 '</summary><div class="selection-details">'+betLine+typeStars+special+liveReviewDetails+commonDetails(x)+
   (x.confidenceTier?'<div class="selection-confidence-note"><strong>Confidence assessment</strong><span>'+escapeHtml(x.confidenceTier)+'</span></div>':'')+
   '<div class="detail-risk"><strong>Points to monitor</strong><p>'+escapeHtml(risk)+'</p></div>'+
   (x.currentOdds&&x.currentOdds!==x.odds?'<div class="source-line">Original recorded price: '+val(x.odds)+' · Morning reference price: '+val(x.currentOdds)+'</div>':'')+
   '<div class="source-line">Source: '+escapeHtml(val(x.source))+(x.sourceUrl?' · <a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(x.sourceUrl)+'">Verify racecard and form ↗</a>':'')+(x.result?.sourceUrl?' · <a target="_blank" rel="noopener noreferrer" href="'+x.result.sourceUrl+'">Verify result ↗</a>':'')+'</div>'+
 '</div></details>';
}
function listBlock(items,type,emptyText){const sorted=chronological(items);return sorted.length?'<div class="selection-list">'+sorted.map(x=>selectionRow(x,type)).join("")+'</div>':'<div class="panel"><p class="meta">'+emptyText+'</p></div>'}
function morningCheckPanel(){
 const review=state.data?.morningRecheck;if(!review)return '';
 const checked=review.updatedAt?new Date(review.updatedAt).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'recently';
 const changes=(review.adjustments||[]).map(a=>escapeHtml(a.course)+' '+escapeHtml(a.time)+' · '+(a.oldRunners?('field '+a.oldRunners+' → '):'')+a.currentRunners+' declared'+(a.note?' ('+escapeHtml(a.note)+')':'')).join(' · ');
 return '<section class="morning-check"><div><strong>Morning racecard recheck</strong><span>Reviewed '+checked+' · '+review.meetingCount+' meetings / '+review.scheduledRaces+' races</span></div>'+
 '<p>Newmarket: '+escapeHtml(review.going?.Newmarket||'going to confirm')+'. York: '+escapeHtml(review.going?.York||'going to confirm')+'. '+changes+'.</p>'+
 '<small>Morning selections are conditional: late non-runners, changing ground and bookmaker odds can alter suitability. Market strength is not a guaranteed win percentage.</small></section>';
}
// Retrospective diagnostic only: excluded runners never become selections,
// and never enter the published paper-bet bankroll or strike-rate.
function missedSelectionsReview(){
 const review=state.data?.removedSelectionReview;
 if(!review?.runners?.length)return '';
 const rows=review.runners.map(x=>'<tr><td><strong>'+escapeHtml(x.horse)+'</strong><small style="display:block;color:var(--muted)">'+escapeHtml(x.course)+' · '+escapeHtml(x.time)+'</small></td>'+
 '<td>'+escapeHtml(ordinal(x.position))+'</td><td>'+escapeHtml(x.sp||'—')+'</td>'+
 '<td>'+escapeHtml(x.source)+'</td></tr>').join('');
 return '<section class="panel" aria-label="Retrospective removed selection analysis"><h3>Removed candidates — results review</h3>'+
 '<p>These horses were considered and removed before racing. They are <strong>not</strong> current selections, credited winners or paid paper bets. Their subsequent placings are recorded to evaluate our exclusions without rewriting the original shortlist.</p>'+
 '<div class="table-wrap" style="overflow-x:auto"><table><thead><tr><th>Horse</th><th>Finish</th><th>SP</th><th>Verification</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<p class="meta">One horse per featured race remains the rule. Outcomes reported by the user are labelled separately from independently verified racing results.</p></section>';
}
function today(){
 const d=state.data||{}, picks=chronological(d.betSelections||[]);
 const review=d.fiveDayAnalysis||null;
 const audit=review?'<section class="panel bet-audit"><h3>Five-day model review</h3><p>12–16 October: the key correction is that older course history, rival withdrawals and market moves must not outweigh current class, weight, going, pace and opponent assessment.</p><div class="bet-audit-days">'+(review.days||[]).map(day=>'<span><strong>'+escapeHtml(day.date.slice(5))+'</strong> '+day.winners+'/'+day.runners+' winners</span>').join('')+'</div><p class="meta">Monday had a separate earlier selection list. Wednesday excludes two non-runners. Five days of changing shortlists do not establish a calibrated forecast, and historical paper bets are unchanged.</p></section>':'';
 const cards=picks.map(x=>{
  const isEw=x.betType==='each-way',points=(x.positivePoints||[]).map(p=>'<li>'+escapeHtml(p)+'</li>').join('');
  const review=x.raceDayReview||null;
  const analysis=review?.headline||x.summary;
  const risks=review?.detail||x.risk;
  const rivals=review?.rivals?.length?'<div class="bet-comparison"><b>Closest ratings:</b> '+review.rivals.map(r=>escapeHtml(r.horse)+' (OR '+escapeHtml(r.or)+' / RPR '+escapeHtml(r.rpr)+')').join(' · ')+'</div>':'';
  const nonRunners=review?.nonRunners?.length?'<span class="bet-nonrunner">Confirmed NR: '+review.nonRunners.map(escapeHtml).join(', ')+'</span>':'';
  const isUpdated=x.currentOdds&&x.currentOdds!==x.odds;
  const morningLabel=review?.checkedAt?'<small class="bet-morning-label">Morning form and field rechecked · '+new Date(review.checkedAt).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'})+'</small>':'';
  return '<article class="bet-selection-card"><div class="bet-selection-top"><span class="bet-selection-time">'+escapeHtml(x.time)+'</span><span class="bet-selection-type '+(isEw?'is-ew':'is-win')+'">'+(isEw?'EACH WAY':'WIN')+'</span></div>'+
  '<div class="bet-selection-main"><div><h3>'+escapeHtml(x.horse)+'</h3><p>'+escapeHtml(x.raceClass)+' · '+escapeHtml(x.distance)+' · '+escapeHtml(x.going)+'</p></div><div class="bet-selection-price"><span>Morning quote</span><strong>'+escapeHtml(x.currentOdds||x.odds)+'</strong>'+(isUpdated?'<small>Previously '+escapeHtml(x.odds)+'</small>':'')+'</div></div>'+
  '<div class="bet-selection-meta"><span>Jockey: '+escapeHtml(x.jockey)+'</span><span>Trainer: '+escapeHtml(x.trainer)+'</span><span>Field: '+escapeHtml(x.runnerCount)+'</span>'+(x.or!==undefined?'<span>OR '+escapeHtml(x.or)+'</span>':'')+(x.rpr!==undefined?'<span>RPR '+escapeHtml(x.rpr)+'</span>':'')+'</div>'+
  '<p class="bet-selection-summary">'+escapeHtml(analysis)+'</p>'+morningLabel+
  '<details class="bet-selection-details"><summary>Evidence, rivals and risks</summary><ul>'+points+'</ul>'+rivals+'<p><strong>Assessment risk:</strong> '+escapeHtml(risks)+'</p></details>'+
  '<div class="bet-selection-bottom">'+nonRunners+resultBadge(x)+'<a href="'+escapeHtml(x.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Racecard data ↗</a>'+(isEw?'<small>Check bookmaker each-way terms and paid places</small>':'')+'</div></article>';
 }).join('');;
 return '<section class="page-intro"><div><div class="eyebrow">'+escapeHtml(d.snapshotDate||'')+' · ASCOT CHAMPIONS DAY</div><h2>Bet Selections</h2><p>One horse per race, with the bet type shown directly beside each selection. Horse/race data determines confidence, independently of price or favouritism.</p></div><div class="quick-stats"><span><b>'+picks.length+'</b> selections</span><span><b>'+picks.filter(p=>p.betType==='win').length+'</b> WIN</span><span><b>'+picks.filter(p=>p.betType==='each-way').length+'</b> EACH WAY</span></div></section>'+
  '<div class="bet-selection-notice">PRE-RACE RESEARCH · Current going: GOOD. Prices are observations, not accepted bets. Check non-runners, going and bookmaker place terms before the off. No new wagers have been recorded.</div>'+
  '<div class="bet-selection-grid">'+(cards||'<div class="panel">No selections published yet.</div>')+'</div>'+audit;
}
function midshots(){const d=state.data||{},ms=exclusiveSelectionGroups().midshotsToday;return '<section class="page-intro mid-intro"><div><div class="eyebrow">6/1–18/1 FORM + E/W RADAR</div><h2>Mid Shots</h2><p>'+val(d.midshotsPolicy?.publicNote)+'</p></div><div class="quick-stats"><span><b>'+ms.length+'</b> unique race selections</span><span><b>6/1–18/1</b> reference price band</span></div></section><div class="rule-note mid-rule">'+val(d.midshotsPolicy?.priceRule)+'</div>'+listBlock(ms,"mid","No distinct mid-shot selection currently qualifies.") }
function longshots(){const d=state.data||{},ls=exclusiveSelectionGroups().longshotsToday;return '<section class="page-intro long-intro"><div class="eyebrow">20/1+ EACH-WAY RADAR</div><h2>Longshots</h2><p>'+val(d.longshotsPolicy?.publicNote)+'</p><div class="quick-stats"><span><b>'+ls.length+'</b> unique race selections</span><span><b>'+val(d.longshotsPolicy?.minOdds)+'</b> minimum reference price</span></div></section><div class="rule-note long-rule">'+val(d.longshotsPolicy?.priceRule)+'</div>'+listBlock(ls,"long","No distinct longshot selection currently qualifies.") }
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
   '<div class="history-details"><div>Researched early price <b>'+escapeHtml(e.selectionOdds||'—')+'</b></div>'+
   '<div>Reported starting price <b>'+escapeHtml(e.settlementOdds||result?.sp||'Not confirmed')+'</b></div>'+
   '<div>Price used for return <b>'+escapeHtml(entryPrice(e).label||'Not priced')+(entryPrice(e).improved?' (BOG)':'')+'</b></div>'+
   '<div>Paper settlement <b>'+(e.priceBasis==='early'?'Simulated Best Odds Guaranteed':'Legacy historical terms')+'</b></div>'+
   '<div>Stake <b>'+money(stake)+'</b></div>'+
   '<div>Return <b>'+(done?money(outcome.returnAmount):'Pending confirmation')+'</b></div>'+
   (result?.source?'<p>Result source: '+escapeHtml(result.source)+'</p>':'')+
   (result?.sourceUrl?'<a href="'+escapeHtml(result.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Verify published result ↗</a>':'')+'</div></details>';
 }).join('');
 const archive=(state.ledger?.researchWatchHistory||[]).map(x=>'<section class="panel"><h3>'+escapeHtml(x.date)+' Verified results review</h3><p>'+escapeHtml(x.summary)+'</p><p>'+x.selected.map(p=>escapeHtml(p.horse)+' '+ordinal(p.position)+' ('+escapeHtml(p.sp)+' SP)').join(' · ')+'</p><small>Removed candidates are research-only; excluded from paper profit.</small></section>').join('');
 return intro+archive+'<div class="history-list">'+(rows||'<div class="panel">No recorded bets yet.</div>')+'</div>';
}

function allRunners(){
 const meetings=state.data?.racecardLinks||[];
 return '<section class="page-intro"><div><div class="eyebrow">'+escapeHtml(state.data?.snapshotDate||'')+' · COMPLETE MEETING CARDS</div><h2>All runners</h2><p>Explore every declared runner and jockey in '+meetings.length+' British and Irish meetings. The betting shortlist is deliberately much smaller, and all runners are linked directly to published racecards.</p></div><div class="quick-stats"><span><b>'+meetings.length+'</b> meetings</span><span><b>'+meetings.reduce((x,m)=>x+m.races,0)+'</b> races</span></div></section>'+
 morningCheckPanel()+'<div class="racecards-grid">'+meetings.map(m=>'<a class="racecards-meeting" href="'+escapeHtml(m.url)+'" target="_blank" rel="noopener noreferrer"><strong>'+escapeHtml(m.course)+'</strong><span>'+m.races+' races · '+escapeHtml(m.first)+'–'+escapeHtml(m.last)+'</span><small>'+escapeHtml(m.going)+'</small><b>See all declared runners ↗</b></a>').join('')+'</div>'+
 '<p class="racecards-note">These links open published racecards and include the complete list of runners, riders, draw, form and market prices. Late non-runners and changes remain possible.</p>';
}

function sources(){return '<div class="section-head"><div><h3>Sources</h3><p>Current research and cross-check sources.</p></div></div><div class="source-grid">'+(state.data.sources||[]).map(s=>'<div class="source-card"><h4>'+s.name+'</h4><p><strong>'+s.status+'</strong><br>'+s.role+'</p></div>').join("")+'</div>'}
function rememberOpen(){state.openKeys=new Set([...document.querySelectorAll('.selection-row[open]')].map(x=>x.dataset.key))}
function restoreOpen(){(state.openKeys||new Set()).forEach(k=>{const el=[...document.querySelectorAll('.selection-row')].find(x=>x.dataset.key===k);if(el)el.open=true})}
function render(){if(!state.data)return;rememberOpen();const body=state.view==="today"?today():state.view==="midshots"?midshots():state.view==="longshots"?longshots():state.view==="lucky15"?lucky15Page():state.view==="racecards"?allRunners():state.view==="history"?history():sources();document.querySelector("#app").innerHTML='<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-mark">R</div><div><h1>Racing Intelligence</h1><small>Ascot Champions Day · Bet Selections</small></div></div><div class="nav">'+nav()+'</div><a class="office-entry" href="./backoffice.html" aria-label="Open PIN-protected back office">Back Office ↗</a></div></header><main class="main">'+tracker()+(state.data?.lucky15Plan&&state.view!=="lucky15"?'<div class="l15-shortcut">E/W Lucky 15 prepared · four runners · £30 paper ticket <button data-view="lucky15">View ticket →</button></div>':'')+liveStatus()+searchPanel()+body+'<div class="footer-note">'+(state.data.liveFeed?.refreshedAt?'Racing feed checked: '+new Date(state.data.liveFeed.refreshedAt).toLocaleString('en-GB',{timeZone:'Europe/London',hour12:false})+' · '+(state.data.liveFeed.provider||'Connected source')+'. ':'Results have been verified against public racing websites where available. Automatic website data collection is not enabled. Prices may be stale. ')+'Displayed selections and results are preserved from the last published snapshot.</div></main>';bind();restoreOpen()}
function bind(){document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});document.querySelector("[data-refresh-results]")?.addEventListener("click",refreshResults)}
function knownResultSignature(){
 if(!state.data||!state.ledger)return '';
 const picks=['betSelections','todaySelections','midshotsToday','longshotsToday','lucky15Only'].flatMap(group=>(state.data[group]||[]).map(x=>[group,x.horse,x.course,x.time,x.result?.position??'',x.result?.status??'',x.result?.sp??'',x.runnerCount??'']));
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
 for(const group of ['betSelections','todaySelections','midshotsToday','longshotsToday']){
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
