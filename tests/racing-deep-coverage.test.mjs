import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const f=JSON.parse(readFileSync('data/races.json','utf8'));
test('Frozen 22 October original selection snapshots remain five',()=>{
 assert.equal(f.snapshotDate,'2026-10-22');
 assert.equal(f.betSelections.length,5);
});
test('Six research races cover all 66 active runners without missing individual profiles',()=>{
 const r=JSON.parse(execFileSync(process.execPath,['scripts/validate-racing-deep-audit.mjs'],{encoding:'utf8'}));
 assert.equal(r.raceCount,6);
 assert.equal(r.totalActiveRunners,66);
 assert.equal(r.deepRecentFormAndBookingProfiles,66);
 assert.equal(r.defects.length,0);
 assert.equal(r.verifiedTrainerJockeyJointStrikeRateProfiles,0);
 assert.equal(r.measuredPaceProfiles,0);
});
