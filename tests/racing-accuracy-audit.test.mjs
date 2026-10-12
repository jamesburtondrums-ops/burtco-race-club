import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditSelectionEvidence,accuracyPriorities} from '../functions/_lib/accuracy-audit.mjs';

const current=JSON.parse(readFileSync(new URL('../data/races.json',import.meta.url),'utf8'));
const audit=auditSelectionEvidence(current);
const groups=['todaySelections','midshotsToday','longshotsToday','lucky15Only'];
const ids=new Set(groups.flatMap(g=>(current[g]||[]).map(p=>[p.horse,p.course,p.time].map(v=>String(v||'').trim().toLowerCase()).join('|'))));
assert.equal(audit.snapshotDate,current.snapshotDate);
assert.equal(audit.selectedRunners,ids.size,'Every selected horse audited once even when included in more than one category');
assert.equal(audit.selections.length,ids.size);
assert.equal(audit.priorities.length,6,'Practical, freely viewable evidence takes precedence over sectional telemetry');
assert.match(audit.promotionRule,/PRE-OFF/,'Pre-off benchmark explicitly required');
assert.match(audit.status,/no calibrated model/,'No invented accuracy claim');
assert.ok(audit.exactDatedQuotes<=audit.selectedRunners);
assert.ok(audit.selectionsWithSourcedPriorRuns<=audit.selectedRunners);
const horse={horse:'Test Runner',course:'Test Track',time:'15:00',odds:'4/1',trainer:'Trainer',jockey:'Jockey',
 sourceUrl:'https://example.org/race',earlyOddsLockedAt:'2026-10-12T08:00:00Z',
 researchUpdatedAt:'2026-10-12T08:01:00Z',reason:'Sourced form case',risk:'Strong opponent',
 v42:{raceType:'Class 4 handicap, 7f'},or:null,sourceNotes:[{
 sourceUrl:'https://example.org/report',observedAt:'2026-10-12T08:00:00Z',
 publishedAt:'2026-10-12T07:00:00Z',raceMatched:true
 }],verifiedPriorRuns:[{
 sourceUrl:'https://example.org/previous',observedAt:'2026-10-12T08:00:00Z',
 ranAt:'2026-10-08T15:00:00Z',finishStatus:'4th'
 }]};
let outcome=auditSelectionEvidence({snapshotDate:'2026-10-12',todaySelections:[horse]});
assert.equal(outcome.selectedRunners,1);
assert.equal(outcome.exactDatedQuotes,1);
assert.equal(outcome.selectionsWithIndependentNotes,1);
assert.equal(outcome.selectionsWithSourcedPriorRuns,1);
assert.ok(outcome.selections[0].flags.includes('Handicap OR missing'),'Empty OR is not a valid zero rating');
const contaminated=structuredClone(horse);
contaminated.sourceNotes[0].observedAt='2026-10-12T08:02:00Z';
contaminated.verifiedPriorRuns[0].observedAt='2026-10-12T08:02:00Z';
contaminated.earlyOddsLockedAt='2026-10-13T08:00:00Z';
outcome=auditSelectionEvidence({snapshotDate:'2026-10-12',todaySelections:[contaminated]});
assert.equal(outcome.selectionsWithIndependentNotes,0,'Late published post-lock research rejected');
assert.equal(outcome.selectionsWithSourcedPriorRuns,0,'Post-lock histories cannot retrospectively justify a pick');
assert.equal(outcome.exactDatedQuotes,0,'Future quote must not be accepted as an early price');
assert.ok(accuracyPriorities.every(x=>x.name&&x.source&&x.method));
console.log('PASS: all published selections checked, no doubled picks, missing handicap marks flagged and future evidence excluded');
