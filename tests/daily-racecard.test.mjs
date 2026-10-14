// Run with: node --test tests/daily-racecard.test.mjs
// Process and data-integrity checks. These do NOT claim improved predictive accuracy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessWinConfidence} from '../selection-quality.mjs';
const card=JSON.parse(readFileSync(new URL('../data/races.json',import.meta.url),'utf8'));
const ledger=JSON.parse(readFileSync(new URL('../data/bet-ledger.json',import.meta.url),'utf8'));
const groups=['todaySelections','midshotsToday','longshotsToday','lucky15Only'];
const all=groups.flatMap(g=>(card[g]||[]).map(p=>({...p,group:g})));
const quote=s=>{const m=String(s).match(/^(\d+)\/(\d+)$/);return m?Number(m[1])/Number(m[2]):null};

test('the daily card has one horse per race across all featured categories',()=>{
 const races=new Set(),horses=new Set();
 for(const x of all){
  const race=`${x.course.toLowerCase()}|${x.time}`,horse=x.horse.trim().toLowerCase();
  assert.ok(!races.has(race),`duplicate race: ${race}`);
  assert.ok(!horses.has(horse),`duplicate horse: ${horse}`);
  races.add(race);horses.add(horse);
 }
 assert.equal(card.selectionPresentation.featuredRaceCount,all.length);
});

test('each WIN contender has pre-publication evidence, checked sources and disclosed risks',()=>{
 for(const x of card.todaySelections||[]){
  const result=assessWinConfidence(x);
  assert.equal(result.qualified,true,`${x.horse}: ${result.reason}`);
  assert.ok(x.selectionPublishedAt);
  assert.ok(x.risk.length>30);
  assert.ok(x.positivePoints.length>=2);
 }
});

test('MID and LONG odds bands are respected and forecast-only prices are never locked',()=>{
 for(const x of card.midshotsToday||[]){
  assert.ok(quote(x.odds)>=6&&quote(x.odds)<=18,`${x.horse}: ${x.odds}`);
  assert.ok(x.priceSource?.startsWith('https://'),x.horse+' price source missing');
 }
 for(const x of card.longshotsToday||[])assert.ok(quote(x.odds)>=20,x.horse+' not longshot');
});

test('every paper single matches a featured horse, original odds and pre-race date',()=>{
 const published=ledger.entries.filter(x=>x.date===card.snapshotDate);
 assert.equal(published.length,all.filter(x=>x.group!=='lucky15Only').length);
 const identities=new Set();
 for(const p of published){
  const k=[p.date,p.course,p.time,p.horse,p.betType].join('|').toLowerCase();
  assert.equal(p.id,k);
  assert.ok(!identities.has(k),'duplicate paper bet '+k);
  identities.add(k);
  const pick=all.find(x=>x.horse===p.horse&&x.course===p.course&&x.time===p.time);
  assert.ok(pick,'missing published race selection '+p.horse);
  assert.equal(p.selectionOdds,pick.odds);
  assert.equal(p.priceBasis,'early');
  assert.ok(p.earlyPriceSource?.startsWith('https://'));
  assert.ok(Date.parse(p.earlyPriceSnapshotAt)<Date.parse(card.snapshotDate+'T13:19:00Z'));
 }
});

test('a Lucky 15 is never falsely labelled prepared with fewer than four valid legs',()=>{
 const t=(ledger.lucky15Tickets||[]).find(x=>x.date===card.snapshotDate);
 if(t){
  assert.equal(t.legs.length,4);
  assert.equal(new Set(t.legs.map(x=>x.course+'|'+x.time)).size,4);
  assert.ok(t.legs.every(x=>quote(x.selectionOdds)>5.5));
 }else assert.equal(card.lucky15Only?.length||0,0);
});

test('post-race updates preserve pre-race evidence and carry result provenance',()=>{
 for(const x of all){
  const publishedAt=Date.parse(x.selectionPublishedAt);
  assert.ok(Number.isFinite(publishedAt),'missing original selection date '+x.horse);
  if(!x.result)continue;
  assert.ok(Date.parse(x.result.updatedAt)>publishedAt,'result predates original publication '+x.horse);
  assert.ok(x.result.source,'missing result source '+x.horse);
  const type=x.group==='todaySelections'?'win':'each-way';
  const entry=ledger.entries.find(e=>e.date===card.snapshotDate&&e.course===x.course&&e.time===x.time&&e.horse===x.horse&&e.betType===type);
  assert.ok(entry,'result without corresponding saved paper entry '+x.horse);
  assert.equal(entry.selectionOdds,x.odds,'original price was overwritten for '+x.horse);
  assert.equal(entry.result?.position??entry.result?.status,x.result.position??x.result.status,'result mismatch for '+x.horse);
 }
});
