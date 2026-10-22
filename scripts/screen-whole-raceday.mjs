#!/usr/bin/env node
/**
 * First-pass ALL-RACE field index, deliberately independent of bookmaker odds.
 * This is NOT the empirical prediction model: abbreviated form strings
 * cannot establish race-class/going/trip/jockey partnerships or winning probability.
 * Run: node scripts/screen-whole-raceday.mjs [HH:MM local cutoff]
 * No changes to original picks, results, or cleared betting ledger.
 */
import {readFileSync} from 'node:fs';
const courses=['ffos-las','newmarket','carlisle','clonmel','southwell'];
const cutoff=process.argv[2]||'00:00';
const sources=courses.map(course=>JSON.parse(readFileSync('data/research/2026-10-22-all-races-'+course+'.json','utf8')));
const score = form => {
  const chars=String(form||'').toUpperCase().replace(/[^0-9PFURB]/g,'').slice(-4).split('');
  const marks=chars.map(x=> x==='1'?4:x==='2'?2.5:x==='3'?1.5:x==='4'?0.5:x==='F'||x==='U'||x==='P'||x==='R'?-1.5:0);
  return {recentEvidenceIndex:Number(marks.reduce((n,x,i)=>n+x*(i+1),0).toFixed(2)),
    recentRecordLength:chars.length,
    recentFirsts:chars.filter(x=>x==='1').length,
    recentPlaces:chars.filter(x=>'123'.includes(x)).length,
    latest:chars.at(-1)||'UNKNOWN',
    warning:chars.length<2?'Limited racecourse form on card':null};
};
const all=[],detail=[];
for(const source of sources)for(const race of source.races){
const runners=race.runners.filter(x=>!x.nonRunnerFlag).map(x=>({...x,...score(x.lastSix)}));
const removed=race.runners.filter(x=>x.nonRunnerFlag).map(x=>x.horse);
runners.sort((a,b)=>b.recentEvidenceIndex-a.recentEvidenceIndex);
const current=race.off>cutoff;
const raceRecord={course:source.course,off:race.off,name:race.name,conditions:race.conditions,
  going:source.course==='southwell'?'STANDARD Tapeta':source.course==='newmarket'?'SOFT':source.course==='carlisle'?'Hurdles GOOD; chases GOOD TO FIRM (Good in places)':source.course==='clonmel'?'Hurdles GOOD TO YIELDING; chases GOOD':'Ffos Las hurdles GOOD TO SOFT (Soft in places); chases SOFT (Good to Soft places)',
  source:source.source,active:runners.length,nonRunners:removed,currentAtSnapshot:current,
  candidatesForFullVerification:runners.slice(0,Math.min(5,runners.length)).map(x=>({horse:x.horse,form:x.lastSix,jockey:x.jockey,trainer:x.trainer,latest:x.latest,whyFlagged:'Recent-form-only mechanical flag; conditions/rivals/pace/handicap NOT independently corroborated'})),
  fullField:runners.map(x=>({...x,evidenceLevel:'Racecard abbreviated form + declared jockey/trainer only; NOT full previous-run history'})),
  allRunnerDeepComplete:false};
  all.push(raceRecord);
}
all.sort((a,b)=>a.off.localeCompare(b.off)||a.course.localeCompare(b.course));
const out={date:'2026-10-22',cutoffLocal:cutoff,method:'All five GB/Irish meetings; source-derived fields, NOT a win probability or tip. Odds deliberately excluded from shortlisting.',timeSensitive:false,
  totalMeetings:sources.length,totalRaces:all.length,totalActive:all.reduce((n,x)=>n+x.active,0),
  nonRunnerEntries:all.reduce((n,x)=>n+x.nonRunners.length,0),
  remainingRaces:all.filter(x=>x.currentAtSnapshot).length,
  deepHistoryStatus:'NEEDS FOLLOW-UP: this is ALL-RACE market-independent triage. Six races separately investigated with 3+ prior observations each.',
  noPaperOrRealBets:true,originalSnapshotsUnchanged:true,races:all};
console.log(JSON.stringify(out,null,2));
