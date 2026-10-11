import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectTrackProfile,trackPerformanceEvidence,assessEntryHypotheses,buildTrainerView,parseRaceDistance} from '../functions/_lib/trainer-view.mjs';
const profiles=JSON.parse(readFileSync(new URL('../functions/_private/racing-track-profiles.json',import.meta.url),'utf8'));
const races=JSON.parse(readFileSync(new URL('../data/races.json',import.meta.url),'utf8'));
assert.ok(profiles.tracks.length>=15,'Multiple verified track layouts available');
assert.ok(profiles.tracks.every(x=>x.sourceUrls.length>0 && x.paceBiasNumerical===null),'Course descriptions are sourced; no made-up measured bias');
assert.equal(selectTrackProfile(profiles,{course:'Newmarket'}).status,'ambiguous','Never conflate Rowley and July');
const rowley=selectTrackProfile(profiles,{course:'Newmarket',configuration:'Rowley Mile',surface:'Turf',discipline:'Flat'});
assert.equal(rowley.trackId,'newmarket rowley',JSON.stringify(rowley));
assert.equal(selectTrackProfile(profiles,{course:'Kempton',surface:'all weather',discipline:'Flat',distanceFurlongs:5}).trackId,'kempton aw inner');
assert.equal(selectTrackProfile(profiles,{course:'Kempton',surface:'all weather',discipline:'Flat',distanceFurlongs:6}).trackId,'kempton aw outer');
assert.equal(selectTrackProfile(profiles,{course:'Kempton',surface:'all weather',discipline:'Flat'}).status,'ambiguous','Trip needed to resolve AW loops');
assert.equal(selectTrackProfile(profiles,{course:'Chepstow',discipline:'Jumps'}).trackId,'chepstow jumps');
assert.equal(selectTrackProfile(profiles,{course:'Chepstow',discipline:'Flat'}).trackId,'chepstow flat');
assert.equal(selectTrackProfile(profiles,{course:'Naas'}).status,'unavailable','Do not invent an Irish course layout');
assert.equal(parseRaceDistance('Group 3, 1m1f, £53,875 winner'),9);
assert.equal(parseRaceDistance('Class 4 Handicap 6f'),6);
assert.equal(parseRaceDistance('No trip supplied'),null);
const makeRun=(date,course,position,extra={})=>({
 horse:'Example Horse',date,course,raceTime:'14:00',distanceFurlongs:7,
 finishingPosition:position,sourceUrl:'https://www.attheraces.com/results',
 sourceCheckedAt:date+'T18:00:00Z',discipline:'Flat',surface:'Turf',
 officialRating:92,going:'Good to soft',jockey:'Rider A',...extra
});
const runs=[
 makeRun('2026-09-01','York',1,{finishSpeedPercent:101,parFinishSpeedPercent:103,sectionalPermissionVerified:true}),
 makeRun('2026-09-11','York',2),
 makeRun('2026-09-21','York',5),
 makeRun('2026-09-23','Goodwood',4),
 makeRun('2026-10-13','York',1),
 makeRun('2026-09-05','York',1,{sourceCheckedAt:'2026-10-12T12:00:00Z'}),
 makeRun('2026-09-07','York',1,{sourceUrl:''})
];
const trg={course:'York',surface:'Turf',discipline:'Flat',distanceFurlongs:7,isHandicap:true,officialRating:91,
 going:'Good to soft',jockey:'Rider A',prizeWinnerGBP:21000};
let ev=trackPerformanceEvidence({horse:'Example Horse',asOfDate:'2026-10-10',target:trg,priorRuns:runs,profiles});
assert.equal(ev.directRuns,3,'Only three reliably sourced past York starts counted');
assert.equal(ev.similarLayoutRuns,0,'Goodwood sharp layout is not equivalent to galloping York');
assert.equal(ev.eligibleRuns,4,'Invalid or future-source prior observations excluded');
assert.equal(ev.status,'repeated course evidence');
assert.equal(ev.sectionalParComparisons.length,1,'Actual and race-specific par needed');
assert.equal(ev.sectionalParComparisons[0].delta,-2,'Par delta not absolute speed');
let a=assessEntryHypotheses({horse:'Example Horse',asOfDate:'2026-10-10',target:trg,priorRuns:runs,profiles});
assert.equal(a.trainerIntent,'not established','No insider trainer intent assumed');
assert.ok(a.hypotheses.some(x=>x.label.includes('previously effective course')));
assert.ok(a.hypotheses.some(x=>x.label.includes('Handicap mark')));
assert.ok(a.hypotheses.some(x=>x.label.includes('jockey partnership')));
assert.ok(a.hypotheses.some(x=>x.label.includes('going description')));
const no=assessEntryHypotheses({horse:'Unseen',asOfDate:'2026-10-10',target:trg,priorRuns:runs,profiles});
assert.equal(no.track.status,'insufficient evidence','No horse profile fabricated');
assert.equal(no.hypotheses.length,0,'No stable intent manufactured without sourced history');
const report=buildTrainerView(races,[],profiles);
assert.equal(report.date,'2026-10-12');
assert.equal(report.selectionCount,10);
assert.ok(report.selections.every(x=>x.trainerIntent==='not established'));
assert.ok(report.selections.every(x=>x.track.target.status==='course geometry documented'),'Monday runner course variants must resolve');
assert.ok(report.selections.some(x=>x.course==='Musselburgh'&&x.track.target.trackId==='musselburgh flat'));
assert.ok(report.selections.some(x=>x.course==='Kempton'&&x.track.target.trackId==='kempton aw outer'));
assert.ok(report.selections.filter(x=>x.course==='Newcastle').every(x=>x.track.target.trackId==='newcastle aw straight'));
assert.equal(selectTrackProfile(profiles,{course:'Newcastle',surface:'all weather',discipline:'Flat'}).status,'ambiguous','No Newcastle layout guessing without actual trip');
assert.equal(parseRaceDistance('Class 5, 7f14yd')>7,true,'Horse race distance with yards parsed');
assert.equal(parseRaceDistance('Class 5, 1m5yd')>8,true,'One-mile straight-plus-yards parsed');
const archived=JSON.parse(readFileSync(new URL('../data/archive/2026-10-10-races.json',import.meta.url),'utf8'));
const archivedReport=buildTrainerView(archived,[],profiles);
assert.equal(archivedReport.date,'2026-10-10');
assert.ok(archivedReport.selections.some(x=>x.course==='Newmarket'&&x.track.target.trackId==='newmarket rowley'),'Archived Rowley selections still map correctly');
assert.ok(report.selections.every(x=>x.gate.includes('RESEARCH ONLY')),'Empty data blocks any selective upgrade');
const dashboard=readFileSync(new URL('../backoffice.js',import.meta.url),'utf8');
assert.match(dashboard,/Trainer\\'s View/,'Private trainer research dossier visible');
const api=readFileSync(new URL('../functions/api/backoffice/report.js',import.meta.url),'utf8');
assert.match(api,/trainerView:buildTrainerView/,'Dossiers only assembled behind PIN-authenticated report');
console.log('PASS: course variant, topography, trainer-intent hypotheses, sectional provenance, and anti-leakage gates');
