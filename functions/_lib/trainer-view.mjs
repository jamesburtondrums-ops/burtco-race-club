// Trainer's View: pre-race, provenance-constrained course and placement evidence.
// Descriptive research only; never infer private stable plans or assign arbitrary selection probabilities.
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const number=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const dateOK=v=>/^20\d\d-\d\d-\d\d$/.test(String(v||''));
const sourceOK=(r,asOf)=>dateOK(r?.date)&&dateOK(asOf)&&r.date<asOf&&
 /^https:\/\//.test(String(r.sourceUrl||''))&&
 /^20\d\d-\d\d-\d\dT/.test(String(r.sourceCheckedAt||''))&&r.sourceCheckedAt.slice(0,10)<asOf;
const idOf=p=>norm(p.trackId||p.course);
const generic=course=>norm(course).replace(/\b(rowley mile|july course|all weather|polytrack|flat|jumps)\b/g,'').trim();
export function selectTrackProfile(profiles,query={}){
 const name=generic(query.course);
 if(!name)return {status:'unavailable',reason:'Course missing'};
 const found=(profiles?.tracks||[]).filter(p=>generic(p.course)===name);
 if(!found.length)return {status:'unavailable',reason:'No sourced configuration for this course'};
 const variant=norm(query.configuration||query.trackVariant);
 const discipline=norm(query.discipline||query.code);
 const surface=norm(query.surface);
 let matched=found;
 if(variant){
  // Only match the named variant, not incidental mentions of other courses in prose.
  matched=matched.filter(p=>norm(p.trackId).includes(variant)||norm(p.course).includes(variant));
  if(!matched.length)return {status:'unavailable',reason:'Requested configuration not among sourced layouts'};
 }
 if(surface)matched=matched.filter(p=>!p.surface||norm(p.surface)===surface||
    (surface==='all weather'&&/polytrack|tapeta/i.test(p.surface)) ||
    (surface==='turf'&&/turf/i.test(p.surface)));
 if(discipline){
  const expectsJumps=/jump|hurdle|chase|nh/.test(discipline);
  matched=matched.filter(p=>!p.discipline||(expectsJumps?norm(p.discipline)==='jumps':norm(p.discipline)==='flat'));
 }
 if(!matched.length)return {status:'unavailable',reason:'No matching surface/code configuration; do not transfer a different layout'};
 // AW inner and outer Kempton loops change by trip. Do not treat them as a single course.
 if(matched.length>1 && name==='kempton' && matched.every(p=>/kempton-aw-/.test(p.trackId))){
  const distance=number(query.distanceFurlongs);
  if(distance!==null){
   const rounded=Math.round(distance);
   const loop=[5,9,10].includes(rounded)?'inner':[6,7,8].includes(rounded)?'outer':null;
   if(loop)matched=matched.filter(p=>p.trackId.endsWith(loop));
  }
 }
 if(matched.length>1 && name==='newcastle' && matched.every(p=>/newcastle-aw-/.test(p.trackId))){
  const distance=number(query.distanceFurlongs);
  if(distance!==null){
   const configuration=distance<=8.2?'straight':'round';
   matched=matched.filter(p=>p.trackId.endsWith(configuration));
  }
 }
 if(matched.length>1)return {status:'ambiguous',reason:'Multiple course layouts. Specify track variant or Flat/Jumps before comparing.',options:matched.map(x=>x.trackId)};
 const p=matched[0];
 return {status:'course geometry documented',trackId:idOf(p),course:p.course,configuration:p.configuration,
  terrainTags:p.terrainTags||[],discipline:p.discipline||null,surface:p.surface||null,
  sourceUrls:p.sourceUrls||[],note:'Terrain tags describe track geometry, NOT an empirically tested benefit to a specific horse.'};
}
export function parseRaceDistance(label){
 // Racing distances are in furlongs (220yd) and often include yardage immediately after m/f.
 const s=String(label||'').toLowerCase();
 const m=s.match(/(?:^|[\s,(])(\d+)m(?:\s*(\d+)f)?(?:\s*(\d+)y(?:ds?)?)?\b/);
 if(m)return Number(m[1])*8+Number(m[2]||0)+Number(m[3]||0)/220;
 const f=s.match(/(?:^|[\s,(])(\d+)f(?:\s*(\d+)y(?:ds?)?)?\b/);
 return f?Number(f[1])+Number(f[2]||0)/220:null;
}
const terrainOverlap=(a,b)=>{
 const aa=new Set(a||[]),bb=new Set(b||[]);
 // Not all track traits discriminate. Keep matching strict and explain missingness.
 const keys=['galloping','undulating','stiff-finish','sharp','tight-turns','downhill','long-straight'];
 const overlap=keys.filter(t=>aa.has(t)&&bb.has(t));
 const conflict=(aa.has('sharp')&&bb.has('galloping')&&!bb.has('sharp'))||
  (bb.has('sharp')&&aa.has('galloping')&&!aa.has('sharp'));
 return {overlap,conflict};
};
export function trackPerformanceEvidence({horse,asOfDate,target,priorRuns,profiles}={}){
 const current=selectTrackProfile(profiles,target||{});
 const base={status:'insufficient evidence',target:current,horse,asOfDate,
  eligibleRuns:0,directRuns:0,similarLayoutRuns:0,
  directFinishes:[],similarLayoutFinishes:[],sectionalParComparisons:[],
  missing:[],note:'Only sourced observations known before race time are eligible. Similar track type does not prove a repeatable preference.'};
 if(current.status!=='course geometry documented'){
  base.missing.push('Unambiguous course configuration');return base;
 }
 const targetDistance=number(target?.distanceFurlongs);
 if(targetDistance===null)base.missing.push('Official target race distance');
 const valid=(priorRuns||[]).filter(r=>norm(r.horse)===norm(horse)&&sourceOK(r,asOfDate))
  .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
 base.eligibleRuns=valid.length;
 if(!valid.length)base.missing.push('Dated licensed prior race performances and in-running comments');
 let withSectionals=0;
 for(const r of valid){
  const past=selectTrackProfile(profiles,{course:r.course,configuration:r.trackVariant,
   discipline:r.discipline||r.raceType||target?.discipline,surface:r.surface});
  if(past.status!=='course geometry documented')continue;
  // Only compare same code and broadly similar trips, without guessing unknown distances.
  const historicDistance=number(r.distanceFurlongs);
  if(targetDistance===null||historicDistance===null)continue;
  if(Math.abs(targetDistance-historicDistance)>Math.max(1.0,0.2*targetDistance))continue;
  if(past.discipline&&current.discipline&&past.discipline!==current.discipline)continue;
  const isDirect=past.trackId===current.trackId;
  const similar=terrainOverlap(past.terrainTags,current.terrainTags);
  if(!isDirect&&(similar.overlap.length<2||similar.conflict))continue;
  const rec={date:r.date,course:r.course,distanceFurlongs:historicDistance,
   finishingPosition:number(r.finishingPosition),going:r.going||null,
   sourceUrl:r.sourceUrl,sharedTerrain:similar.overlap,
   note:'Prior result context only; no uplift claimed'};
  if(isDirect)base.directFinishes.push(rec);else base.similarLayoutFinishes.push(rec);
  // Only compare against a real, supplied par for the same historic race.
  const fsp=number(r.finishSpeedPercent),par=number(r.parFinishSpeedPercent);
  if(fsp!==null&&par!==null&&fsp>0&&par>0&&r.sectionalPermissionVerified===true){
   withSectionals++;
   base.sectionalParComparisons.push({date:r.date,course:r.course,
    fspPercent:fsp,parFspPercent:par,delta:Math.round((fsp-par)*100)/100,sourceUrl:r.sourceUrl,
    caveat:'Relative pace efficiency in that historic race, not horse speed or ability adjusted for opposition.'});
  }
 }
 base.directRuns=base.directFinishes.length;
 base.similarLayoutRuns=base.similarLayoutFinishes.length;
 if(!base.directRuns&&!base.similarLayoutRuns)base.missing.push('Comparable dated runs at this configuration and trip');
 if(!withSectionals)base.missing.push('Licensed race-specific sectional and par observations');
 base.status=base.directRuns>=3?'repeated course evidence':base.directRuns+base.similarLayoutRuns>=3?
  'multiple comparable track-type observations':'insufficient evidence';
 return base;
}
export function assessEntryHypotheses({horse,asOfDate,target,priorRuns,profiles}={}){
 const e=trackPerformanceEvidence({horse,asOfDate,target,priorRuns,profiles});
 const all=(priorRuns||[]).filter(r=>norm(r.horse)===norm(horse)&&sourceOK(r,asOfDate))
  .sort((a,b)=>b.date.localeCompare(a.date));
 const hypotheses=[],questions=[];
 if(e.directFinishes.length>=2&&e.directFinishes.some(r=>r.finishingPosition!==null&&r.finishingPosition<=3))
  hypotheses.push({label:'Return to previously effective course configuration',
   evidence:e.directFinishes.length+' sourced comparable starts at target layout, including a top-three finish',
   certainty:'plausible hypothesis; not confirmed stable intent'});
 else if(e.similarLayoutFinishes.length>=3&&e.similarLayoutFinishes.some(r=>r.finishingPosition!==null&&r.finishingPosition<=3))
  hypotheses.push({label:'Potential transfer of comparable course-type performance',
   evidence:e.similarLayoutFinishes.length+' sourced broadly similar track/trip starts; geometry is not a guarantee',
   certainty:'plausible hypothesis; not confirmed stable intent'});
 if(all.length&&number(target?.distanceFurlongs)!==null){
  const recent=all.find(x=>number(x.distanceFurlongs)!==null);
  const delta=recent?Number(target.distanceFurlongs)-Number(recent.distanceFurlongs):null;
  if(delta!==null&&Math.abs(delta)>=1)
   hypotheses.push({label:delta>0?'Stepping up in trip':'Dropping back in trip',
    evidence:'Target '+target.distanceFurlongs+'f versus latest sourced '+recent.distanceFurlongs+'f',
    certainty:'Observable entry change; reason and suitability unproven'});
 }
 if(all.length&&Number.isFinite(Date.parse(asOfDate+'T12:00:00Z'))){
  const rest=Math.round((Date.parse(asOfDate+'T12:00:00Z')-Date.parse(all[0].date+'T12:00:00Z'))/86400000);
  if(rest>=60)hypotheses.push({label:'Returning from a break ('+rest+' days)',evidence:'Time since most recent sourced run',
   certainty:'Observable gap; fitness and yard intentions unknown'});
 }
 if(number(target?.raceClass)!==null){
  const previous=all.find(r=>number(r.raceClass)!==null);
  if(previous&&Number(previous.raceClass)!==Number(target.raceClass)){
   const diff=Number(target.raceClass)-Number(previous.raceClass);
   hypotheses.push({label:diff>0?'Drop in numbered race class':'Rise in numbered race class',
    evidence:'Previous Class '+previous.raceClass+' → current Class '+target.raceClass,
    certainty:'Entry choice observed; race quality and rating adjustments still require assessment'});
  }
 }
 if(target?.isHandicap===true && number(target?.officialRating)!==null){
  const wins=all.filter(r=>Number(r.finishingPosition)===1 && number(r.officialRating)!==null);
  const lastWin=wins[0];
  if(lastWin){
   const diff=Number(target.officialRating)-Number(lastWin.officialRating);
   if(diff<=2)hypotheses.push({label:'Handicap mark near or below a previous winning mark',
    evidence:'Today OR '+target.officialRating+' vs sourced winning OR '+lastWin.officialRating+' on '+lastWin.date,
    certainty:'Descriptive mark comparison; different race circumstances and rating revisions may apply'});
  }else questions.push('No sourced previous winning handicap mark to compare with the current mark.');
 }
 if(target?.jockey){
  const priorPartner=all.filter(r=>norm(r.jockey)===norm(target.jockey));
  if(priorPartner.length>=2 && priorPartner.some(r=>Number(r.finishingPosition)<=3 && Number(r.finishingPosition)>0))
   hypotheses.push({label:'Repeat jockey partnership',
    evidence:priorPartner.length+' previous sourced rides with at least one top-three finish',
    certainty:'Booking is observable, significance untested'});
 }
 const go=norm(target?.going);
 if(go){
  const matchingGoing=all.filter(r=>norm(r.going)===go && Number(r.finishingPosition)>0);
  if(matchingGoing.length>=3&&matchingGoing.filter(r=>Number(r.finishingPosition)<=3).length>=2)
   hypotheses.push({label:'Repeated performance on identical going description',
    evidence:matchingGoing.filter(r=>Number(r.finishingPosition)<=3).length+' top-three finishes / '+matchingGoing.length+' prior starts',
    certainty:'Descriptive ground history; pace, class and seasonal moisture can differ'});
 }
 if(target?.prizeWinnerGBP){
  questions.push('Race value '+String(target.prizeWinnerGBP)+' GBP to winner: compare against likely alternative entries and owner targets, rather than assuming higher purse means stronger winning intention.');
 }
  if(!hypotheses.length)questions.push('Why this race? Require an owner/trainer declaration or evidence of a deliberate change in conditions.');
 questions.push('Is the horse suited to the actual field pace, draw/rail setup, going, race value and class?');
 questions.push('Could this be an educational run, fitness run, handicap preparation or a genuine winning opportunity? Do not assert without evidence.');
 return {horse,asOfDate,track:e,hypotheses,questions,trainerIntent:'not established',
   gate:e.status==='insufficient evidence'?'RESEARCH ONLY — no justified track-fit upgrade':
    'REVIEW — supported course context, predictive value not validated'};
}
export function buildTrainerView(races,priorRuns,profiles){
 const date=races?.snapshotDate;
 if(!dateOK(date))return {status:'unavailable',selections:[]};
 const meetings=new Map((races.meetings||[]).map(x=>[norm(x.course),x]));
 const selected=[...(races.todaySelections||[]),...(races.midshotsToday||[]),...(races.longshotsToday||[])];
 const records=selected.map(x=>{
  const meeting=meetings.get(norm(x.course));
  const descriptor=x?.v42?.raceType||x.raceType||'';
  const d=parseRaceDistance(descriptor);
  const disc=/jump|hurdle|chase/i.test(meeting?.code||'')?'Jumps':meeting?'Flat':null;
  const candidate={course:x.course,trackVariant:x.trackVariant||x.courseVariant||meeting?.trackVariant||null,
   distanceFurlongs:d,discipline:disc,surface:/all.weather|tapeta|polytrack/i.test(meeting?.code||'')?'all weather':meeting?'Turf':null,
   raceClass:x.raceClass??null,officialRating:x.or??null,jockey:x.jockey||null,
   going:x.currentGoing||meeting?.going||null,isHandicap:/handicap/i.test(descriptor),
   prizeWinnerGBP:(()=>{const m=String(descriptor).match(/£([\d,]+)/);return m?Number(m[1].replace(/,/g,'')):null})()};
  const audit=assessEntryHypotheses({horse:x.horse,asOfDate:date,target:candidate,priorRuns,profiles});
  return {horse:x.horse,trainer:x.trainer||null,course:x.course,time:x.time,odds:x.odds,
    raceDescriptor:descriptor,observedTarget:candidate,...audit};
 });
 return {status:'research-only diagnostic',date,selectionCount:records.length,selections:records,
  historicalRunners:(priorRuns||[]).length,
  policy:'Never assume what the trainer or owner intends. No live prediction scores change until permitted point-in-time observations and out-of-sample tests exist.'};
}
