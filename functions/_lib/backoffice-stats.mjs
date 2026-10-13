// Shared pure analytics. Used by Cloudflare Pages and scheduled GitHub checks.
const number=v=>Number(v)||0;
// 5/2 -> 3.5 total-return multiplier including original stake.
// Favourite indicators (F/JF) are accepted; ambiguous ranges or forecasts are not.
const price=s=>{
 const v=String(s||'').trim();
 if(!v||/[–~]|\bforecast\b|\bbest\b|\bfrom\b/i.test(v))return null;
 const m=v.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?:\s*(?:f|jf|fav|favourite|joint[- ]favourite))?$/i);
 if(m){const n=Number(m[1]),d=Number(m[2]);return d>0&&Number.isFinite(n/d)?1+n/d:null}
 return /^(?:evens?|evs)(?:\s*(?:f|jf|fav|favourite|joint[- ]favourite))?$/i.test(v)?2:null;
};
// Simulated paper BOG: preserve the original early price and use the reported SP
// only when it is longer. This makes no claim of eligibility for a real bookmaker.
function appliedPrice(early,starting,priceBasis){
 const original=price(early),sp=price(starting);
 if(priceBasis==='early'){
  if(original===null)return {odds:null,label:null,improved:false};
  return sp!==null&&sp>original?
   {odds:sp,label:String(starting).trim(),improved:true}:
   {odds:original,label:String(early).trim(),improved:false};
 }
 return sp!==null?{odds:sp,label:String(starting).trim(),improved:false}:
  {odds:original,label:original!==null?String(early).trim():null,improved:false};
}
const position=e=>{
 const x=e.result?.position??e.result?.place;const n=Number(x);
 return x===null||x===undefined||x===''||!Number.isFinite(n)||n<=0?null:n;
};
const nr=s=>/^(NR|NON.RUNNER|WITHDRAWN|SCRATCHED|VOID|ABANDONED|CANCELLED)$/i.test(s)||/non.?runner|withdrawn|void|abandon|cancel/i.test(s);
const dnf=s=>/^(F|PU|UR|BD|RO|RR|REF|DSQ|DNF|DISQ|UNPLACED)$/i.test(s)||/fell|pulled.?up|unseated|refused|brought.?down|disqualified|not.?finished/i.test(s);
const fixed=n=>Math.round((n+Number.EPSILON)*100)/100;
export function settleEntry(entry){
 const r=entry.result;if(!r)return {status:'open',returns:0};
 const status=String(r.status||'').trim();
 const stake=number(entry.winStake)+number(entry.placeStake);
 if(nr(status))return {status:'void',returns:stake};
 const pos=position(entry);
 if(pos===null)return dnf(status)?{status:'lost',returns:0}:{status:'open',returns:0};
 if(entry.betType==='win'&&pos!==1)return {status:'lost',returns:0};
 const count=number(entry.runnerCount);
 const places=count>0?(count<=4?1:count<=7?2:3):(number(entry.placesPaid)||null);
 if(entry.betType==='each-way'&&(places!==null?pos>places:pos>3))return {status:'lost',returns:0};
 const odds=appliedPrice(entry.selectionOdds,entry.settlementOdds||r.sp,entry.priceBasis).odds;
 if(!odds)return {status:'unpriced',returns:0};
 if(entry.betType==='win')return {status:'won',returns:fixed(number(entry.winStake)*odds)};
 if(!places)return {status:'unpriced',returns:0};
 const placed=pos<=places;
 const fraction=number(entry.ewFraction)>0?number(entry.ewFraction):0.25;
 const winReturn=pos===1?fixed(number(entry.winStake)*odds):0;
 const placeReturn=placed?fixed(number(entry.placeStake)*(1+(odds-1)*fraction)):0;
 return {status:pos===1?'won':placed?'placed':'lost',returns:fixed(winReturn+placeReturn)};
}
function ticketLegValue(leg,ticket){
 const r=leg.result,status=String(r?.status||'').trim();
 if(!r)return {win:null,place:null};
 if(nr(status))return {win:1,place:1};
 const pos=position({result:r});
 const count=number(leg.runnerCount),places=count?(count<=4?1:count<=7?2:3):null;
 const odds=appliedPrice(leg.selectionOdds,leg.settlementOdds||r?.sp,ticket.priceBasis==='early'||leg.priceBasis==='early'?'early':ticket.priceBasis).odds;
 if(pos>3||(pos&&places&&pos>places))return {win:0,place:0};
 if(pos&&places&&odds)return {win:pos===1?odds:0,place:pos<=places?1+(odds-1)*(number(ticket.eachWayFraction)||.25):0};
 if(dnf(status))return {win:0,place:0};
 return {win:null,place:null};
}
export function settleTicket(ticket){
 const stake=number(ticket.totalStake)||30,legs=(ticket.legs||[]).map(leg=>ticketLegValue(leg,ticket));
 if(legs.length!==4||legs.some(x=>x.win===null||x.place===null))
  return {status:'open',stake,returns:0};
 let returns=0;
 for(let mask=1;mask<16;mask++){
  let win=1,place=1;for(let i=0;i<4;i++)if(mask&(1<<i)){win*=legs[i].win;place*=legs[i].place}
  const unit=number(ticket.stakePerLinePerSide);
  returns+=fixed(unit*win)+fixed(unit*place);
 }
 return {status:'settled',stake,returns:fixed(returns)};
}
export function summarizeDay(ledger,date){
 const entries=(ledger.entries||[]).filter(x=>x.date===date);
 const tickets=(ledger.lucky15Tickets||[]).filter(x=>x.date===date);
 const result={
  date,selectionCount:entries.length,winPicks:0,ewPicks:0,longshots:0,
  resultCount:0,winners:0,winStrikeRate:null,
  eachWayRunners:0,eachWayPlaced:0,ewPlaceRate:null,
  settled:0,voided:0,pending:0,stakes:0,settledStakes:0,returns:0,
  settledProfit:0,availableAfterStakes:0,unresolvedStakes:0,
  comboTickets:tickets.length,comboStakes:0,comboReturns:0,
  byCategory:{win:{bets:0,settled:0,profit:0},midshot:{bets:0,settled:0,profit:0},longshot:{bets:0,settled:0,profit:0}}
 };
 for(const e of entries){
  const stake=number(e.winStake)+number(e.placeStake),out=settleEntry(e);
  result.stakes+=stake;result.returns+=out.returns;
  const category=e.betType==='win'?'win':(price(e.selectionOdds)>=21?'longshot':'midshot');
  result.byCategory[category].bets++;
  if(e.betType==='win')result.winPicks++;else result.ewPicks++;
  if(category==='longshot')result.longshots++;
  if(out.status==='open'||out.status==='unpriced'){result.pending++;result.unresolvedStakes+=stake}
  else{
   result.settled++;result.settledStakes+=stake;
   result.byCategory[category].settled++;
   result.byCategory[category].profit+=out.returns-stake;
   if(out.status==='void')result.voided++;
  }
  const status=String(e.result?.status||'');
  const p=position(e);
  if(p!==null||dnf(status)){
   result.resultCount++;
   if(p===1)result.winners++;
   if(e.betType==='each-way'){
    const count=number(e.runnerCount);
    const places=count?(count<=4?1:count<=7?2:3):number(e.placesPaid)||null;
    if(places){
     result.eachWayRunners++;
     if(p&&p<=places)result.eachWayPlaced++;
    }
   }
  }
 }
 for(const ticket of tickets){
  const resultTicket=settleTicket(ticket);
  result.comboStakes+=resultTicket.stake;
  result.comboReturns+=resultTicket.returns;
  if(resultTicket.status==='settled'){
   result.settled++;result.settledStakes+=resultTicket.stake;
  }else {result.pending++;result.unresolvedStakes+=resultTicket.stake}
 }
 result.stakes+=result.comboStakes;
 result.returns+=result.comboReturns;
 result.settledProfit=fixed(result.returns-result.settledStakes);
 result.winStrikeRate=result.resultCount?fixed(result.winners/result.resultCount*100):null;
 result.ewPlaceRate=result.eachWayRunners?fixed(result.eachWayPlaced/result.eachWayRunners*100):null;
 for(const c of Object.values(result.byCategory))c.profit=fixed(c.profit);
 for(const k of ['stakes','settledStakes','returns','comboStakes','comboReturns','unresolvedStakes'])result[k]=fixed(result[k]);
 return result;
}
export function dailyReports(ledger){
 const dates=[...new Set([...(ledger.entries||[]).map(e=>e.date),...(ledger.lucky15Tickets||[]).map(e=>e.date)].filter(Boolean))].sort();
 let cumulativeStakes=0,cumulativeReturns=0,cumulativeSettledStakes=0,cumulativeWinners=0,cumulativeRunners=0,cumulativeEW=0,cumulativePlaced=0;
 return dates.map(date=>{
  const day=summarizeDay(ledger,date);
  cumulativeStakes+=day.stakes;cumulativeReturns+=day.returns;cumulativeSettledStakes+=day.settledStakes;
  cumulativeWinners+=day.winners;cumulativeRunners+=day.resultCount;
  cumulativeEW+=day.eachWayRunners;cumulativePlaced+=day.eachWayPlaced;
  day.cumulative={
   settledProfit:fixed(cumulativeReturns-cumulativeSettledStakes),
   availableBank:fixed(number(ledger.startingBank)-cumulativeStakes+cumulativeReturns),
   winStrikeRate:cumulativeRunners?fixed(cumulativeWinners/cumulativeRunners*100):null,
   ewPlaceRate:cumulativeEW?fixed(cumulativePlaced/cumulativeEW*100):null,
   winners:cumulativeWinners,knownResults:cumulativeRunners,
   totalStakes:fixed(cumulativeStakes),returns:fixed(cumulativeReturns),
   pendingStakes:fixed(cumulativeStakes-cumulativeSettledStakes)
  };
  day.availableAfterStakes=day.cumulative.availableBank;
  return day;
 });
}
export function tuningNotes(racecard){
 const events=[];
 const add=(key,title,description,kind='rule')=>events.push({key,date:racecard.snapshotDate,title,description,kind});
 const v=racecard.valueReassessment||{};
 if(racecard.selectionPolicy?.avoidOddsOn)
  add('min-odds','Eliminated odds-on selections','Individual picks must be at least evens (1/1). This is an explicit selection-price rule, not a proven accuracy gain.');
 if(racecard.midshotsPolicy?.minOdds==='6/1')
  add('midshot-range','Expanded the midshot research band','Screened 6/1–18/1 runners for recent form, class, pace, ratings and each-way terms rather than selecting on a long price alone.');
 if(racecard.lucky15Plan?.minimumFractionalOddsExclusive==='11/2')
  add('lucky15-price','Raised the Lucky 15 price floor','Four distinct-race legs must each be priced strictly above 11/2. Removed shorter legs and excluded reported non-runners.');
 if(racecard.selectionPolicy?.numLongshots===1)
  add('longshot-cap','Reduced speculative longshots','Capped the 20/1+ category at one conditional place-oriented runner to concentrate the shortlist.');
 if(Array.isArray(v.criteria))
  add('research-checks','Added a repeatable pre-race checklist','Checks now document going, race grade/value, OR/TS/RPR, draw/pace, jockey, recent form, market and available trainer records. Not all factors were verifiable for every runner.','process');
 if(racecard.reviewCompleteness?.unverified?.length)
  add('evidence-gaps','Identified unverified inputs','Full historical trainer/course splits and all-runner sectionals remain incomplete. Confidence labels are qualitative, not calibrated probabilities.','limitation');
 return events;
}
