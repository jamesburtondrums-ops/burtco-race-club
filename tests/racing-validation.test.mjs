import assert from 'node:assert/strict';
import {evaluateHeldOutRaces} from '../functions/_lib/race-validation.mjs';

const races=[];
for(let day=1;day<=20;day++){
 for(let n=0;n<3;n++){
  const date='2025-03-'+String(day).padStart(2,'0');
  const offAt=date+'T14:'+String(10+n).padStart(2,'0')+':00Z';
  const quoteAt=date+'T13:00:00Z';
  const outcome=(day+n)%3===0?2:1;
  races.push({raceId:date+'|'+n,date,offAt,course:'Synthetic Test Course',
   runners:[
    {horse:'Runner Alpha',finishingPosition:outcome===1?1:2,
     marketDecimalOdds:2.2,marketQuoteAt:quoteAt,modelWinProbability:.62,modelForecastAt:quoteAt},
    {horse:'Runner Bravo',finishingPosition:outcome===2?1:2,
     marketDecimalOdds:2.8,marketQuoteAt:quoteAt,modelWinProbability:.38,modelForecastAt:quoteAt}
   ]});
 }
}
const protectedDefault=evaluateHeldOutRaces(races);
assert.equal(protectedDefault.ready,false,'Cannot claim 500-race validation from 60 synthetic examples');
const r=evaluateHeldOutRaces(races,{minRaces:50,minTestRaces:9});
assert.equal(r.ready,true,'Synthetic threshold override supports tests');
assert.equal(r.heldOutRaces,12,'20% later-day full-race holdout');
assert.equal(r.trainAndTuneRaces,48,'No runners from held-out dates leak into development');
assert.equal(r.marketBaseline.races,12);
assert.equal(r.pairedMarketBaseline.races,r.candidateModel.races,'Models scored on exactly matching held-out races');
assert.ok(Number.isFinite(r.pairedDelta.brier),'Brier comparison computed');
assert.ok(Number.isFinite(r.pairedDelta.winnerLogLoss),'Log-loss comparison computed');
assert.equal(r.status,'candidate_evaluation_only','Even synthetically improved scores are not deployed');
const late=structuredClone(races);
late[0].runners[0].marketQuoteAt='2025-03-01T15:00:00Z';
assert.equal(evaluateHeldOutRaces(late,{minRaces:50,minTestRaces:9}).totalValidRaces,59,'A quote published after off invalidates whole race');
const noModel=structuredClone(races);
for(const row of noModel)for(const entrant of row.runners)delete entrant.modelWinProbability;
assert.equal(evaluateHeldOutRaces(noModel,{minRaces:50,minTestRaces:9}).status,'no_comparable_model_forecasts','No invented model accuracy');
console.log('PASS: chronological whole-date holdout, normalized market baseline, probability scoring and leakage gates');
