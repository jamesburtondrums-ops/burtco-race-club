import assert from 'node:assert/strict';
import {countVerifiedFields} from '../research/shadow-field-count.mjs';
const mk=(horse,course='York')=>({date:'2026-10-09',course,raceTime:'13:30',horse,runnerCount:2,finishingPosition:1,sourceRights:'owner-supplied',permissionReference:'Written permission',sourceUrl:'https://example.org',sourceCheckedAt:'2026-10-10T08:00:00Z'});
assert.equal(countVerifiedFields([mk('A')]).races,0);
assert.equal(countVerifiedFields([mk('A'),mk('B')]).races,1);
assert.equal(countVerifiedFields([mk('A'),mk('B','Newmarket')]).races,0);
