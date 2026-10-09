import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const temp=mkdtempSync(join(tmpdir(),'racing-permission-test-'));
try{
 const script=fileURLToPath(new URL('../scripts/import-racing-research.mjs',import.meta.url));
 const valid={
  sourceRights:'owner-supplied',
  permissionReference:'Test team created these own original notes',
  allowCommentReuse:true,
  runs:[{horse:'Synthetic Runner',date:'2025-05-02',course:'Test Racecourse',
   raceTime:'14:10',sourceUrl:'https://example.org/authorised-test-event',
   sourceCheckedAt:'2025-05-03T10:00:00Z',comment:'Held up, short of room, stayed on late',
   finishingPosition:3,officialRating:83,going:'Good',surface:'Turf'}]
 };
 const input=join(temp,'data.json');
 const call=(record,flags=[])=>{
  writeFileSync(input,JSON.stringify(record));
  return spawnSync(process.execPath,[script,input,...flags],{encoding:'utf8'});
 };
 let result=call(valid);
 assert.equal(result.status,0,'Valid owner-written note passes dry run');
 assert.match(result.stdout,/"accepted": 1/,'One historic observation staged');
 assert.match(result.stdout,/Dry run: no files changed/,'No data changed by default');
 result=call({...valid,allowCommentReuse:false});
 assert.notEqual(result.status,0,'Narrative without permission rejected');
 assert.match(result.stdout,/copyrighted narrative comments/,'Copyright rejection explained');
 result=call({...valid,runs:[{...valid.runs[0],sourceUrl:''}]});
 assert.notEqual(result.status,0,'Unsourced observation rejected');
 result=call(valid,['--apply']);
 assert.notEqual(result.status,0,'Cannot commit without explicit rights acknowledgement');
 assert.match(result.stderr,/PERMISSION_CONFIRMED/,'Rights acknowledgement required');
 console.log('PASS: research ingest dry-run, source provenance and copyright/rights guards');
}finally{rmSync(temp,{recursive:true,force:true})}
