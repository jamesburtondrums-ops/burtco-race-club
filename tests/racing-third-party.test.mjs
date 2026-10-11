import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditThirdPartyNote,compareThirdPartyResearch,thirdPartyReport} from '../functions/_lib/third-party-research.mjs';
const cfg=JSON.parse(readFileSync(new URL('../functions/_private/racing-third-party-sources.json',import.meta.url),'utf8'));
const cards=JSON.parse(readFileSync(new URL('../data/races.json',import.meta.url),'utf8'));
assert.equal(Object.keys(cfg.providers).length,3);
assert.equal(cfg.automatedScrapingEnabled,false);
const first=cards.todaySelections[0];
const cutoff='2026-10-10T12:15:00Z';
const sample={providerId:'myracing',horse:first.horse,course:first.course,
 raceDate:'2026-10-10',raceTime:first.time,kind:'factual-statistic',stance:'neutral',
 factor:'course experience',finding:'Race commentary suggests past track form needs verifying.',
 sourceUrl:'https://myracing.com/racecards/',publishedAt:'2026-10-09T12:00:00Z',
 observedAt:'2026-10-09T13:00:00Z'};
assert.equal(auditThirdPartyNote(sample,cfg.providers,cutoff).ok,true);
assert.equal(auditThirdPartyNote({...sample,sourceUrl:'https://othersite.example/tips'},cfg.providers,cutoff).ok,false,'Cross-site attribution blocked');
assert.equal(auditThirdPartyNote({...sample,publishedAt:'2026-10-10T12:30:00Z',observedAt:'2026-10-10T12:31:00Z'},cfg.providers,cutoff).ok,false,'Post-off tips cannot leak into historic selection');
assert.equal(auditThirdPartyNote({...sample,observedAt:'2026-10-11T00:01:00Z'},cfg.providers,cutoff).ok,false,'Late review cannot reconstruct pre-race evidence');
assert.equal(auditThirdPartyNote(sample,cfg.providers,null).ok,false,'Missing race-start timestamp fails closed');
const o=compareThirdPartyResearch({raceDate:'2026-10-10',horse:first.horse,course:first.course,time:first.time,startUtc:cutoff,notes:[sample],providers:cfg.providers});
assert.equal(o.sourceCount,1);
assert.equal(o.observations.length,1);
assert.equal(o.positiveEditorialSources,0,'Factual statistic does not count as endorsement');
const p=compareThirdPartyResearch({raceDate:'2026-10-10',horse:'Missing Runner',course:'Newmarket',time:'13:15',startUtc:cutoff,notes:[sample],providers:cfg.providers});
assert.equal(p.status,'not independently verified');
assert.equal(p.positiveEditorialSources,0);
const overview=thirdPartyReport(cards,[],cfg);
assert.equal(overview.coverage.length,10);
assert.ok(overview.coverage.every(x=>x.status==='not independently verified'),'No fabricated third party endorsements');
assert.equal(overview.enabledAutomation,false);
const panel=readFileSync(new URL('../backoffice.js',import.meta.url),'utf8');
assert.match(panel,/Independent racing research/);
const api=readFileSync(new URL('../functions/api/backoffice/report.js',import.meta.url),'utf8');
assert.match(api,/externalResearch:thirdPartyReport/);
console.log('PASS: third-party source identities, provenance, race cutoff, and no unsupported endorsements');
