// Research only: documented observable historical features, NOT a live tip predictor.
// Every run must predate the race being predicted. Never invent notes, sectionals or track bias.
export const SIGNALS=[
 {id:'running_style',name:'Early pace and running style',source:'Race in-running positions / verified running comment'},
 {id:'pace_pressure',name:'Projected race pace competition',source:'Prior early pace of all declared runners; ≥4 observed styles'},
 {id:'track_geometry',name:'Course-and-distance geometry',source:'Track profile: turns, first bend, straight, incline, rail variant'},
 {id:'draw_pace_interaction',name:'Draw versus pace and field size',source:'Same track/trip/surface/going historical cohorts'},
 {id:'official_rating',name:'Official rating versus performance figure',source:'Historical BHA OR and performance figures at time of run'},
 {id:'trouble',name:'Previous race incidents',source:'Sourced race comments and steward reports'},
 {id:'sectionals',name:'Efficiency and finishing speed versus par',source:'Licensed furlong splits or published RaceiQ par metrics'},
 {id:'jumping',name:'Obstacle efficiency (hurdles/chases)',source:'Confirmed jumping errors/lengths lost / licensed tracker data'},
 {id:'going',name:'Suitability of surface and ground',source:'Historical performance by course/trip/going'},
 {id:'trainer_type',name:'Trainer course, class and race-type splits',source:'Historic training statistics available before race'},
 {id:'fitness',name:'Days off and first/second run after absence',source:'Dated historic race records'},
 {id:'market',name:'Price value and overround',source:'Timestamped pre-race prices and the full field market'}
];
export const RESEARCH_SOURCES=[
 {title:'BHA guide to handicapping',url:'https://www.britishhorseracing.com/regulation/guide-to-handicapping/',reliability:'official',scope:'Current/previous official marks, weights, performance figures'},
 {title:'BHA performance figures',url:'https://www.britishhorseracing.com/regulation/performance-figures/',reliability:'official',scope:'Interpretation of tempo, course, going, slow starts and trouble'},
 {title:'BHA ratings database',url:'https://www.britishhorseracing.com/regulation/official-ratings/ratings-database/',reliability:'official',scope:'Weekly exportable ratings and changes. Archive each observed export to avoid using future revisions.'},
 {title:'BHA steward reports',url:'https://www.britishhorseracing.com/racing/stewards-reports/',reliability:'official',scope:'Documented incidents: interference, lame, lost shoe, saddle slip'},
 {title:'BHA handicapping tools',url:'https://www.britishhorseracing.com/regulation/handicapping-tools/',reliability:'official',scope:'Time/weight adjustments and comparisons of sectionals'},
 {title:'Racing TV RaceiQ sectionals',url:'https://www.racingtv.com/raceiq/sectionals-tab',reliability:'publisher',scope:'Furlong splits, position by furlong. Automate only with content permission.'},
 {title:'Racing TV RaceiQ par',url:'https://www.racingtv.com/raceiq/par-sectionals',reliability:'publisher',scope:'Finishing speed percentage relative to track/trip par. Automate only with content permission.'}
];
const str=x=>String(x||'').trim();
const norm=x=>str(x).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const blank=(value)=>value===undefined||value===null||value==='';
const styles=[
 ['leader',/\b(?:made all|made virtually all|soon led|led throughout|set the pace|led|disputed lead|made running)\b/i],
 ['prominent',/\b(?:prominent|tracked leaders?|chased leaders?|pressed (?:the )?leader|raced close up|in touch with leaders?)\b/i],
 ['midfield',/\b(?:midfield|mid division|mid-division|in touch|in mid pack)\b/i],
 ['closer',/\b(?:held up|towards rear|in rear|rear of field|waited with|last early|well off pace)\b/i]
];
const incidentPatterns=[
 ['slow_start',/\b(?:slowly away|dwelt|slow start|missed (?:the )?break|slowly into stride|awkward start)\b/i],
 ['interference',/\b(?:hampered|checked|bumped|blocked|denied (?:a )?clear run|short of room|crowded|impeded|squeezed)\b/i],
 ['wide_trip',/\b(?:raced wide|travelled wide|wide on (?:the )?bend|swung wide)\b/i],
 ['keen',/\b(?:raced keenly|pulled hard|refused to settle|too free|overraced)\b/i],
 ['late_gain',/\b(?:stayed on|ran on|kept on strongly|finished strongly|good late headway|nearest finish)\b/i],
 ['late_fade',/\b(?:weakened|faded|no extra|tired late|outpaced final|stopped quickly)\b/i],
 ['jump_error',/\b(?:made mistake|jumped poorly|blundered|pecked on landing|lost ground at (?:the )?fence)\b/i],
 ['lost_shoe',/\b(?:lost (?:a )?shoe|shoe came off)\b/i],
 ['lame',/\b(?:reported lame|returned lame|found to be lame)\b/i],
 ['eased',/\b(?:eased|not knocked about|not persevered with|coasted home)\b/i]
];
function negated(text,index){
 const head=text.slice(Math.max(0,index-28),index).toLowerCase();
 return /\b(?:not|never|without|no|wasn't|was not)\s+(?:seemingly\s+|visibly\s+)?$/.test(head);
}
export function parseRunningComment(note){
 const original=str(note).slice(0,700);
 const detected=[];
 for(const [id,re] of styles){
  const match=re.exec(original);
  if(match&&!negated(original,match.index))detected.push({id,index:match.index});
 }
 detected.sort((a,b)=>a.index-b.index);
 const style=detected.length?detected[0].id:null;
 const tags=[];
 for(const [name,re] of incidentPatterns){
  const m=re.exec(original);if(m&&!negated(original,m.index))tags.push(name);
 }
 return {style,tags,observed:!!original,unverifiedNote:original.length===0};
}
export function validatePriorRun(run,selectionDate){
 if(!run||typeof run!=='object'||!/^20\d\d-\d\d-\d\d$/.test(str(run.date)))return {ok:false,reason:'Invalid prior race date'};
 if(!/^20\d\d-\d\d-\d\d$/.test(str(selectionDate))||run.date>=selectionDate)
  return {ok:false,reason:'Future or same-race evidence excluded'};
 if(!str(run.horse)||!str(run.course))return {ok:false,reason:'Horse/course identification missing'};
 if(!run.sourceUrl||!/^https:\/\//i.test(run.sourceUrl))return {ok:false,reason:'Sourced historic result URL required'};
 if(!run.sourceCheckedAt||!/^20\d\d-\d\d-\d\dT/.test(run.sourceCheckedAt))
  return {ok:false,reason:'Source observation timestamp required to prevent revisions leaking into historic predictions'};
 if(run.sourceCheckedAt.slice(0,10)>=selectionDate)
  return {ok:false,reason:'Source not yet available before target race'};
 const p=Number(run.finishingPosition);
 if(!blank(run.finishingPosition)&&(!Number.isFinite(p)||p<1))return {ok:false,reason:'Bad finishing position'};
 if(run.officialRating!==null&&!blank(run.officialRating)&&(!Number.isFinite(Number(run.officialRating))||Number(run.officialRating)<0))return {ok:false,reason:'Invalid historic rating'};
 return {ok:true};
}
export function styleEvidence(horse,priorRuns,asOfDate){
 const available=(priorRuns||[]).filter(r=>norm(r.horse)===norm(horse)&&validatePriorRun(r,asOfDate).ok)
  .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
 const tagged=available.map(run=>({...run,signals:parseRunningComment(run.comment)}));
 const counts={leader:0,prominent:0,midfield:0,closer:0},incidents={};
 for(const r of tagged){
  if(r.signals.style)counts[r.signals.style]++;
  for(const t of r.signals.tags)incidents[t]=(incidents[t]||0)+1;
 }
 const observed=Object.values(counts).reduce((a,b)=>a+b,0);
 const [name,count]=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
 // One run is not enough to pronounce a preferred running style.
 const reliable=observed>=3&&count/observed>=0.6;
 const last=tagged[0]||null;
 return {
  horse,asOfDate,priorRaces:available.length,commentCoverage:tagged.filter(r=>r.signals.observed).length,
  style:reliable?name:null,styleStatus:reliable?'repeated pattern':'insufficient/ambiguous',
  styleObservations:observed,styleCounts:counts,incidents,
  lastRun: last?{date:last.date,course:last.course,going:last.going||null,style:last.signals.style,flags:last.signals.tags,officialRating:last.officialRating??null}:null,
  sourceUrls:tagged.map(r=>r.sourceUrl).slice(0,5)
 };
}
export function paceMap(runners,priorRuns,date){
 const evidence=(runners||[]).map(horse=>styleEvidence(str(horse.horse||horse),priorRuns,date));
 const reliable=evidence.filter(x=>x.style),leaders=reliable.filter(x=>x.style==='leader').length;
 if(reliable.length<4||reliable.length/Math.max(1,evidence.length)<0.6)
  return {status:'insufficient data',leaders:null,pacePressure:null,observed:reliable.length,fieldSize:evidence.length};
 return {status:'historical styles only',leaders,observed:reliable.length,fieldSize:evidence.length,
  pacePressure:leaders>=3?'potential strong contested lead':leaders===1?'possible uncontested lead':'pace uncertain',
  disclaimer:'Heuristic only; not a validated pace forecast, and pace depends on actual race conditions.'};
}
export function researchCoverage(ledger,priorRuns=[],racecard=null){
 const bets=ledger.entries||[],dates=new Set(bets.map(e=>e.date)),complete=bets.filter(x=>x.result);
 const validated=priorRuns.filter(x=>validatePriorRun(x,'2099-01-01').ok);
 const commentary=validated.filter(x=>!!str(x.comment));
 const sections=validated.filter(x=>Array.isArray(x.sectionals)&&x.sectionals.length>0);
 const ratings=validated.filter(x=>!blank(x.officialRating));
 const uniqueRaces=new Set(validated.map(x=>x.date+'|'+norm(x.course)+'|'+str(x.raceTime)));
 const completeOutcomes=bets.filter(x=>x.result&&Number(x.result.position)>0);
 const distinctSettledRaces=new Set(completeOutcomes.map(x=>x.date+'|'+norm(x.course)+'|'+str(x.time)));
 const ready=uniqueRaces.size>=500&&validated.length>=2000&&commentary.length>=1000;
 return {
  recordedTipBets:bets.length,recordedTipDates:dates.size,recordedBetsWithResult:complete.length,
  confirmedFinishedOutcomes:completeOutcomes.length,uniqueObservedSelectionRaces:distinctSettledRaces.size,
  sourcedHistoricalRuns:validated.length,sourcedHistoricalRaces:uniqueRaces.size,
  withRunComments:commentary.length,withSectionals:sections.length,withOfficialRatings:ratings.length,
  featureCoveragePercent:validated.length?Math.round(commentary.length/validated.length*100):null,
  quantitativeRetrainReady:ready,minimumHistoricalRaces:500,minimumFullFieldRunners:2000,
  status:ready?'Eligible to start walk-forward evaluation (NOT a demonstrated improvement)':'Research mode — insufficient verified full-field historic data for retraining',
  missing:['Permissioned machine-readable race comments and full field histories','Course/trip-specific track geometry and sectional par data','Pre-race trainer/course and race-type performance snapshots'],
  recordedAt:null
 };
}
export function chronologicalAssessment(rows){
 const dated=(rows||[]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(str(x.date))&&x.sourceUrl&&x.sourceCheckedAt&&Number(x.finishingPosition)>0)
  .slice().sort((a,b)=>a.date.localeCompare(b.date));
 const raceIds=[...new Set(dated.map(x=>x.date+'|'+norm(x.course)+'|'+str(x.raceTime)))];
 if(raceIds.length<500||dated.length<2000)
  return {ready:false,races:raceIds.length,observations:dated.length,
   reason:'Need at least 500 sourced historical races and 2,000 full-field runner observations; not trained or validated'};
 const cutoffRace=raceIds[Math.floor(raceIds.length*.8)-1]||'';
 const cutoffDate=cutoffRace.split('|')[0];
 return {ready:true,observations:dated.length,races:raceIds.length,
  trainBefore:cutoffDate,validationFrom:cutoffDate,
  safeguards:['No post-race variables in pre-race feature sets','Entire races are grouped together','No target-race results, SP or future revised OR as predictors','Report market-baseline Brier/log loss and predictive performance independently','Hold back later dates as untouched prospective test','Record source licenses and missingness by year/course']};
}


// Descriptive market benchmark only. These are NOT predictions generated by the research model.
export function historicalPriceAudit(ledger){
 const bands=[
  {label:'Odds-on (historical only)',min:0,max:1},
  {label:'Evens to under 3/1',min:1,max:3},
  {label:'3/1 to under 6/1',min:3,max:6},
  {label:'6/1 to under 18/1',min:6,max:18},
  {label:'18/1 and bigger',min:18,max:Infinity}
 ];
 const parseFraction=value=>{
  const quote=str(value);
  if(/^(evens?|1\/1)$/i.test(quote))return 1;
  const m=quote.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if(!m||Number(m[2])===0)return null;
  return Number(m[1])/Number(m[2]);
 };
 const buckets=bands.map(b=>({label:b.label,n:0,winners:0,expectedWinners:0,brierSum:0,logLossSum:0}));
 let candidates=0,valid=0,missingPrice=0,skippedVoid=0;
 const uniqueRaces=new Set();
 for(const entry of ledger.entries||[]){
  if(!entry.result){continue}
  const r=entry.result,position=Number(r.position);
  if(!Number.isFinite(position)||position<=0){skippedVoid++;continue}
  candidates++;
  const frac=parseFraction(entry.selectionOdds);
  if(frac===null){missingPrice++;continue}
  const prob=1/(1+frac),outcome=position===1?1:0;
  const bucket=buckets.find((_,i)=>frac>=bands[i].min&&frac<bands[i].max);
  if(!bucket)continue;
  bucket.n++;bucket.winners+=outcome;bucket.expectedWinners+=prob;
  bucket.brierSum+=(prob-outcome)**2;
  bucket.logLossSum+=-(outcome*Math.log(Math.max(1e-9,prob))+(1-outcome)*Math.log(Math.max(1e-9,1-prob)));
  valid++;uniqueRaces.add([entry.date,norm(entry.course),entry.time].join('|'));
 }
 const display=b=>({
  oddsBand:b.label,observations:b.n,winners:b.winners,
  winRatePercent:b.n?Math.round(10000*b.winners/b.n)/100:null,
  impliedExpectedWins:Math.round(b.expectedWinners*100)/100,
  marketImpliedBrier:b.n?Math.round(10000*b.brierSum/b.n)/10000:null,
  marketImpliedLogLoss:b.n?Math.round(10000*b.logLossSum/b.n)/10000:null
 });
 const total={label:'All prices',n:0,winners:0,expectedWinners:0,brierSum:0,logLossSum:0};
 for(const b of buckets)for(const k of ['n','winners','expectedWinners','brierSum','logLossSum'])total[k]+=b[k];
 return {
  finishedSelections:candidates,usableSelections:valid,distinctRaces:uniqueRaces.size,excludedAmbiguousPrices:missingPrice,excludedVoidOrUnpricedFinishes:skippedVoid,
  marketBenchmark:display(total),oddsBands:buckets.map(display),
  meaning:'Descriptive benchmark for selected horses only: observed winners against raw pre-race implied probabilities. No bookmaker overround correction or trained model.',
  conclusions:'Too small and selection-biased for accuracy claims; treat deviations as hypotheses, not proof that any system change improved results.'
 };
}
