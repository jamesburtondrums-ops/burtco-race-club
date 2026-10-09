// Import sourced/licensed historic runner observations, never scrape publishers.
// Usage: node scripts/import-racing-research.mjs /path/to/observations.json
//        node scripts/import-racing-research.mjs /path/to/observations.json --apply
// Applying requires RACING_RESEARCH_IMPORT_ACK=PERMISSION_CONFIRMED.
import fs from 'node:fs/promises';
import {validatePriorRun,researchCoverage,chronologicalAssessment} from '../functions/_lib/race-research.mjs';

const sourcePath=process.argv[2],apply=process.argv.includes('--apply');
if(!sourcePath||sourcePath.startsWith('-')){
 console.error('Usage: node scripts/import-racing-research.mjs source.json [--apply]');
 process.exitCode=2;
}else{
 const file=await fs.readFile(sourcePath,'utf8');
 if(file.length>15_000_000)throw Error('Import file exceeds 15MB; split by source/month');
 const incoming=JSON.parse(file);
 if(!['licensed','open-licensed','owner-supplied'].includes(incoming.sourceRights))
  throw Error('sourceRights must be licensed, open-licensed or owner-supplied');
 if(!incoming.permissionReference||String(incoming.permissionReference).length<8)
  throw Error('Provide permissionReference (source rights or written licence), not just a website name');
 if(!Array.isArray(incoming.runs)||incoming.runs.length===0||incoming.runs.length>5000)
  throw Error('Expected 1–5000 historic runner observations');
 const target=new URL('../functions/_private/racing-historical-runs.json',import.meta.url);
 const archive=JSON.parse(await fs.readFile(target,'utf8'));
 const normal=x=>String(x||'').trim().toLowerCase().replace(/\s+/g,' ');
 const key=x=>[x.date,normal(x.course),x.raceTime,normal(x.horse)].join('|');
 const known=new Set((archive.runs||[]).map(key));
 const staged=[];
 const rejects=[];
 const now=new Date().toISOString();
 incoming.runs.forEach((raw,i)=>{
  const row={
   horse:String(raw.horse||'').trim(),
   date:String(raw.date||''),
   course:String(raw.course||'').trim(),
   raceTime:String(raw.raceTime||''),
   sourceUrl:String(raw.sourceUrl||''),
   sourceCheckedAt:String(raw.sourceCheckedAt||''),
   sourceRights:incoming.sourceRights,
   permissionReference:incoming.permissionReference,
   comment:raw.comment===null||raw.comment===undefined?'':String(raw.comment).slice(0,900),
   going:raw.going||null,surface:raw.surface||null,raceType:raw.raceType||null,
   raceClass:raw.raceClass||null,runnerCount:raw.runnerCount??null,
   draw:raw.draw??null,officialRating:raw.officialRating??null,
   performanceFigure:raw.performanceFigure??null,finishingPosition:raw.finishingPosition??null,
   distanceFurlongs:raw.distanceFurlongs??null,
   weightLbs:raw.weightLbs??null,trainer:raw.trainer||null,jockey:raw.jockey||null,
   sectionals:Array.isArray(raw.sectionals)?raw.sectionals:null
  };
  const validation=validatePriorRun(row,'2099-01-01');
  if(!validation.ok){rejects.push({row:i+1,reason:validation.reason});return;}
  if(row.sourceCheckedAt>now){rejects.push({row:i+1,reason:'Source retrieval timestamp is in future'});return;}
  if(!/^\d\d:\d\d$/.test(row.raceTime)){rejects.push({row:i+1,reason:'raceTime must be HH:MM in course-local time'});return;}
  if(row.comment.length>0 && incoming.allowCommentReuse!==true){
   rejects.push({row:i+1,reason:'Do not import copyrighted narrative comments without explicit allowCommentReuse=true and permission'});
   return;
  }
  if(known.has(key(row))){rejects.push({row:i+1,reason:'Historic run already present; no silent overwrites'});return;}
  if(raw?.oddsAfterRace!==undefined||raw?.predictionAfterRace!==undefined){
   rejects.push({row:i+1,reason:'Do not merge post-race data into pre-race feature fields'});return;
  }
  staged.push(row);known.add(key(row));
 });
 const next=[...(archive.runs||[]),...staged];
 const audit=researchCoverage({entries:[]},next),evalReady=chronologicalAssessment(next);
 console.log(JSON.stringify({mode:apply?'apply':'dry-run',incoming:incoming.runs.length,accepted:staged.length,rejected:rejects.length,
  rejectionExamples:rejects.slice(0,25),archive:{runs:next.length,races:audit.sourcedHistoricalRaces,
   noteCoveragePercent:audit.featureCoveragePercent,eligibleForEvaluation:evalReady.ready}},null,2));
 if(rejects.length)throw Error('Rejected '+rejects.length+' observations; correct and rerun (nothing written)');
 if(apply){
  if(process.env.RACING_RESEARCH_IMPORT_ACK!=='PERMISSION_CONFIRMED')
   throw Error('Set RACING_RESEARCH_IMPORT_ACK=PERMISSION_CONFIRMED after checking reuse and copyright rights');
  archive.runs=next;archive.lastUpdatedAt=now;
  archive.lastImport={sourceRights:incoming.sourceRights,permissionReference:incoming.permissionReference,
   importedAt:now,accepted:staged.length};
  await fs.writeFile(target,JSON.stringify(archive,null,2)+'\n');
  console.log('Added '+staged.length+' permissioned historical runner observations');
 }else console.log('Dry run: no files changed; rerun with --apply and rights acknowledgement');
}
