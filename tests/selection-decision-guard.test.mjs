import test from 'node:test';
import assert from 'node:assert/strict';
import {assessProposedRevocation} from '../selection-quality.mjs';

const original={
  horse:'Frozen Runner',
  selectionPublishedAt:'2026-10-22T08:00:00Z'
};
const fact={
  severity:'HIGH',factor:'opposition',
  finding:'Another credible runner has improved since publication, but the original evidence still applies.',
  sourceUrl:'https://example.org/evidence',
  observedAt:'2026-10-22T09:00:00Z'
};
const positive={
  finding:'Recent race-winning conditions and course evidence still support this original selection.',
  sourceUrl:'https://example.org/original',
  status:'STILL_VALID'
};
const base={reviewedAt:'2026-10-22T09:30:00Z',
  reasonClass:'WIN_REVOKE',materialNewFacts:[fact],
  originalPositiveEvidence:[positive],fullFieldRechecked:true};

test('new odds alone never revoke race ability',()=>{
  const x=assessProposedRevocation(original,{...base,reasonClass:'VALUE_REPRICE'});
  assert.equal(x.evidenceSufficient,false);
  assert.equal(x.action,'REPRICE_ONLY');
});
test('a plausible HIGH concern does not outweigh all-still-valid original positives',()=>{
  const x=assessProposedRevocation(original,base);
  assert.equal(x.evidenceSufficient,false);
});
test('a missing whole-field recheck blocks ability revocation',()=>{
  const x=assessProposedRevocation(original,{...base,fullFieldRechecked:false});
  assert.equal(x.evidenceSufficient,false);
});
test('a critical, documented invalidation can be proposed for a human decision',()=>{
  const x=assessProposedRevocation(original,{
    ...base,materialNewFacts:[{...fact,severity:'CRITICAL',factor:'nonRunner',
      finding:'The horse was formally withdrawn by the racecourse before the scheduled off.'}],
    originalPositiveEvidence:[{...positive,status:'MATERIALLY_INVALIDATED'}]
  });
  assert.equal(x.evidenceSufficient,true);
  assert.equal(x.action,'REVOKE_READY_FOR_HUMAN_DECISION');
});
test('do not retroactively call a same-time or earlier review a new finding',()=>{
  const x=assessProposedRevocation(original,{...base,reviewedAt:original.selectionPublishedAt});
  assert.equal(x.evidenceSufficient,false);
});
