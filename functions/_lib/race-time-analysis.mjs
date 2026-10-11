// Historical race time and position analysis. Do not conflate measured timings,
// official race clocks, margin-derived estimates or sectional evidence.
const num=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const norm=v=>String(v||'').toLowerCase().trim();
const round=(v,n=2)=>Math.round(v*10**n)/10**n;
export function parseRaceTime(text){
 if(typeof text==='number')return Number.isFinite(text)&&text>0?text:null;
 const s=String(text||'').toLowerCase().replace(/,/g,'').trim();
 if(!s)return null;
 if(/^\d+(?:\.\d+)?$/.test(s))return num(s)>0?num(s):null;
 let m=s.match(/^(?:(\d+)h\s*)?(?:(\d+)m\s*)?(\d+(?:\.\d+)?)s?$/);
 if(m)return (Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]))||null;
 m=s.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
 if(m)return Number(m[1]||0)*3600+Number(m[2])*60+Number(m[3]);
 m=s.match(/^(\d+):(\d+(?:\.\d+)?)$/);
 if(m)return Number(m[1])*60+Number(m[2]);
 return null;
}
const frac=s=>{
 const m=String(s||'').match(/^(\d+)\s*\/\s*(\d+)$/);
 return m&&Number(m[2])>0?Number(m[1])/Number(m[2]):null;
};
export function parseMarginLengths(label){
 const s=norm(label).replace(/(\d)([¼½¾])/g,'$1 $2').replace(/\s+/g,' ').replace(/¼/g,'1/4').replace(/½/g,'1/2').replace(/¾/g,'3/4');
 if(!s)return null;
 if(/^(dead heat|dead-heat|dh)$/.test(s))return 0;
 if(/^(nose|nse)$/.test(s))return 0.05;
 if(/^(short head|s hd|shd|sh)$/.test(s))return 0.1;
 if(/^(head|hd)$/.test(s))return 0.2;
 if(/^(neck|nk)$/.test(s))return 0.3;
 const m=s.match(/^(?:(\d+)\s+)?(\d+\/\d+|\d+(?:\.\d+)?)\s*(?:l|lengths?)?$/);
 if(m){const fraction=frac(m[2]);const parsed=fraction===null?num(m[2]):fraction;
  return parsed===null?null:((m[1]?Number(m[1]):0)+parsed);}
 return null; // 'distance', 'many lengths' and pulled-up are not numeric.
}
export function cumulativeMargins(runners){
 // Most GB result providers give each runner's distance *behind the predecessor*.
 // Missing any intervening margin prevents exact accumulation.
 let cumulative=0,valid=true;
 return (runners||[]).map((r,i)=>{
  if(i===0){if(Number(r.position)!==1)valid=false;return {...r,lengthsBehindWinner:valid?0:null};}
  const margin=parseMarginLengths(r.marginBehindPrevious);
  if(!valid||margin===null){valid=false;return {...r,lengthsBehindWinner:null};}
  cumulative+=margin;return {...r,lengthsBehindWinner:round(cumulative,3)};
 });
}
export function computeRaceTime({winningTime,winningTimeSeconds,horseTimeSeconds,finishPosition,
 lengthsBehindWinner,secondsPerLength,marginScaleSource}={}){
 const winner=num(winningTimeSeconds)??parseRaceTime(winningTime);
 if(!winner||winner<=0)return {status:'unavailable',reason:'Sourced official winning time required'};
 const observed=num(horseTimeSeconds);
 if(observed!==null&&observed>0)return {status:'measured individual time',seconds:round(observed),winnerSeconds:winner,
   gapSeconds:round(observed-winner,3),method:'Published horse-specific tracking time; not calculated from lengths'};
 if(Number(finishPosition)===1)return {status:'official winner time',seconds:winner,winnerSeconds:winner,gapSeconds:0,
   method:'Winning clock (race result)'};
 const margin=num(lengthsBehindWinner),scale=num(secondsPerLength);
 if(margin===null||margin<0)return {status:'unavailable',reason:'Cumulative beaten distance behind winner missing (not just behind predecessor)'};
 if(!scale||scale<2||scale>8||!/^https:\/\//.test(String(marginScaleSource||'')))
  return {status:'unavailable',reason:'Verified lengths-per-second scale for race type, going and surface required'};
 const estimate=winner+margin/scale;
 return {status:'margin-derived estimate',seconds:round(estimate,3),winnerSeconds:winner,
  gapSeconds:round(margin/scale,3),source:marginScaleSource,
  method:'Approximation from rounded official beaten margins with supplied conversion; NOT an individual measured time',
  caveat:'Margins can be rounded; official photo-finish and sectional timing differ. Not a sectional.'};
}
export function analyseFurlongTrail({horse,race,measurements,benchmarks={},positionFinish}={}){
 const time=computeRaceTime({winningTime:race?.winningTime,winningTimeSeconds:race?.winningTimeSeconds,
  horseTimeSeconds:measurements?.horseTimeSeconds,finishPosition:positionFinish??measurements?.position,
  lengthsBehindWinner:measurements?.lengthsBehindWinner,
  secondsPerLength:race?.secondsPerLength,marginScaleSource:race?.marginScaleSource});
 const sectionals=Array.isArray(measurements?.sectionals)?measurements.sectionals:[];
 const valid=sectionals.length>=2 && sectionals.every(s=>num(s.seconds)>0 && Number.isInteger(Number(s.position))&&
  Number(s.position)>0&&num(s.furlong)>0);
 const labels=[];
 let speed=null,ranking=null;
 if(valid){
  const trail=sectionals.map(s=>({furlong:Number(s.furlong),position:Number(s.position),seconds:Number(s.seconds)}))
   .sort((a,b)=>a.furlong-b.furlong);
  if(!trail.every((x,i)=>i===0||x.furlong>trail[i-1].furlong))
   return {status:'invalid sectionals',horse,time,reason:'Furlong markers must increase without duplicates'};
  const start=trail[0],end=trail.at(-1),late=trail.slice(-2),lateTotal=late.reduce((a,x)=>a+x.seconds,0);
  const maxBack=trail.reduce((a,x)=>Math.max(a,x.position),0);
  const last4=trail.slice(-4),first4=trail.slice(0,4);
  const front=trail.filter(x=>x.position<=Math.max(2,Math.ceil((race?.fieldSize||10)*.25))).length;
  ranking={startPosition:start.position,endPosition:end.position,positionsGained:start.position-end.position,
   worstPosition:maxBack,trail:trail.map(x=>({furlong:x.furlong,position:x.position})),
   midPosition:trail[Math.floor((trail.length-1)/2)].position};
  const d=num(race?.distanceFurlongs),overall=num(measurements?.horseTimeSeconds),finishDistance=num(measurements?.finishingSectionFurlongs);
  const finishTimes=finishDistance===2?lateTotal:null;
  const calculatedFsp=d&&overall&&finishTimes?100*finishDistance*overall/(finishTimes*d):null;
  speed={lastTwoFurlongsSeconds:round(lateTotal),firstFourSeconds:round(first4.reduce((a,x)=>a+x.seconds,0)),
   lastFourSeconds:round(last4.reduce((a,x)=>a+x.seconds,0)),
   publishedFinishingSpeedPercent:num(measurements?.finishingSpeedPercent),
   derivedFspPercent:calculatedFsp===null?null:round(calculatedFsp),
   topSpeedMph:num(measurements?.topSpeedMph),topSpeedRank:num(measurements?.topSpeedRank),
   finishingSpeedRank:num(measurements?.finishingSpeedRank),
   firstFurlongExcludedFromPaceComparisons:true};
  if(start.position>=Math.ceil((race?.fieldSize||10)*.7)&&end.position<=3&&ranking.positionsGained>=3)
   labels.push('Proven ability to make substantial late positional gains in this race');
  if(front===trail.length)labels.push('Raced in the leading quarter throughout this race');
  if(ranking.positionsGained<=-3)labels.push('Lost substantial places during the race');
  if(num(measurements?.finishingSpeedRank)===1)labels.push('Fastest finishing-speed percentage in this recorded field');
  if(num(measurements?.topSpeedRank)===1)labels.push('Highest measured peak speed in this recorded field');
 }
 const direct=measurements?.sectionalRights==="licensed"||measurements?.sectionalRights==="manual-factual-excerpt";
 const status=valid&&direct?'descriptive measured-sectionals review':time.status==='margin-derived estimate'?'estimated race time only':
  time.status==='measured individual time'?'measured overall time only':'insufficient data';
 return {status,horse,time,positions:ranking,pace:speed,observations:labels,
   verifiedParFspPercent:num(benchmarks?.parFinishingSpeedPercent),
   relativeFspToPar:num(benchmarks?.parFinishingSpeedPercent)!==null&&num(measurements?.finishingSpeedPercent)!==null?
    round(num(measurements.finishingSpeedPercent)-num(benchmarks.parFinishingSpeedPercent)):null,
   sourceUrl:race?.sourceUrl||null,
   availableSince:race?.publishedAt||null,reviewedAt:race?.reviewedAt||null,
   qualifiedForPastTips:false,
   interpret:'Descriptive run analysis, not a forecast. Absolute finish time requires same course/trip/going/class/weight context; no arbitrary probability uplift.'};
}
export function compareClosing({runner,leader,race}={}){
 const a=runner?.sectionals,b=leader?.sectionals;
 if(!Array.isArray(a)||!Array.isArray(b)||a.length<2||b.length<2)
  return {status:'unavailable',reason:'Both horses need two measured finishing furlong splits'};
 const endA=a.slice(-2),endB=b.slice(-2);
 if(endA.some((v,i)=>num(v.seconds)===null||num(v.furlong)!==num(endB[i]?.furlong)||num(endB[i]?.seconds)===null))
  return {status:'unavailable',reason:'Sectional distance markers or times differ'};
 const ta=endA.reduce((x,r)=>x+Number(r.seconds),0),tb=endB.reduce((x,r)=>x+Number(r.seconds),0);
 return {status:'measured same-race comparison',horseClosingTime:round(ta),rivalClosingTime:round(tb),
  horseSecondsFaster:round(tb-ta),raceContext:race?.course||null,
  caveat:'Two-furlong burst does not prove repeatability and does not adjust for positional trouble.'};
}
