#!/usr/bin/env node
/**
 * Fails if a supposedly whole-programme research day omits meetings/races or
 * silently drops runner identities/withdrawals.
 * Usage: node scripts/validate-daywide-coverage.mjs data/research/YYYY-MM-DD-all-races-manifest.json
 * Does NOT certify horse-level form depth or betting accuracy.
 */
import {readFileSync} from 'node:fs';
const path=process.argv[2];
if(!path)throw Error('Expected dated coverage manifest path');
const manifest=JSON.parse(readFileSync(path,'utf8'));
const norm = text => String(text||'').trim().toLowerCase().replace(/\s+/g,' ');
const errors=[],seen=new Set(),meetings=new Set();
let raceCount=0,active=0,nr=0;
if(!/^\d{4}-\d{2}-\d{2}$/.test(manifest.date))errors.push('Invalid dated manifest');
if(!Array.isArray(manifest.sources)||!manifest.sources.length)errors.push('Missing source file list');
if(!Array.isArray(manifest.expectedMeetings)||!manifest.expectedMeetings.length)errors.push('No expected course-list baseline');
for(const source of manifest.sources||[]) {
 if(!source.path||!source.course) {errors.push('Missing file or course locator');continue;}
 let data;
 try{data=JSON.parse(readFileSync(source.path,'utf8'));}catch(e){errors.push('Source missing: '+source.path);continue;}
 if(data.date!==manifest.date)errors.push('Stale meeting data: '+source.path);
 if(norm(data.course)!==norm(source.course))errors.push('Course mismatch: '+source.path);
 if(meetings.has(norm(source.course)))errors.push('Duplicate course: '+source.course);
 meetings.add(norm(source.course));
 if(!String(data.source||'').startsWith('https://'))errors.push('No explicit provider URL: '+source.path);
 for(const race of data.races||[]){
  raceCount++;
  const key=[norm(source.course),race.off].join('|');
  if(seen.has(key))errors.push('Duplicate race: '+key);
  seen.add(key);
  const horses=new Set(),actualRaceNR=[];
  let declared=0,working=0;
  if(!/^\d{2}:\d{2}$/.test(race.off))errors.push('Bad off-time '+key);
  for(const runner of race.runners||[]){
   declared++;
   const horse=norm(runner.horse);
   if(!horse)errors.push('Horse without name '+key);
   if(horses.has(horse))errors.push('Duplicate horse '+key+' '+horse);
   horses.add(horse);
   if(runner.nonRunnerFlag){nr++;actualRaceNR.push(runner.horse);}
   else {active++;working++;}
  }
  if(race.active!==working||race.declared!==declared)errors.push('Runner count discrepancy: '+key);
  if(working<1)errors.push('No active field: '+key);
 }
}
for(const course of manifest.expectedMeetings||[])if(!meetings.has(norm(course)))errors.push('Missing meeting '+course);
if(meetings.size!==(manifest.expectedMeetings||[]).length)errors.push('Meeting count mismatch');
if(raceCount!==manifest.expectedRaces)errors.push('Race total '+raceCount+' does not match '+manifest.expectedRaces);
const out={date:manifest.date,manifest:path,meetingCount:meetings.size,raceCount,activeRunners:active,reportedNonRunnerEntries:nr,
allExpectedRacecardsPresent:errors.length===0,allIndividualRecentHistoriesVerified:false,
limitation:'Does not itself supply thorough past-form analysis, trainer-jockey evidence, pace, price validation or a win probability.',
errors};
console.log(JSON.stringify(out,null,2));
if(errors.length)process.exitCode=1;
