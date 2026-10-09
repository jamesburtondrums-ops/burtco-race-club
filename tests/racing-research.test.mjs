import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRunningComment,validatePriorRun,styleEvidence,paceMap,researchCoverage,chronologicalAssessment,historicDrawEvidence,sectionalRelativePar,historicHandicapContext,historicalPriceAudit,RESEARCH_SOURCES} from '../functions/_lib/race-research.mjs';

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
const tracks=JSON.parse(readFileSync(new URL('../functions/_private/racing-track-profiles.json',import.meta.url),'utf8'));
assert.ok(tracks.tracks.length>=4,'Sourced track geometries stored');
assert.ok(tracks.tracks.every(t=>t.sourceUrls.length&&t.paceBiasNumerical===null&&t.drawBiasNumerical===null),'No invented track bias percentages');
const unsourced=historicDrawEvidence([mk('Faster','2026-10-02','Led')],{course:'York',distanceFurlongs:6,going:'Good',surface:'Turf',beforeDate:'2026-10-09'});
assert.equal(unsourced.status,'insufficient historic full-field results','Cannot claim bias from one partial race');
const fsp=sectionalRelativePar({overallDistanceFurlongs:8,overallTimeSeconds:96,finishSectionDistanceFurlongs:2,finishSectionSeconds:23,parFinishingSpeedPercent:102});
assert.equal(fsp.status,'descriptive','Sectional efficiency computed against supplied par');
assert.ok(Math.abs(fsp.fspPercent-104.35)<0.03,'Finishing speed metric uses distance and time correctly');
assert.equal(sectionalRelativePar({overallDistanceFurlongs:8,overallTimeSeconds:96,finishSectionDistanceFurlongs:2,finishSectionSeconds:23}).status,'unavailable','Without published par no sectional verdict');
assert.equal(historicHandicapContext([], '2026-10-09',92).status,'insufficient sourced historical figures','No handicap edge without sourced ratings and figures');
const dated=[{...mk('Sample','2026-10-01','Held up'),officialRating:88,performanceFigure:95},
{...mk('Sample','2026-10-03','Midfield'),officialRating:90,performanceFigure:96}];
const hd=historicHandicapContext(dated,'2026-10-09',92);
assert.equal(hd.ratedRuns,2,'Two historical handicap efforts included');
assert.equal(hd.meanFigureMinusMark,3.5,'Historical performance context arithmetic');
const audit=historicalPriceAudit(led);
assert.ok(audit.usableSelections>0,'Baseline includes actual historical odds and known results');
assert.equal(audit.oddsBands[0].oddsBand,'Odds-on (historical only)','Retired odds-on selections still reflected in history');
assert.equal(audit.marketBenchmark.observations,audit.usableSelections,'Benchmark accounts for all usable prices');
assert.ok(!audit.conclusions.includes('improved accuracy'),'No fabricated measured improvement');

console.log('PASS: sourced run comment tags, pace data gates, leakage-safe chronology and research readiness');
