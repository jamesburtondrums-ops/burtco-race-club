import assert from 'node:assert/strict';
import {completeField,priorOnly} from '../research/shadow-field-check.mjs';
const row=(horse,pos)=>({date:'2026-10-09',horse,course:'Dundalk',raceTime:'20:30',
 runnerCount:2,finishingPosition:pos,sourceRights:'owner-supplied',
 permissionReference:'Written owner data permission',sourceUrl:'https://example.org/race',
 sourceCheckedAt:'2026-10-10T08:00:00Z'});
const a=row('A',1),b=row('B',2);
assert.equal(completeField([a]),false,'Partial field must not qualify');
assert.equal(completeField([a,b]),true,'Complete rights-cleared field qualifies');
assert.equal(completeField([a,{...b,sourceRights:null}]),false,'Rights required');
assert.equal(priorOnly([a,b],'2026-10-10','2026-10-10T07:00:00Z').length,0,'Observation after cutoff excluded');
assert.equal(priorOnly([a,b],'2026-10-11','2026-10-10T09:00:00Z').length,2,'Prior dated observations included');
console.log('PASS: shadow full-field and chronology guards');
