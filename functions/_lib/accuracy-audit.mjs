// Private, non-predictive quality audit of the evidence attached to published picks.
// Never converts qualitative labels into win probabilities or alters any selection.
const groups=['todaySelections','midshotsToday','longshotsToday','lucky15Only'];
const validUrl=value=>typeof value==='string'&&/^https:\/\/[^\s/]+\.[^\s/]+(?:\/[^\s]*)?$/i.test(value);
const timestamp=value=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
const fractional=value=>typeof value==='string'&&(/^(?:\d+(?:\.\d+)?\/\d+(?:\.\d+)?|evens?)$/i.test(value.trim()));
const dateOf=value=>String(value||'').slice(0,10);
const isPrior=(t,date)=>timestamp(t)&&dateOf(t)<=date;
const nonblank=value=>typeof value==='string'&&value.trim().length>0;
const selfNotes=x=>[x.reason,x.risk].every(nonblank);
function pricedNotes(x,date){
 return Array.isArray(x.sourceNotes)&&(x.sourceNotes||[]).filter(n=>
  validUrl(n.sourceUrl)&&isPrior(n.observedAt,date)&&
  isPrior(n.publishedAt,date)&&n.raceMatched===true).length||0;
}
function historicRuns(x,date){
 return Array.isArray(x.verifiedPriorRuns)&&(x.verifiedPriorRuns||[]).filter(r=>
   validUrl(r.sourceUrl)&&isPrior(r.observedAt,date)&&
   isPrior(r.ranAt,date)&&r.finishStatus!==undefined).length||0;
}
export const accuracyPriorities=[
 {name:'Ability, handicap & class',source:'BHA official ratings, free racecards, prior class and weights',method:'Use dated ratings and past performances from before the selection; review rivals and race value. A low mark by itself is not a positive.'},
 {name:'Form quality & previous race circumstances',source:'Racing Post free form, At The Races form/replays, stewards reports',method:'Judge beaten distance, field quality, stronger subsequent results, slow starts, interference and jumping mistakes. Attribute every factual run note.'},
 {name:'Course, going, trip & race shape',source:'Official going, declared runners, course profiles and previous public results',method:'Compare actual track variants, surface, race distance, likely pace and draw only when comparable observations exist.'},
 {name:'Trainer, jockey & race placement',source:'Public stable/jockey results, career stats and same-code/race-type records',method:'Record recent form and relevant course/grade splits with dates and sample sizes. Avoid inferred inside information and tiny-sample bonuses.'},
 {name:'Early bookmaker market & rival strength',source:'Dated available pre-off bookmaker quotes and full racecards',method:'Check rivals and each-way terms; save the quoted price/time at publication. Never substitute SP as the early price.'},
 {name:'Independent commentary (cross-check only)',source:'OLBG, myracing and The Winners Enclosure',method:'Record author, timestamp and race-matched URL when available; use evidence, not popularity or tipster consensus as a win-probability shortcut.'}
];
export function auditSelectionEvidence(racecard={}){
 const date=String(racecard.snapshotDate||'');
 const seen=new Set(),selections=[];
 for(const group of groups)for(const pick of racecard[group]||[]){
  const key=[pick.horse,pick.course,pick.time].map(x=>String(x||'').trim().toLowerCase()).join('|');
  if(!pick.horse||seen.has(key))continue;
  seen.add(key);
  const flags=[];
  if(!validUrl(pick.sourceUrl))flags.push('No direct racecard or odds source link');
  if(!fractional(pick.odds))flags.push('No exact fractional early quote');
  if(!isPrior(pick.earlyOddsLockedAt,date))flags.push('No valid dated quote captured by race date');
  if(!nonblank(pick.trainer)||!nonblank(pick.jockey))flags.push('Trainer or jockey not recorded');
  if(!selfNotes(pick))flags.push('Missing written case or counterargument');
  const classText=String(pick.v42?.raceType||pick.v41?.raceType||'');
  if(!classText)flags.push('Class, trip or race type not structured');
  if(/\bhandicap\b/i.test(classText)&&!Number.isFinite(Number(pick.or)))flags.push('Handicap OR missing');
  const independentNotes=pricedNotes(pick,date);
  const priorRuns=historicRuns(pick,date);
  if(!priorRuns)flags.push('No independently sourced, dated prior-run records attached');
  selections.push({
   horse:String(pick.horse),course:String(pick.course||''),time:String(pick.time||''),
   isCore:group==='todaySelections',price:String(pick.odds||''),
   hasQuote:fractional(pick.odds)&&isPrior(pick.earlyOddsLockedAt,date),
   hasRacecardLink:validUrl(pick.sourceUrl),
   hasTrainerJockey:nonblank(pick.trainer)&&nonblank(pick.jockey),
   independentNotes,verifiedPriorRuns:priorRuns,flags
  });
 }
 const sum=name=>selections.filter(s=>s[name]).length;
 return {
  snapshotDate:date,
  selectedRunners:selections.length,
  exactDatedQuotes:sum('hasQuote'),
  racecardLinks:sum('hasRacecardLink'),
  trainerJockeyPairs:sum('hasTrainerJockey'),
  selectionsWithSourcedPriorRuns:selections.filter(s=>s.verifiedPriorRuns>0).length,
  selectionsWithIndependentNotes:selections.filter(s=>s.independentNotes>0).length,
  selections,priorities:accuracyPriorities,
  status:'Manual evidence audit only; no calibrated model or proven early-price improvement.',
  promotionRule:'A factor cannot change ratings until a licensed, dated, full-field historical sample shows repeated chronological out-of-sample improvement versus PRE-OFF market odds, without leaking SP or target-race results.'
 };
}
