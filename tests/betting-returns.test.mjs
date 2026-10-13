// Run: node --test tests/betting-returns.test.mjs
// Regression checks for stake-inclusive pound-sterling paper returns.
import test from 'node:test';
import assert from 'node:assert/strict';
import {settleEntry,settleTicket} from '../functions/_lib/backoffice-stats.mjs';

const win=(odds,stake=10)=>({betType:'win',winStake:stake,placeStake:0,priceBasis:'early',selectionOdds:odds,result:{position:1}});
const ew=(odds,position,runnerCount=10)=>({betType:'each-way',winStake:5,placeStake:5,priceBasis:'early',selectionOdds:odds,runnerCount,result:{position}});

test('WIN stake × (numerator ÷ denominator + 1), including stake',()=>{
 for(const [price,stake,expected] of [['1/1',10,20],['5/2',10,35],['4/1',10,50],['10/1',10,110],['20/1',5,105],['11/10',10,21],['15/8',10,28.75]]){
  assert.equal(settleEntry(win(price,stake)).returns,expected,price);
 }
});

test('favourite suffixes, penny rounding, malformed and ambiguous quotes',()=>{
 for(const [price,expected] of [['9/4F',32.5],['6/4 jf',25],['Evens',20],['4/7',15.71],['8/11',17.27]]){
  assert.equal(settleEntry(win(price)).returns,expected,price);
 }
 for(const quote of ['1/0','5/2–3/1','10/1 forecast']){
  assert.equal(settleEntry(win(quote)).status,'unpriced');
 }
});

test('legacy bets use a recorded final settlement quote where the initial quote was a range',()=>{
 assert.deepEqual(settleEntry({...win('11/8–6/4'),priceBasis:undefined,settlementOdds:'11/8'}),{status:'won',returns:23.75});
});

test('each-way winners credit both win and quarter-odds place stakes',()=>{
 assert.deepEqual(settleEntry(ew('10/1',1)),{status:'won',returns:72.5});
 assert.deepEqual(settleEntry(ew('10/1',2)),{status:'placed',returns:17.5});
 assert.deepEqual(settleEntry(ew('15/2',3)),{status:'placed',returns:14.38});
 assert.deepEqual(settleEntry(ew('10/1',4)),{status:'lost',returns:0});
});

test('losers get £0 and non-runners are refunded',()=>{
 assert.deepEqual(settleEntry({...win('3/1'),result:{position:2}}),{status:'lost',returns:0});
 assert.deepEqual(settleEntry({...ew('11/1',2),result:{status:'NR'}}),{status:'void',returns:10});
});

test('Lucky 15 rounds each of 15 win and 15 place lines independently',()=>{
 const ticket={totalStake:30,stakePerLinePerSide:1,eachWayFraction:.25,priceBasis:'early',
  legs:Array.from({length:4},(_,i)=>({horse:'Runner '+i,selectionOdds:'1/1',runnerCount:10,result:{position:1}}))
 };
 assert.deepEqual(settleTicket(ticket),{status:'settled',stake:30,returns:104.6});
 assert.equal(settleTicket({...ticket,legs:[...ticket.legs.slice(0,3),{...ticket.legs[3],result:null}]}).status,'open');
});

test('simulated BOG uses longer SP while preserving researched quote',()=>{
 const king={...win('9/2'),settlementOdds:'6/1'};
 assert.equal(king.selectionOdds,'9/2');
 assert.deepEqual(settleEntry(king),{status:'won',returns:70});
 assert.deepEqual(settleEntry({...win('3/1'),settlementOdds:'11/4'}),{status:'won',returns:40});
 assert.deepEqual(settleEntry({...win('3/1'),settlementOdds:'11/4',result:{position:2}}),{status:'lost',returns:0});
 assert.deepEqual(settleEntry({...win('11/10'),result:{position:1,sp:'11/8f'}}),{status:'won',returns:23.75});
 assert.deepEqual(settleEntry({...win('4/1'),result:{position:1,sp:'3/1'}}),{status:'won',returns:50});
});

test('simulated BOG applies higher SP to both WIN and PLACE components of an E/W result',()=>{
 assert.deepEqual(settleEntry({...ew('8/1',1),result:{position:1,sp:'12/1'}}),{status:'won',returns:85});
 assert.deepEqual(settleEntry({...ew('8/1',2),result:{position:2,sp:'12/1'}}),{status:'placed',returns:20});
});

test('Lucky 15 accepts SP uplift only where it beats that leg\'s preserved quote',()=>{
 const ticket={totalStake:30,stakePerLinePerSide:1,eachWayFraction:.25,priceBasis:'early',
  legs:Array.from({length:4},(_,i)=>({horse:'Runner '+i,selectionOdds:'1/1',runnerCount:10,result:{position:1}}))
 };
 const base=settleTicket(ticket);
 const higher={...ticket,legs:ticket.legs.map((x,i)=>i===0?{...x,result:{position:1,sp:'2/1'}}:x)};
 const lower={...ticket,legs:ticket.legs.map((x,i)=>i===0?{...x,result:{position:1,sp:'4/5'}}:x)};
 assert.equal(base.returns,104.6);
 assert.equal(settleTicket(lower).returns,base.returns);
 assert.ok(settleTicket(higher).returns>base.returns);
});
