import assert from 'node:assert/strict';
import {assessWinConfidence,publicSummary,positivePoints} from '../selection-quality.mjs';

const factor=grade=>({grade,finding:'A dated, verifiable positive form and race-condition observation',sourceUrl:'https://example.org/racecard',checkedAt:'2026-10-12T06:58:00Z'});
const eligible={
 horse:'Evidence Runner',course:'Test Track',time:'14:00',
 odds:'25/1',tier:'WATCH',confidenceTier:'NOT A FAVOURITE',marketRank:12,
 earlyOddsLockedAt:'2026-10-12T07:05:00Z',
 winAssessment:{decision:'high-confidence',reviewedAt:'2026-10-12T07:00:00Z',majorRisks:[],factors:{
  form:factor('strong'),abilityClass:factor('strong'),courseGoingTrip:factor('strong'),
  opposition:factor('strong'),fitness:factor('supported'),trainerJockey:factor('supported')
 }}
};
assert.equal(assessWinConfidence(eligible).qualified,true,'Verified race evidence qualifies an outsider even with WATCH market label');
const changed=structuredClone(eligible);
changed.odds='1/8';changed.marketRank=1;changed.tier='STRONG';changed.confidenceTier='PRIME';
assert.equal(assessWinConfidence(changed).qualified,true,'Being odds-on or favourite does not change confidence');
const unreviewed=structuredClone(eligible);delete unreviewed.winAssessment;
unreviewed.odds='1/100';unreviewed.tier='STRONG';
assert.equal(assessWinConfidence(unreviewed).qualified,false,'Short odds and STRONG labels cannot bypass review');
const weaker=structuredClone(eligible);weaker.winAssessment.factors.opposition.grade='neutral';
assert.equal(assessWinConfidence(weaker).qualified,false,'Without strong opposition assessment no WIN recommendation');
const concern=structuredClone(eligible);concern.winAssessment.majorRisks=['Unverified fitness after long break'];
assert.equal(assessWinConfidence(concern).qualified,false,'Major unresolved risk disqualifies');
const later=structuredClone(eligible);later.winAssessment.factors.form.checkedAt='2026-10-12T07:01:00Z';
assert.equal(assessWinConfidence(later).qualified,false,'Notes added after assessment must not retroactively strengthen confidence');
const retrospective=structuredClone(eligible);retrospective.winAssessment.reviewedAt='2026-10-12T07:10:00Z';
assert.equal(assessWinConfidence(retrospective).qualified,false,'Review after original publication cannot retrospectively qualify');
const missingRiskReview=structuredClone(eligible);delete missingRiskReview.winAssessment.majorRisks;
assert.equal(assessWinConfidence(missingRiskReview).qualified,false,'Risk review cannot be implied');
const preview={summary:'A clear single-statement verdict.',positivePoints:['Proven course form','Race-grade strength','Trainer has a good record'],tags:['RISK: unknown fitness']};
assert.equal(publicSummary(preview),'A clear single-statement verdict.');
assert.deepEqual(positivePoints(preview),preview.positivePoints);
const legacy=publicSummary({reason:'Won over the same trip. Next sentence has caveats.'});
assert.equal(legacy,'Won over the same trip.','Legacy descriptions default to one sentence');
console.log('PASS: horse data alone qualifies high-confidence wins, with no price/market-rank shortcuts and simple positive summaries');
