#!/usr/bin/env node
/**
 * Audits FROZEN pre-race selections against separately appended race results.
 * Non-destructive: never changes races.json, original snapshots, or paper bets.
 * Run: node scripts/audit-racing-model.mjs [path/to/races.json]
 */
import { readFileSync } from 'node:fs';

const input=process.argv[2] || 'data/races.json';
const data=JSON.parse(readFileSync(input,'utf8'));
const audits=Array.isArray(data.postRaceAudits)?data.postRaceAudits:[];
const seen=new Set();
const records=[];
const excluded=[];
for(const audit of audits){
  for(const r of audit.runnerResults||[]){
    const id=[audit.asOfDate,r.course,r.time,r.horse].map(x=>String(x||'').trim().toLowerCase()).join('|');
    if(seen.has(id)){excluded.push({id,reason:'duplicate'});continue;}
    seen.add(id);
    const result=Number(r.finished);
    const category=r.originCategory;
    if(!['ORIGINAL_WIN','ORIGINAL_EW'].includes(category)){
      excluded.push({id,reason:'not an original WIN or E/W selection',category});continue;
    }
    if(!Number.isInteger(result)||result<1){
      excluded.push({id,reason:'no validated ordinal finishing position'});continue;
    }
    const removed=!!(r.lateWithdrawn||r.lateWithdrawnWin);
    const runners=Number(r.runnerCount);
    const officialPlaces=Number.isInteger(runners)&&runners>0?(runners<=4?1:runners<=7?2:3):null;
    const place=(category==='ORIGINAL_EW')?
       (result>3?false:officialPlaces===null?null:result<=officialPlaces):null;
    const verification=String(r.sourceVerification||r.source||'');
    const publisherVerified=!/user.reported|pending/i.test(verification);
    records.push({date:audit.asOfDate,horse:r.horse,category,finish:result,
      removedAfterPublication:removed,runnerCount:officialPlaces===null?null:runners,
      standardPlace:place,resultEvidence:publisherVerified?'publisher_or_independent':'user_reported_or_pending',
      resultUrl:r.sourceUrl||null,originalOdds:r.selectedEarlyOdds||null});
  }
}
function tally(rows){
  const wins=rows.filter(r=>r.finish===1).length;
  const ew=rows.filter(r=>r.category==='ORIGINAL_EW');
  return {runners:rows.length,winners:wins,winnerRate:rows.length?Number((100*wins/rows.length).toFixed(1)):null,
    topThree:rows.filter(r=>r.finish<=3).length,
    eachWay:{total:ew.length,confirmedStandardPlace:ew.filter(r=>r.standardPlace===true).length,
      unknownPlaceTerms:ew.filter(r=>r.standardPlace===null).length},
    publisherOrIndependentEvidence:rows.filter(r=>r.resultEvidence==='publisher_or_independent').length,
    pendingIndependentVerification:rows.filter(r=>r.resultEvidence!=='publisher_or_independent').map(r=>r.horse)};
}
function wilson95(success,n){
  if(!n)return null;
  const z=1.95996398454,p=success/n,a=z*z/n,den=1+a;
  const c=(p+a/2)/den,rad=z*Math.sqrt(p*(1-p)/n+a/(4*n*n))/den;
  return [Number((100*(c-rad)).toFixed(1)),Number((100*(c+rad)).toFixed(1))];
}
const win=records.filter(r=>r.category==='ORIGINAL_WIN');
const ew=records.filter(r=>r.category==='ORIGINAL_EW');
const removed=records.filter(r=>r.removedAfterPublication);
const retained=records.filter(r=>!r.removedAfterPublication);
const watch=(data.researchWatchOutcomeAudit||[]).map(r=>({
  horse:r.horse,finish:r.finished,removedBeforeFinalPublication:!!r.removedBeforeFinalPublication
}));
const report={
  purpose:'Descriptive retrospective audit, NOT a held-out or predictive backtest',
  producedFrom:input,
  asOfDate:data.snapshotDate,
  auditedDates:[...new Set(records.map(r=>r.date))],
  originalPublished:{all:tally(records),win:tally(win),eachWay:tally(ew),
    winWilson95Pct:wilson95(win.filter(r=>r.finish===1).length,win.length)},
  laterRemovalAnnotations:{count:removed.length,examples:removed.map(r=>({
    date:r.date,horse:r.horse,category:r.category,finish:r.finish,
    outcome:r.finish===1?'WINNER_REMOVED':r.category==='ORIGINAL_EW'&&r.standardPlace===true?'PLACE_REMOVED':'NO_WIN_REMOVED'
  })),retainedAll:tally(retained),retainedWin:tally(retained.filter(r=>r.category==='ORIGINAL_WIN')),
    warning:'Not all late reviews are annotated. Do not interpret these conditional rates as a verified live strategy.'},
  priorWatchOnlyResults:watch,
  omitted:excluded,
  caveats:[
    'Audit dates only: days lacking complete outcome records are excluded, not treated as losses.',
    'Late removals cannot change original published denominators or historical outcomes.',
    'Results marked user-reported or pending independent confirmation remain distinct.',
    'Standard each-way place figures are not proof of bookmaker terms or accepted wagers.',
    'Some archived E/W results lack runner counts; never infer an unrecorded paid place.',
    'Do not use SP as the original quote; no historical wagers, BOG or profit are manufactured.',
    'Selection gates check documentation; they do not estimate probabilities or prove uplift.',
    'No held-out comparison: propose changes prospectively and test on future frozen races.'
  ]
};
console.log(JSON.stringify(report,null,2));
