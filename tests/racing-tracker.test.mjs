import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const load=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const ledger=load('data/bet-ledger.json'),racing=load('data/races.json');
const archived08=load('data/archive/2026-10-08-ledger.json');
const archived09=load('data/archive/2026-10-09-ledger.json');
const archived09Card=load('data/archive/2026-10-09-races.json');
const element={innerHTML:''};
const document={querySelector:s=>s==='#app'?element:null,querySelectorAll:()=>[]};
const sandbox={document,console,fetch:async()=>{throw Error('Network calls disabled in tests')}};
const boot=source.indexOf('\nload(true).then(loadLive);');
assert.ok(boot>0,'Frontend boot exists');
const app=vm.runInNewContext(source.slice(0,boot)+'\n;({state,settlement,trackerStats,exoticSummary,lucky15Calc,render})',sandbox);
app.state.data=racing;app.state.ledger=ledger;
assert.equal(ledger.startingBank,1000,'£1,000 original paper bank retained');
assert.equal(archived08.entries.length,23,'8 October archived');
assert.equal(archived09.entries.length,33,'9 October archive includes previous results');
assert.equal(archived09Card.snapshotDate,'2026-10-09','Previous racecard archived');
for(const archived of [archived08,archived09])for(const prev of archived.entries){
 const entry=ledger.entries.find(x=>x.id===prev.id);
 assert.ok(entry,'Preserved historical selection '+prev.id);
 assert.equal(entry.winStake+entry.placeStake,prev.winStake+prev.placeStake,'Stake unchanged');
 assert.equal(entry.selectionOdds,prev.selectionOdds,'Recorded early odds unchanged');
 if(prev.result)assert.ok(entry.result,'Historic result retained for '+prev.horse);
}
assert.equal(new Set(ledger.entries.map(x=>x.id)).size,ledger.entries.length,'No duplicate paper bets');
for(const group of ['todaySelections','midshotsToday','longshotsToday'])for(const pick of racing[group]||[]){
 const type=group==='todaySelections'?'win':'each-way';
 const id=[racing.snapshotDate,pick.course,pick.time,pick.horse,type].join('|').toLowerCase();
 assert.ok(ledger.entries.some(x=>x.id===id),'Dated paper bet '+id);
}
assert.equal(app.settlement({betType:'win',winStake:10,placeStake:0,result:{status:'NR'}}).returnAmount,10,'NR refund');
assert.equal(app.settlement({betType:'win',winStake:10,placeStake:0,result:{status:'PU'}}).status,'lost','Pulled up loses');
assert.equal(app.settlement({betType:'each-way',winStake:5,placeStake:5,runnerCount:8,selectionOdds:'20/1',result:{position:2}}).returnAmount,30,'Quarter-odds place at 20/1');
assert.equal(app.settlement({betType:'each-way',winStake:5,placeStake:5,runnerCount:7,selectionOdds:'20/1',result:{position:3}}).status,'lost','Seven-runner field pays two places');
assert.equal(app.settlement({betType:'each-way',winStake:5,placeStake:5,runnerCount:4,selectionOdds:'20/1',result:{position:2}}).status,'lost','Four pays first place only');
assert.equal(app.settlement({betType:'each-way',winStake:5,placeStake:5,runnerCount:8,selectionOdds:'20/1',result:{position:1}}).returnAmount,135,'Win and place portions');
assert.equal(app.settlement({betType:'each-way',winStake:5,placeStake:5,runnerCount:null,selectionOdds:'20/1',result:{position:2}}).status,'unpriced','Unknown runner count not invented');

const oldTicket=ledger.lucky15Tickets.find(t=>t.date==='2026-10-09');
assert.ok(oldTicket,'Previous Lucky15 retained');
assert.equal(oldTicket.priceBasis,'early','Previous ticket settled at recorded early prices');
assert.equal(Math.round(app.lucky15Calc(oldTicket).returnAmount*100)/100,79.75,'Historical October 9 Lucky15 returns retained');
const fast=ledger.entries.find(x=>x.date==='2026-10-09'&&x.horse==='Fast Track');
const heat=ledger.entries.find(x=>x.date==='2026-10-09'&&x.horse==='Theheatison');
assert.equal(app.settlement(fast).returnAmount,15,'Fast Track uses 8/1 early not 4/1 SP');
assert.equal(app.settlement(heat).returnAmount,22.5,'Theheatison uses 14/1 early not 6/1 SP');

