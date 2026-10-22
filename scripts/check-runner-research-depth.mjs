#!/usr/bin/env node
/**
 * Non-destructive report on runner-by-runner evidence depth.
 * node scripts/check-runner-research-depth.mjs
 * Returns 0 for report generation; does not claim that incomplete reviews are publishable.
 */
import {readFileSync} from 'node:fs';
const races=JSON.parse(readFileSync('data/races.json','utf8'));
const extra=JSON.parse(readFileSync('data/research/2026-10-22-newmarket-1605.json','utf8'));
const required=['recentForm','goingTripClass','risks','jockeyBooking'];
const deep=audit=>({
 race:audit.race,
 runnerCount:audit.runners.length,
 audited:audit.runners.filter(r=>required.every(k=>typeof r[k]==='string'&&r[k].length>25)
   &&typeof r.jockey==='string'&&r.jockey.length
   &&typeof r.trainer==='string'&&r.trainer.length
   &&r.officialRating!==undefined
   &&Array.isArray(r.sourceUrls)&&r.sourceUrls.length>=2).length,
 stillUnverified:audit.runners.filter(r=>Array.isArray(r.unverified)&&r.unverified.length).length
});
const existing=(races.individualRunnerRacecardAudits||[]).map(a=>{
 const entries=a.entries||[];
 return {race:a.race,originalDeclared:a.runners,entryCount:entries.length,
   missingIndividualRaceHistory:entries.filter(e=>e.missingDetailedRaceHistory===true).length,
   missingJockeyBookingResearch:entries.filter(e=>!e.jockeyBooking&& !e.jockeyTrainerBookingEvidence).length,
   missingCurrentPaceEvidence:entries.filter(e=>!e.paceAnalysis&&!e.paceDrawAssessment).length,
   headline:'Racecard-level screening only; NOT yet full runner-level investigative research'};
});
const report={
 asOfDate:races.snapshotDate,
 publishedSelectedRaces:existing,
 currentDeepDive:deep({...extra,race:extra.course+' '+extra.localOff}),
 totalPublishedRacecardEntries:existing.reduce((a,x)=>a+x.entryCount,0),
 rule:'Every single declared runner must have recent-race facts, trainer/jockey and previous-partnership check, ground/trip, handicap change, pace/draw and source timestamps. Unknown evidence must be explicit. A complete list of names and ORs is not a deep dive.',
 integrity:'No changes to frozen selections, results or betting ledger.'
};
console.log(JSON.stringify(report,null,2));
