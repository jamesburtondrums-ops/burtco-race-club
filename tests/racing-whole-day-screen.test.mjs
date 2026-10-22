import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=p=>JSON.parse(readFileSync(p,'utf8'));
const index=load('data/research/2026-10-22-all-40-race-screen.json');
const existing=load('data/races.json');
const picks=load('data/research/2026-10-22-clear-selections.json');
const courses=['newmarket','ffos-las','carlisle','clonmel','southwell'];

test('all five meetings and all 40 racecards match source data',()=>{
 assert.equal(index.totalMeetings,5);
 assert.equal(index.totalRaces,40);
 let count=0,withdrawn=0;
 for(const course of courses) {
  const data=load('data/research/2026-10-22-all-races-'+course+'.json');
  assert.equal(data.date,'2026-10-22');
  for(const race of data.races) {
   const active=race.runners.filter(r=>!r.nonRunnerFlag);
   assert.equal(active.length,race.active,course+' '+race.off);
   const indexed=index.races.find(r=>r.course===course&&r.off===race.off);
   assert.ok(indexed,course+' '+race.off+' missing');
   assert.equal(indexed.active,race.active);
   assert.equal(indexed.fullField.length,active.length);
   assert.equal(indexed.nonRunners.length,race.runners.length-active.length);
   assert.equal(new Set(active.map(r=>r.horse.toLowerCase())).size,active.length);
   count+=active.length;withdrawn+=race.runners.length-active.length;
  }
 }
 assert.equal(count,index.totalActive);
 assert.equal(withdrawn,index.nonRunnerEntries);
 assert.equal(count,397);
 assert.equal(withdrawn,31);
});
test('no off-time exceeded by a claimed prospective addition',()=>{
 assert.equal(picks.selections.length,6);
 assert.deepEqual(picks.selections.slice(0,4).map(s=>s.horse),
   ['Great Blasket','The Quiet Gent','Blue Tulip','Izzari']);
 for(const item of picks.selections.slice(4)) {
  assert.ok(item.newlyAddedAfterWholeDayScanAt);
  assert.ok(item.offLocal>item.newlyAddedAfterWholeDayScanAt.slice(11,16),
    'New pick has already passed: '+item.horse);
 }
});
test('original frozen winners and cleared ledger remain off limits',()=>{
 assert.equal(existing.snapshotDate,'2026-10-22');
 assert.equal(existing.betSelections.length,5);
 assert.equal(picks.originalSnapshotIntegrity.frozenRacesJsonUnchanged,true);
 assert.equal(picks.originalSnapshotIntegrity.ledgerClearedAndUntouched,true);
 assert.equal(picks.scope.daywideCoverageComplete,false);
});
