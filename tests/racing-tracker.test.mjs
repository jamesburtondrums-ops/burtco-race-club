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
assert.equal(ticket.priceBasis,'early','Lucky15 uses locked early prices rather than SP');
assert.ok(ticket.legs.every(l=>l.priceBasis==='early'),'Each Lucky15 leg has early-price basis');
assert.equal(Math.round(app.lucky15Calc(ticket).returnAmount*100)/100,79.75,'Three placed legs return £79.75 at early ticket prices');
const earlyFast=ledger.entries.find(e=>e.date==='2026-10-09'&&e.horse==='Fast Track');
const earlyHeat=ledger.entries.find(e=>e.date==='2026-10-09'&&e.horse==='Theheatison');
assert.equal(earlyFast.selectionOdds,'8/1','Single early Fast Track price retained');
assert.equal(earlyFast.settlementOdds,'4/1','Official Fast Track SP retained as reference');
assert.equal(app.settlement(earlyFast).returnAmount,15,'Fast Track settles at early 8/1 not 4/1 SP');
assert.equal(app.settlement(earlyHeat).returnAmount,22.5,'Theheatison settles at early 14/1 not 6/1 SP');
assert.ok(ledger.entries.filter(e=>e.date==='2026-10-09').every(e=>e.priceBasis==='early'),'Every Friday paper single uses early prices');

assert.equal(ticket.legs.length,4,'Four legs');
assert.deepEqual(Array.from(ticket.legs.map(l=>l.horse)),["Fast Track","Sweltering","Theheatison","Naga"],'Revised morning Lucky15 runner list');
assert.deepEqual(Array.from(ticket.legs.map(l=>l.runnerCount)),[13,15,16,17],'Current reported field sizes for ticket');
assert.equal(ticket.placed,false,'Ticket is paper only and was not placed');
assert.equal((ticket.versions||[]).length,2,'Prior Lucky15 revisions retained for audit');
assert.ok(!ticket.legs.some(l=>['Flann Sunna','Flora Of Bermuda','Archers Bay','Toca Madera',"Nuit d'Eclair"].includes(l.horse)),'Below-floor and non-runner legs excluded');
assert.ok(racing.lucky15Excluded.some(l=>l.horse==="Nuit d'Eclair"&&l.result?.status==='NR'),'Racing TV confirmed non-runner excluded');
assert.equal(ticket.minimumFractionalOddsExclusive,'11/2','User price floor stored on ticket');
assert.ok(ticket.legs.every(l=>{const [n,d]=l.selectionOdds.split('/').map(Number);return Number.isFinite(n/d)&&n/d>5.5;}),'All four Lucky15 runners priced STRICTLY above 11/2');

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
 assert.equal(racing.todaySelections.length,5,'Five value-priced main selections');
 assert.equal(racing.todaySelections.filter(x=>x.v42?.isPrime).length,1,'One relative Prime profile at acceptable odds');
 assert.equal(ledger.entries.filter(e=>e.date==='2026-10-08').length,23,'Previous day stakes remain unchanged');
 assert.equal(racing.todaySelections.filter(x=>x.horse==='Archers Bay').length,1,'No duplicate Archers Bay row');
 assert.equal((racing.todaySelections.length+racing.midshotsToday.length+racing.longshotsToday.length),10,'Ten selections across all categories');
 assert.equal(racing.midshotsToday.length,4,'Four priced 6/1-18/1 midshots');
 assert.equal(racing.longshotsToday.length,1,'One Friday longshot');
 assert.equal(ledger.entries.filter(e=>e.date==='2026-10-09').length,10,'Ten Friday paper singles');
 const todayBets=ledger.entries.filter(e=>e.date==='2026-10-09');
 assert.ok(todayBets.every(b=>{const m=String(b.selectionOdds).match(/^(\d+)\/(\d+)$/);return m&&Number(m[1])/Number(m[2])>=1;}),'No odds-on individual selections retained');
 assert.equal(racing.midshotsPolicy.minOdds,'6/1','Midshot band lowered to 6/1');
 assert.equal((racing.racecardLinks||[]).length,6,'Friday runner cards available');
 assert.ok(racing.morningRecheck?.scheduledRaces===47,'Friday's six-meeting review recorded');
 app.state.view='lucky15';app.render();
 assert.match(appElement.innerHTML,/Sweltering/,'New >11/2 Lucky15 replacement displayed');
 assert.match(appElement.innerHTML,/Strict price floor/,'User strict price floor visible');
 assert.match(appElement.innerHTML,/4 of 4 legs strictly above 11\/2/,'All four qualifying legs visible');
 assert.match(appElement.innerHTML,/Fast Track/,'Form-reviewed midshot included in Lucky15');
 assert.match(appElement.innerHTML,/Evidence and risks/,'Runner research visible');
 assert.doesNotMatch(appElement.innerHTML,/Flann Sunna|Nuit d.Eclair|Toca Madera/,'Short-priced and withdrawn Lucky15 legs absent');
 app.state.view='racecards';app.render();
 assert.match(appElement.innerHTML,/All runners/,'All runners accessible');
}
app.state.view='history';app.render();
assert.match(appElement.innerHTML,/Results history/,'Historical selections visible');
assert.doesNotMatch(appElement.innerHTML,/Blissful Bonita|Lady Of Clover/,'Discarded earlier selections stay gone');
console.log('PASS: historical records, rolling bank, Lucky15 settlement and racecard UI regression checks');
