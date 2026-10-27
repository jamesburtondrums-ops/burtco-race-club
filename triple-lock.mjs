// Racing Intelligence Challenger C — forward-only editorial evidence gate.
// Research/evidence quality, NEVER a calibrated win probability.
// Never rewrite historical selections or prices. Effective after user instruction.
export const TRIPLE_LOCK_EFFECTIVE='2026-10-27T21:00:00Z';
const domains=['formAndOpposition','classMarkWeightClaim','courseTripGoing','paceDrawJumping','headgearHistory','trainerCourseForm','trainerRaceTypeForm','trainerRecentForm','jockeyBookingChange','trainerJockeyPartnership','rivalPotential'];
const components=['ability','conditions','execution','readiness','pace'];
const weight={ability:8,conditions:5,execution:3,readiness:2,pace:2};
const weights={evidenceIntegrity:20,abilityEdge:20,rivalResilience:25,paceConditions:15,connectionsEquipment:10,lateStability:10};
const validAt=s=>typeof s==='string'&&!Number.isNaN(Date.parse(s))&&/(Z|[+-]\d\d:\d\d)$/.test(s);
const isUrl=s=>typeof s==='string'&&/^https:\/\/[^ ]+\.[^ /]+/.test(s);
const okText=s=>typeof s==='string'&&s.trim().length>=12;
const nameOk=s=>typeof s==='string'&&s.trim().length>=1;
const fail=why=>({qualified:false,phase:'HOLD',reason:why,confidenceIndex:null,notWinProbability:true});
const grade=g=>g===null||(typeof g==='number'&&Number.isFinite(g)&&g>=0&&g<=5);
function gradeBounds(grades){
  const missing=[];
  let index=0,low=0,high=0;
  for(const k of components){
    const x=grades?.[k];
    if(x===undefined||!grade(x))return null;
    if(x===null){missing.push(k);index+=weight[k]*2.5;high+=weight[k]*5;}
    else {index+=weight[k]*x;low+=weight[k]*x;high+=weight[k]*x;}
  }
  return {index,low,high,unknown:missing};
}
function tested(doc,freeze){
  return !!doc&&['verified','unknown'].includes(doc.status)&&okText(doc.note)&&isUrl(doc.sourceUrl)&&validAt(doc.checkedAt)&&Date.parse(doc.checkedAt)<=freeze;
}
function evidenceRunner(r,freeze){
  if(!nameOk(r?.horse)||!nameOk(r?.trainer)||!nameOk(r?.jockey)||!r?.weight||!('headgear' in r)||!Number.isInteger(r?.cloth))return false;
  if(!Array.isArray(r?.lastThreeRuns)||!Array.isArray(r?.sources)||!r.sources.length||r.sources.some(x=>!isUrl(x)))return false;
  if(!gradeBounds(r.grades))return false;
  return domains.every(k=>tested(r.checks?.[k],freeze));
}
// For any pick first recorded after the change, require the three locks.
// Freeze and selection publication timestamps are both UTC/offset-aware.
export function assessTripleLock(pick){
  const published=pick?.selectionPublishedAt;
  if(!validAt(published))return fail('Missing valid pre-publication time');
  if(Date.parse(published)<Date.parse(TRIPLE_LOCK_EFFECTIVE))
    return {qualified:true,phase:'LEGACY',reason:'Historical pick; original evidence/ledger preserved',confidenceIndex:null,notWinProbability:true};
  const lock=pick?.tripleLock;
  if(!lock||lock.version!=='C-2026-10-27')return fail('Challenger C triple-lock record absent');
  const freeze=Date.parse(lock.frozenAt),off=Date.parse(lock.scheduledOff);
  if(!validAt(lock.frozenAt)||!validAt(lock.scheduledOff)||!(freeze<off)||freeze>Date.parse(published))
    return fail('Lock 3: snapshot must be dated before publication and before the scheduled off');
  const r=lock.runners;
  if(!Array.isArray(r)||r.length<2||r.length!==Number(pick.runnerCount))return fail('Lock 1: declared field and complete runner register disagree');
  const names=r.map(x=>String(x.horse||'').trim().toLowerCase());
  if(new Set(names).size!==r.length||!names.includes(String(pick.horse||'').trim().toLowerCase()))
    return fail('Lock 1: duplicate/missing entries or selected runner absent');
  if(r.some(x=>!evidenceRunner(x,freeze)))return fail('Lock 1: a runner lacks verified/explicit-unknown sourced evidence (including booking/headgear/trainer checks)');
  const ranked=r.map(x=>({name:x.horse,cloth:x.cloth,grades:x.grades,...gradeBounds(x.grades)}))
    .sort((a,b)=>b.index-a.index||a.cloth-b.cloth);
  const chosen=ranked.find(x=>x.name.toLowerCase()===String(pick.horse).trim().toLowerCase());
  if(chosen!==ranked[0])return fail('Lock 2: nominated selection not top-ranked by frozen C grades');
  const c=lock.challengerReview;
  if(!c||c.allRunnersRebutted!==true||c.markClassCompared!==true||c.uncertaintiesTested!==true||!okText(c.strongestCounterargument)||
     !Array.isArray(c.rivals)||c.rivals.length<Math.min(3,r.length-1)||
     !Array.isArray(c.paceScenarios)||c.paceScenarios.length<3||c.paceScenarios.some(x=>!okText(x)))
    return fail('Lock 2: incomplete adversarial field/rival review, class comparison, uncertainty or pace scenarios');
  const others=new Set(ranked.slice(1).map(x=>x.name.toLowerCase()));
  if(c.rivals.some(x=>!others.has(String(x.horse||'').trim().toLowerCase())||!okText(x.bestCase)||!okText(x.whyNotChosen)||!isUrl(x.sourceUrl)))
    return fail('Lock 2: rival cases lack named factual evidence');
  const live=lock.liveRecheck;
  const items=['going','nonRunners','ridersWeights','headgear','raceTerms','prices'];
  if(!live||items.some(k=>!tested(live[k],freeze)))return fail('Lock 3: going/declaration/riders/equipment/price checks incomplete');
  let sensitive=ranked.slice(1).some(x=>x.high>=chosen.low);
  for(const alt of ranked.slice(1)){
    for(const key of components){
      if(chosen.grades[key]!==null){
        const g={...chosen.grades,[key]:Math.max(0,chosen.grades[key]-1)};
        if(gradeBounds(g).index<alt.index)sensitive=true;
      }
      if(alt.grades[key]!==null){
        const g={...alt.grades,[key]:Math.min(5,alt.grades[key]+1)};
        if(gradeBounds(g).index>chosen.index)sensitive=true;
      }
    }
  }
  const dims=lock.confidenceDomains;
  if(!dims||Object.keys(weights).some(k=>typeof dims[k]!=='number'||dims[k]<0||dims[k]>5))
    return fail('Score unassessed: all six confidence dimensions 0–5 required');
  let confidence=Object.entries(weights).reduce((sum,[key,w])=>sum+dims[key]*w/5,0);
  if(chosen.unknown.length)confidence=Math.min(confidence,65);
  if(sensitive)confidence=Math.min(confidence,70);
  if(c.unresolvedMaterialRival)confidence=Math.min(confidence,60);
  confidence=Math.round(confidence*10)/10;
  return {qualified:true,phase:'TRIPLE-LOCKED',reason:'Three dated independent audits complete; this is a research preference, not verified winning probability',
     confidenceIndex:confidence,notWinProbability:true,performanceIndex:chosen.index,
     bestRival:ranked[1]?.name||null,sensitive,level:confidence>=80&&!sensitive?'SUPPORTED':'TENTATIVE'};
}