if(racing.snapshotDate==='2026-10-10'){
 assert.equal(racing.coverage.meetings,7,'Seven Saturday UK and Irish meetings');
 assert.equal(racing.coverage.races,51,'51 listed races');
 assert.equal(racing.todaySelections.length,5,'Five Saturday main win picks');
 assert.equal(racing.midshotsToday.length,5,'Five Saturday 6/1–18/1 midshots');
 assert.equal(racing.longshotsToday.length,0,'No forced speculative longshot');
 assert.equal(racing.coverage.selectedIndividuals,10,'Ten total Saturday tips');
 assert.equal(ledger.entries.filter(x=>x.date==='2026-10-10').length,10,'Ten Saturday paper singles');
 assert.equal((racing.racecardLinks||[]).length,7,'Seven complete racecard links');
 for(const entry of ledger.entries.filter(x=>x.date==='2026-10-10')){
  const odds=String(entry.selectionOdds).match(/^(\d+)\/(\d+)$/);
  assert.ok(odds&&Number(odds[1])/Number(odds[2])>=1,'No odds-on paper pick '+entry.horse);
  assert.equal(entry.priceBasis,'early','Early odds locked for '+entry.horse);
 }
 const saturdayTicket=ledger.lucky15Tickets.find(x=>x.date==='2026-10-10');
 assert.ok(saturdayTicket,'Saturday EW Lucky15 exists');
 assert.equal(saturdayTicket.priceBasis,'early','Ticket settlement uses its own early prices');
 assert.equal(saturdayTicket.totalStake,30,'£1 each-way Lucky15 total £30');
 assert.equal(saturdayTicket.legs.length,4,'Four legs');
 assert.equal(new Set(saturdayTicket.legs.map(x=>x.course+'|'+x.time)).size,4,'Four different races');
 for(const leg of saturdayTicket.legs){
  const parts=String(leg.selectionOdds).match(/^(\d+)\/(\d+)$/);
  assert.ok(parts&&Number(parts[1])/Number(parts[2])>5.5,'Strictly above 11/2: '+leg.horse);
  assert.equal(leg.priceBasis,'early','Individual lucky leg locked early');
 }
 const voidTicket=JSON.parse(JSON.stringify(saturdayTicket));
 voidTicket.date='1900-01-01';
 for(const leg of voidTicket.legs)leg.result={status:'NR'};
 assert.equal(app.lucky15Calc(voidTicket).returnAmount,30,'All void refund');
 for(const leg of voidTicket.legs)leg.result={position:6};
 assert.equal(app.lucky15Calc(voidTicket).returnAmount,0,'Four losers return zero');
}

const stats=app.trackerStats(ledger.entries),combos=app.exoticSummary();
const available=ledger.startingBank-stats.totalStake-combos.stake+stats.totalReturn+combos.returns;
assert.ok(Number.isFinite(available),'Bank always calculable');
app.state.view='today';app.render();
assert.match(element.innerHTML,/Profit & strike-rate tracker/,'Tracker shown');
assert.match(element.innerHTML,/Win strike rate/,'Cumulative SR shown');
assert.match(element.innerHTML,/data-refresh-results/,'Refresh control remains');
assert.ok(element.innerHTML.includes('£'+available.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})),'Displayed bank matches ledger');
if(racing.snapshotDate==='2026-10-10'){
 assert.match(element.innerHTML,/The Lost King/,'Saturday win tip shown');
 assert.match(element.innerHTML,/10<\/b> total selections/,'Total Saturday tips visible');
 app.state.view='midshots';app.render();
 assert.match(element.innerHTML,/Thunderbear/,'Saturday E/W selection shown');
 app.state.view='lucky15';app.render();
 assert.match(element.innerHTML,/SATURDAY/,'Lucky15 date follows racecard');
 assert.match(element.innerHTML,/Naval Tribute/,'New Saturday Lucky15 shown');
 assert.match(element.innerHTML,/4 of 4 legs strictly above 11\/2/,'All Lucky15 odds eligible');
 app.state.view='racecards';app.render();
 assert.equal((element.innerHTML.match(/See all declared runners/g)||[]).length,7,'Seven current meeting cards');
}
app.state.view='history';app.render();
assert.match(element.innerHTML,/Results history/,'Historical results view');
assert.match(element.innerHTML,/Aighear/,'8 October history visible');
assert.match(element.innerHTML,/Theheatison/,'9 October history visible');
assert.doesNotMatch(element.innerHTML,/Blissful Bonita|Lady Of Clover/,'Explicitly removed earlier picks remain removed');
console.log('PASS: rolling early-price bet history, Saturday 10-pick card, >11/2 Lucky15 and mobile views');
