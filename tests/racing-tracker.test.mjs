import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const load = file => JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const source = readFileSync(new URL('../app.js',import.meta.url),'utf8');
const ledger=load('data/bet-ledger.json'),racing=load('data/races.json');
const previous=load('data/archive/2026-10-08-ledger.json');
const appElement={innerHTML:''};
const document={querySelector:s=>s==='#app'?appElement:null,querySelectorAll:()=>[]};
const sandbox={document,console,fetch:async()=>{throw Error('Network requests are not allowed in unit tests')}};
const boot=source.indexOf('\nload(true).then(loadLive);');
assert.ok(boot>0,'Client startup present');
const app=vm.runInNewContext(source.slice(0,boot)+'\n;({state,settlement,trackerStats,exoticSummary,lucky15Calc,render})',sandbox);
app.state.data=racing;app.state.ledger=ledger;
assert.equal(ledger.startingBank,1000,'Original £1,000 bankroll retained');
assert.equal(previous.entries.length,23,'8 October immutable reference is complete');
for(const saved of previous.entries){
 const entry=ledger.entries.find(e=>e.id===saved.id);
 assert.ok(entry,'Historic pick preserved: '+saved.id);
 assert.equal(entry.winStake+entry.placeStake,saved.winStake+saved.placeStake,'Historical stake never changed');
 if(saved.result)assert.ok(entry.result,'Historical result not erased: '+saved.horse);
}
assert.equal(new Set(ledger.entries.map(e=>e.id)).size,ledger.entries.length,'No duplicated individual bets');
for(const group of ['todaySelections','midshotsToday','longshotsToday']){
 for(const pick of racing[group]||[]){
  const type=group==='todaySelections'?'win':'each-way';
  const id=[racing.snapshotDate,pick.course,pick.time,pick.horse,type].join('|').toLowerCase();
  assert.ok(ledger.entries.some(e=>e.id===id),'Active single present in ledger: '+pick.horse);
 }
}
assert.equal(racing.todaySelections.filter(x=>x.restoredFromPreviousVersion).length,0,'Removed old card not reintroduced');
assert.equal(ledger.entries.filter(x=>x.restoredFromPreviousVersion).length,0,'Removed old bets not reintroduced');
assert.equal(app.settlement({betType:'win',winStake:10,placeStake:0,result:{status:'NR'}}).returnAmount,10,'NR full refund');
assert.equal(app.settlement({betType:'win',winStake:10,placeStake:0,result:{status:'PU'}}).status,'lost','PU loses');
assert.equal(app.settlement({betType:'each-way',winStake:5,placeStake:5,runnerCount:8,selectionOdds:'20/1',result:{position:2}}).returnAmount,30,'1/4 odds place return');
assert.equal(app.settlement({betType:'each-way',winStake:5,placeStake:5,runnerCount:7,selectionOdds:'20/1',result:{position:3}}).status,'lost','Seven pays two places');
assert.equal(app.settlement({betType:'each-way',winStake:5,placeStake:5,runnerCount:4,selectionOdds:'20/1',result:{position:2}}).status,'lost','Four pays first only');
assert.equal(app.settlement({betType:'each-way',winStake:5,placeStake:5,runnerCount:8,selectionOdds:'20/1',result:{position:1}}).returnAmount,135,'Win plus place portions');
assert.equal(app.settlement({betType:'each-way',winStake:5,placeStake:5,runnerCount:null,selectionOdds:'20/1',result:{position:2}}).status,'unpriced','Never invent unknown place terms');
const tickets=ledger.lucky15Tickets||[];
assert.equal(tickets.filter(t=>t.id==='2026-10-09|ew-lucky15').length,1,'One historical Lucky 15 ticket, not duplicated');
const ticket=tickets.find(t=>t.id==='2026-10-09|ew-lucky15');
assert.equal(ticket.totalStake,30,'Lucky 15 total stake');
assert.equal(ticket.legs.length,4,'Four legs');
assert.equal(new Set(ticket.legs.map(l=>l.course+'|'+l.time)).size,4,'All four Lucky 15 legs in different races');
const allVoid=JSON.parse(JSON.stringify(ticket));
allVoid.date='1900-01-01';for(const leg of allVoid.legs)leg.result={status:'NR'};
assert.equal(app.lucky15Calc(allVoid).returnAmount,30,'Thirty void line units returned');
for(const leg of allVoid.legs)leg.result={position:6};
assert.equal(app.lucky15Calc(allVoid).returnAmount,0,'Four losing legs pay zero');
const stats=app.trackerStats(ledger.entries),combos=app.exoticSummary();
const bank=ledger.startingBank-stats.totalStake-combos.stake+stats.totalReturn+combos.returns;
assert.ok(Number.isFinite(bank),'Bankroll always remains calculable');
app.render();
assert.match(appElement.innerHTML,/Profit & strike-rate tracker/,'Tracker visible');
assert.match(appElement.innerHTML,/Win strike rate/,'Strike-rate visible');
assert.match(appElement.innerHTML,/data-refresh-results/,'Manual refresh button');
assert.ok(appElement.innerHTML.includes('sportinglife.com/racing/fast-results'),'Fast results source');
assert.ok(appElement.innerHTML.includes('£'+bank.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})),'Bankroll display matches ledger');
if(racing.snapshotDate==='2026-10-09'){
 assert.equal(racing.todaySelections.length,2,'Small Friday win shortlist');
 assert.equal(racing.midshotsToday.length,1,'Only one higher-confidence Friday midshot');
 assert.equal(racing.longshotsToday.length,1,'One Friday longshot');
 assert.equal(ledger.entries.filter(e=>e.date==='2026-10-09').length,4,'Four Friday paper singles');
 assert.equal((racing.racecardLinks||[]).length,6,'Friday runner cards available');
 app.state.view='lucky15';app.render();
 assert.match(appElement.innerHTML,/Flann Sunna/,'Friday Lucky15 displayed');
 app.state.view='racecards';app.render();
 assert.match(appElement.innerHTML,/All runners/,'All runners accessible');
}
app.state.view='history';app.render();
assert.match(appElement.innerHTML,/Results history/,'Historical selections visible');
assert.doesNotMatch(appElement.innerHTML,/Blissful Bonita|Lady Of Clover/,'Discarded earlier selections stay gone');
console.log('PASS: historical records, rolling bank, Lucky15 settlement and racecard UI regression checks');
