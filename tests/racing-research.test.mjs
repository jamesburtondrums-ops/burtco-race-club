import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRunningComment,validatePriorRun,styleEvidence,paceMap,researchCoverage,chronologicalAssessment,RESEARCH_SOURCES} from '../functions/_lib/race-research.mjs';

const mk=(horse,date,note,course='York')=>({
 horse,date,course,raceTime:'14:10',sourceUrl:'https://www.britishhorseracing.com/racing/',
 sourceCheckedAt:date+'T18:30:00Z',comment:note,going:'Good',surface:'Turf'
});
assert.equal(parseRunningComment('Made all, kept on strongly').style,'leader','Front runner detected');
assert.equal(parseRunningComment('Held up in rear, hampered, finished strongly').style,'closer','Hold-up style found');
assert.deepEqual(parseRunningComment('Held up in rear, hampered, finished strongly').tags,['interference','late_gain'],'Incidents and finishing ability tagged separately');
assert.equal(parseRunningComment('Tracked leaders, denied clear run, stayed on').style,'prominent','Prominent racing style');
assert.equal(parseRunningComment('Not hampered, chased leaders').tags.includes('interference'),false,'Negated incident not treated as trouble');
assert.equal(parseRunningComment('Made mistake at the last, weakened').tags.includes('jump_error'),true,'Jumping trouble is captured');
assert.equal(parseRunningComment('').style,null,'No invented style from missing comments');
assert.equal(validatePriorRun(mk('Faster','2026-10-02','Led'),'2026-10-09').ok,true,'Past race with URL usable');
assert.equal(validatePriorRun(mk('Faster','2026-10-09','Led'),'2026-10-09').ok,false,'Same-day/race evidence does not leak');
assert.equal(validatePriorRun({...mk('Faster','2026-10-02','Led'),sourceUrl:''},'2026-10-09').ok,false,'Require source provenance');
const history=[mk('Faster','2026-10-01','Led throughout'),mk('Faster','2026-10-03','Set the pace'),mk('Faster','2026-10-05','Made all'),mk('Faster','2026-10-11','Held up in rear')];
let s=styleEvidence('Faster',history,'2026-10-09');
assert.equal(s.style,'leader','Three consistent historical leaders establish a pattern');
assert.equal(s.priorRaces,3,'Future runner details excluded');
s=styleEvidence('Faster',history.slice(0,1),'2026-10-09');
assert.equal(s.style,null,'Single observation not counted as reliable running style');
const runners=['Faster','Second','Third','Fourth','Fifth'];
const pace=paceMap(runners,history,'2026-10-09');
assert.equal(pace.status,'insufficient data','Refuse unsupported field-wide pace estimate');
const raceNotes=JSON.parse(readFileSync(new URL('../functions/_private/racing-historical-runs.json',import.meta.url),'utf8'));
const led=JSON.parse(readFileSync(new URL('../data/bet-ledger.json',import.meta.url),'utf8'));
const cov=researchCoverage(led,raceNotes.runs);
assert.equal(cov.quantitativeRetrainReady,false,'No fabricated 500-race historical training claim');
assert.ok(cov.recordedTipBets>=33,'Known betting outcomes counted separately from full historical fields');
assert.equal(chronologicalAssessment(raceNotes.runs).ready,false,'Walk-forward training requires independent historical data');
assert.ok(RESEARCH_SOURCES.some(x=>x.url.includes('official-ratings')),'BHA source provenance included');
const dash=readFileSync(new URL('../backoffice.js',import.meta.url),'utf8');
assert.match(dash,/Historical research laboratory/,'Back-office research panel visible');
console.log('PASS: sourced run comment tags, pace data gates, leakage-safe chronology and research readiness');
