import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('../scripts/audit-racing-model.mjs',import.meta.url));
function runFixture(fixture){
  const dir=mkdtempSync(join(tmpdir(),'racing-model-audit-'));
  try{
    const file=join(dir,'races.json');
    writeFileSync(file,JSON.stringify(fixture));
    return JSON.parse(execFileSync(process.execPath,[script,file],{encoding:'utf8'}));
  }finally{rmSync(dir,{recursive:true,force:true});}
}

test('a withdrawn winner stays in the original published WIN denominator',()=>{
  const report=runFixture({snapshotDate:'2026-10-22',postRaceAudits:[{
    asOfDate:'2026-10-21',runnerResults:[
      {horse:'Winner',course:'Kempton',time:'19:30',originCategory:'ORIGINAL_WIN',finished:1,lateWithdrawn:true},
      {horse:'Other',course:'Haydock',time:'15:30',originCategory:'ORIGINAL_WIN',finished:4},
      {horse:'Longshot',course:'Newcastle',time:'18:00',originCategory:'LATE_ADDED_LONGSHOT',finished:2}
    ]}]});
  assert.equal(report.originalPublished.win.runners,2);
  assert.equal(report.originalPublished.win.winners,1);
  assert.equal(report.laterRemovalAnnotations.retainedWin.runners,1);
  assert.equal(report.laterRemovalAnnotations.retainedWin.winners,0);
  assert.equal(report.omitted.length,1);
});

test('E/W place result uses recorded field size, not a fixed three-place assumption',()=>{
  const report=runFixture({postRaceAudits:[{asOfDate:'2026-10-21',runnerResults:[
    {horse:'A',course:'Kempton',time:'20:30',originCategory:'ORIGINAL_EW',finished:3,runnerCount:12},
    {horse:'B',course:'Newmarket',time:'15:30',originCategory:'ORIGINAL_EW',finished:3,runnerCount:4},
    {horse:'C',course:'Wolverhampton',time:'21:00',originCategory:'ORIGINAL_EW',finished:2}
  ]}]});
  assert.equal(report.originalPublished.eachWay.eachWay.total,3);
  assert.equal(report.originalPublished.eachWay.eachWay.confirmedStandardPlace,1);
  assert.equal(report.originalPublished.eachWay.eachWay.unknownPlaceTerms,1);
});
