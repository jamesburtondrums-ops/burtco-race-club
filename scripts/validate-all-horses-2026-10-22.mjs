#!/usr/bin/env node
/**
 * Validates 397 horse-level date-frozen screening profiles without writing to
 * original selection or cleared bet ledger. Run:
 * node scripts/validate-all-horses-2026-10-22.mjs
 */
import {readFileSync} from 'node:fs';
const courses=['carlisle','clonmel','ffos-las','newmarket','southwell'];
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const full=JSON.parse(readFileSync('data/research/2026-10-22-all-40-race-screen.json','utf8'));
const missingExpected=['Carleys Lilly','Prince Palace','Without Exception','Tiger'];
const errors=[],unmatched=[],profiles=[],unique=new Set();
for(const course of courses){
 const source=JSON.parse(readFileSync('data/research/2026-10-22-all-races-'+course+'.json','utf8'));
 const lines=readFileSync('data/research/2026-10-22-enhanced-'+course+'.txt','utf8').split(/\r?\n/).filter(x=>/^\d\d:\d\d\|/.test(x));
 for(const line of lines){
  const p=line.split('|'),[off,horse,jockey,trainer,form]=p;
  if(p.length!==24)errors.push('Wrong evidence column count for '+course+' '+horse+': '+p.length);
  const key=[course,off,norm(horse)].join('|');
  if(unique.has(key))errors.push('Duplicated horse '+key);
  unique.add(key);
  if(!horse||!jockey||!trainer)errors.push('Missing declared identity '+key);
  if(!p[20]||!p[21]||!p[22])errors.push('Missing positive/risk/uncertainty record '+key);
  if(!Number.isFinite(+p[18]))errors.push('Non-numeric screening score '+key);
  const race=source.races.find(r=>r.off===off);
  if(!race)errors.push('Race missing from source '+key);
  else if(!race.runners.some(r=>!r.nonRunnerFlag&&norm(r.horse)===norm(horse)))errors.push('Horse not active in source '+key);
  if(p[19]==='MISSING_STATS')unmatched.push(horse);
  profiles.push({course,off,horse,form,positive:p[20],risk:p[21],priority:p[19]});
 }
 const expected=source.races.reduce((n,r)=>n+r.active,0);
 if(lines.length!==expected)errors.push('Incomplete source roster '+course+': '+lines.length+' vs '+expected);
}
if(profiles.length!==397)errors.push('Expected 397 rows, received '+profiles.length);
if(unique.size!==397)errors.push('Expected 397 unique horse/race identities');
if(full.totalRaces!==40)errors.push('40-race universe mismatch');
if(unmatched.length!==4||unmatched.sort().join(',')!==missingExpected.sort().join(','))errors.push('External-source unmatched IDs changed '+unmatched.join(','));
for(const [horse,disallowed,recommended] of [
 ['Micks Jet','Placed third last start','Latest form indicates an unplaced finish'],
 ['Fram Castle','Most recent form figure is a win','Second last start'],
 ['Sycamore Gap','Most recent form figure is a win','Latest form indicates an unplaced finish'],
 ['World As One','Second last start','Latest run ended without completing']
]){
 const p=profiles.find(x=>x.horse===horse);
 if(!p)errors.push('Regression horse absent '+horse);
 else if(p.positive.includes(disallowed)||!((p.positive+'; '+p.risk).includes(recommended)))errors.push('Bad latest-form decoding '+horse);
}
const report={date:'2026-10-22',raceCount:full.totalRaces,runnerCount:profiles.length,
  independentlySourceMatched:profiles.length-unmatched.length,sourceDiscrepancies:unmatched,
  formTokenRegressionsChecked:['33/P-0','8231V2','21/589','-4532B'],
  integrity:'Read-only validator; original snapshots and cleared ledger left unchanged',
  limitations:'Form screen is NOT a validated probability model, 397 full-video historic case studies or a promise of EW value',
  passed:errors.length===0,errors};
console.log(JSON.stringify(report,null,2));
if(errors.length)process.exitCode=1;
