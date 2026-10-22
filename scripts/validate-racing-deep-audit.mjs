#!/usr/bin/env node
/**
 * Pre-off independent runner research coverage verifier.
 * Never modifies frozen selections or the paper ledger.
 * Run: node scripts/validate-racing-deep-audit.mjs
 * Output: JSON; nonzero exit when evidence is missing.
 */
import {readFileSync} from 'node:fs';
const files=["data/research/2026-10-22-deep-ffos-las-14-36.json","data/research/2026-10-22-deep-newmarket-14-55.json","data/research/2026-10-22-deep-newmarket-16-05.json","data/research/2026-10-22-deep-clonmel-16-30.json","data/research/2026-10-22-deep-southwell-aw-17-00.json","data/research/2026-10-22-deep-southwell-aw-18-30.json"];
const defects=[];
const races=[];
let total=0,runnerResearchVerified=0,paceMeasured=0,partnershipStatsVerified=0;
for(const file of files) {
 const data=JSON.parse(readFileSync(file,'utf8'));
 const seen=new Set();
 const rows=data.runners||[];
 if(rows.length!==(data.activeRunners??data.declaredActive??rows.length)) defects.push(file+': declared count mismatch');
 for (const x of rows) {
   total++;
   if(!x.horse||seen.has(x.horse))defects.push(file+': duplicate/unnamed runner '+x.horse);
   seen.add(x.horse);
   const recent=x.previousRuns||[];
   const source=String(x.sourceProfile||'');
   const assessment=String(x.bookingAndHandicapReview||x.deepDatedFinding||'');
   if(recent.length>=3 && recent.every(t=>typeof t==='string'&&t.length>=24)
     &&/^https:\/\/www\.racingtv\.com\/profiles\/horse\//.test(source)
     &&assessment.length>=65 && x.jockey && x.trainer && x.officialRating!==undefined
     &&(x.reviewCompleteness?.atLeastThreePastStartObservations===true)) runnerResearchVerified++;
   else defects.push(file+': incomplete runner profile '+x.horse);
   if(x.reviewCompleteness?.quantitativePaceModel===true) paceMeasured++;
   if(x.reviewCompleteness?.trainerJockeyPairStatistics===true)partnershipStatsVerified++;
 }
 races.push({race:data.race||data.course+' '+data.localOff,entries:rows.length,
    verifiedIndividualProfiles:rows.filter(x=>x.reviewCompleteness?.atLeastThreePastStartObservations===true).length,
    raceSpecificPaceModelVerified:false});
}
const report={asOf:'2026-10-22',scope:'Six explicitly selected UK/Irish races, not all UK/Irish meetings',
 raceCount:races.length,totalActiveRunners:total,deepRecentFormAndBookingProfiles:runnerResearchVerified,
 measuredPaceProfiles:paceMeasured,verifiedTrainerJockeyJointStrikeRateProfiles:partnershipStatsVerified,
 allCompleteForAvailableFormResearch:defects.length===0,
 caveat:'At least 3 dated prior observations plus trainer/jockey booking and contextual judgement, not exhaustive archived video sectionals, verified stable intent, calibrated probabilities, comprehensive trainer course splits or executable bookmaker terms.',
 races,defects};
console.log(JSON.stringify(report,null,2));
if(defects.length)process.exitCode=1;
