import test from 'node:test';
import assert from 'node:assert/strict';
import {assessTripleLock} from '../triple-lock.mjs';

const t='2026-10-28T08:00:00Z';
const doc={status:'verified',note:'Checked dated comparable historical evidence',sourceUrl:'https://example.org/form',checkedAt:t};
const keys=['formAndOpposition','classMarkWeightClaim','courseTripGoing','paceDrawJumping','headgearHistory','trainerCourseForm','trainerRaceTypeForm','trainerRecentForm','jockeyBookingChange','trainerJockeyPartnership','rivalPotential'];
const make=(name,cloth,ability)=>({horse:name,trainer:'A',jockey:'B',cloth,weight:'9-0',headgear:'none',
 lastThreeRuns:[],sources:['https://example.org/racecard'],checks:Object.fromEntries(keys.map(k=>[k,{...doc}])),
 grades:{ability,conditions:4,execution:4,readiness:4,pace:4}});
const runners=[make('Alpha',1,5),make('Beta',2,2),make('Gamma',3,1),make('Delta',4,1)];
const rivals=runners.slice(1).map(r=>({horse:r.horse,bestCase:'A plausible best-case against stronger opposition',whyNotChosen:'Less achieved evidence in matching race conditions',sourceUrl:'https://example.org/form'}));
const stamp={...doc};
const six=Object.fromEntries(['going','nonRunners','ridersWeights','headgear','raceTerms','prices'].map(x=>[x,stamp]));
const confidence=Object.fromEntries(['evidenceIntegrity','abilityEdge','rivalResilience','paceConditions','connectionsEquipment','lateStability'].map(x=>[x,5]));
const pick={
 horse:'Alpha',runnerCount:4,selectionPublishedAt:'2026-10-28T09:00:00Z',
 tripleLock:{version:'C-2026-10-27',frozenAt:'2026-10-28T08:30:00Z',scheduledOff:'2026-10-28T13:06:00Z',
 runners, challengerReview:{allRunnersRebutted:true,markClassCompared:true,uncertaintiesTested:true,
 strongestCounterargument:'The strongest rival could improve for a new trip',
 rivals,paceScenarios:['normal race shape','hard early gallop','slow tactical finish'],
 unresolvedMaterialRival:false},liveRecheck:six,confidenceDomains:confidence}
};
test('pre-policy record is not retrospectively rewritten',()=>{
 assert.equal(assessTripleLock({selectionPublishedAt:'2026-10-22T08:00:00Z'}).phase,'LEGACY');
});
test('new pick lacking the whole-field record is held',()=>{
 assert.equal(assessTripleLock({selectionPublishedAt:'2026-10-28T08:00:00Z'}).qualified,false);
});
test('all locks satisfied produce an audit result, not a win probability',()=>{
 const x=assessTripleLock(pick);
 assert.equal(x.qualified,true);
 assert.equal(x.phase,'TRIPLE-LOCKED');
 assert.equal(x.notWinProbability,true);
 assert.equal(x.performanceIndex,88);
 assert.equal(x.level,'SUPPORTED');
});
test('missing a trainer race-type check blocks the selection',()=>{
 const x=structuredClone(pick);
 delete x.tripleLock.runners[2].checks.trainerRaceTypeForm;
 assert.equal(assessTripleLock(x).qualified,false);
});
test('material rival uncertainty caps the conviction even if domains perfect',()=>{
 const x=structuredClone(pick);
 x.tripleLock.challengerReview.unresolvedMaterialRival=true;
 assert.ok(assessTripleLock(x).confidenceIndex<=60);
});
test('late retrospective freeze is rejected',()=>{
 const x=structuredClone(pick);
 x.tripleLock.frozenAt='2026-10-28T13:30:00Z';
 assert.equal(assessTripleLock(x).qualified,false);
});
