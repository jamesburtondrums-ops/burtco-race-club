// Research-only validation harness for complete, legally sourced PRE-RACE race forecasts.
// Features and market quotes must be timestamped before the off. Do not train or
// change the live tip algorithm from this script.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=x=>Math.round(x*10000)/10000;
function normalizeRace(race){
 if(!race?.raceId||!/^20\d{2}-\d\d-\d\d$/.test(String(race.date||'')))return null;
 if(!Array.isArray(race.runners)||race.runners.length<2)return null;
 if(!race.offAt||!Number.isFinite(Date.parse(race.offAt)))return null;
 if(race.offAt.slice(0,10)!==race.date)return null;
 if(new Set(race.runners.map(r=>r.horse)).size!==race.runners.length)return null;
 if(race.runners.filter(r=>r.finishingPosition===1).length!==1)return null;
 if(race.runners.some(r=>!finite(r.marketDecimalOdds)||r.marketDecimalOdds<=1||
  !Number.isFinite(Date.parse(r.marketQuoteAt))||Date.parse(r.marketQuoteAt)>=Date.parse(race.offAt)))
  return null;
 const inverse=race.runners.map(r=>1/r.marketDecimalOdds);
 const sum=inverse.reduce((a,b)=>a+b,0);
 if(!sum)return null;
 const runners=race.runners.map((r,i)=>{
  const modelValid=finite(r.modelWinProbability)&&r.modelWinProbability>=0&&r.modelWinProbability<=1
   &&Number.isFinite(Date.parse(r.modelForecastAt))&&Date.parse(r.modelForecastAt)<Date.parse(race.offAt);
  return {horse:r.horse,actualWinner:r.finishingPosition===1?1:0,
   marketProbability:inverse[i]/sum,modelProbability:modelValid?r.modelWinProbability:null};
 });
 const modelReady=runners.every(r=>r.modelProbability!==null)&&
  Math.abs(runners.reduce((a,b)=>a+b.modelProbability,0)-1)<.03;
 return {raceId:race.raceId,date:race.date,offAt:race.offAt,
  course:race.course||null,raceCode:race.raceCode||null,surface:race.surface||null,
  modelReady,runners};
}
function measure(groups,key){
 if(!groups.length)return null;
 let brier=0,logloss=0,correct=0,runners=0;
 for(const race of groups){
  const p=race.runners.map(r=>r[key]),winner=race.runners.find(r=>r.actualWinner===1);
  if(p.some(x=>!finite(x)))throw Error('Evaluation requires complete probabilities');
  for(const runner of race.runners){brier+=(runner[key]-runner.actualWinner)**2;runners++}
  const winnerP=winner[key];
  logloss+=-Math.log(Math.max(winnerP,1e-12));
  const best=race.runners.reduce((a,b)=>b[key]>a[key]?b:a);
  if(best.actualWinner===1)correct++;
 }
 return {races:groups.length,runners,
  brier:round(brier/runners),winnerLogLoss:round(logloss/groups.length),
  topPickWinRate:round(correct/groups.length*100)};
}
export function evaluateHeldOutRaces(races,opts={}){
 const minRaces=Number(opts.minRaces??500),minTestRaces=Number(opts.minTestRaces??100);
 const prepared=races.map(normalizeRace).filter(Boolean).sort((a,b)=>a.offAt.localeCompare(b.offAt));
 const unique=new Set(prepared.map(r=>r.raceId));
 if(unique.size!==prepared.length)return {ready:false,reason:'Duplicate race IDs; reject ambiguous evidence'};
 const dates=[...new Set(prepared.map(r=>r.date))].sort();
 if(prepared.length<minRaces||dates.length<15)
  return {ready:false,totalValidRaces:prepared.length,uniqueDates:dates.length,
   missingOrInvalid:(races||[]).length-prepared.length,
   reason:'Need 500+ complete full-field races across sufficient dates, with timestamped PRE-OFF bookmaker quotes and outcomes'};
 const splitIndex=Math.floor(dates.length*.8);
 const heldOutStart=dates[Math.min(splitIndex,dates.length-1)];
 const holdout=prepared.filter(r=>r.date>=heldOutStart);
 const development=prepared.filter(r=>r.date<heldOutStart);
 if(holdout.length<minTestRaces)
  return {ready:false,totalValidRaces:prepared.length,holdoutRaces:holdout.length,
   reason:'Chronological holdout has too few independent races'};
 const usableModel=holdout.filter(r=>r.modelReady);
 const baseline=measure(holdout,'marketProbability');
 const pairedBaseline=measure(usableModel,'marketProbability');
 const proposed=measure(usableModel,'modelProbability');
 const delta=proposed&&pairedBaseline?{
  brier:round(proposed.brier-pairedBaseline.brier),
  winnerLogLoss:round(proposed.winnerLogLoss-pairedBaseline.winnerLogLoss),
  topPickWinRatePoints:round(proposed.topPickWinRate-pairedBaseline.topPickWinRate)
 }:null;
 const comparable=usableModel.length>=minTestRaces&&usableModel.length/holdout.length>=.8;
 return {ready:true,status:comparable?'candidate_evaluation_only':'no_comparable_model_forecasts',
  trainAndTuneRaces:development.length,heldOutRaces:holdout.length,
  heldOutFrom:heldOutStart,holdoutRacesWithModel:usableModel.length,
  marketBaseline:baseline,pairedMarketBaseline:pairedBaseline,candidateModel:proposed,
  pairedDelta:comparable?delta:null,
  interpretation:comparable?'Negative Brier/log-loss deltas favour the candidate, but multiple chronological windows, uncertainty intervals and net betting performance are required before claiming improved accuracy.':
   'No reliable comparison: insufficient valid pre-race model probabilities on the same held-out races.',
  warnings:['No target-race results, SP or future ratings in features','Full field market is normalized by race to control overround','No inferred profits from prices that were not actually accepted','Do not promote model solely from one held-out test period']};
}
