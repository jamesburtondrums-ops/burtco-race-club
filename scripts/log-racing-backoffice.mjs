// Persist material changes to daily racing performance and the verified rules journal.
// No network calls and no fictitious model "learning".
import fs from 'node:fs/promises';
import {dailyReports,tuningNotes} from '../functions/_lib/backoffice-stats.mjs';

const base=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await fs.readFile(new URL(p,base),'utf8'));
const ledger=await read('data/bet-ledger.json');
const race=await read('data/races.json');
const path=new URL('functions/_private/backoffice-history.json',base);
const stored=await read('functions/_private/backoffice-history.json');
const dates=dailyReports(ledger),changes=tuningNotes(race);
const compare=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
let updated=0;
stored.schemaVersion=1;stored.days=stored.days||[];stored.tuningLog=stored.tuningLog||[];
for(const day of dates){
 const i=stored.days.findIndex(x=>x.date===day.date);
 const existing=i>=0?stored.days[i]:null;
 // Strip metadata before comparing -- repeated checks must not create empty commits.
 const {recordedAt,revision,...oldReport}=existing||{};
 if(existing&&compare(oldReport,day))continue;
 const event={...day,recordedAt:new Date().toISOString(),revision:(revision||0)+1};
 if(i>=0)stored.days[i]=event;else stored.days.push(event);
 updated++;
}
for(const event of changes){
 const existing=stored.tuningLog.find(x=>x.key===event.key);
 if(existing){
  // Keep the original date the rule was first recorded; never claim new accuracy.
  if(existing.title!==event.title||existing.description!==event.description||existing.kind!==event.kind){
   existing.title=event.title;existing.description=event.description;existing.kind=event.kind;
   existing.lastAmendedAt=new Date().toISOString();updated++;
  }
 }else {
  stored.tuningLog.push({...event,recordedAt:new Date().toISOString(),
   evidenceStatus:'Rule change implemented; improved predictive accuracy not yet demonstrated'});
  updated++;
 }
}
stored.days.sort((a,b)=>a.date.localeCompare(b.date));
if(updated){
 await fs.writeFile(path,JSON.stringify(stored,null,2)+'\n');
 console.log('Backoffice log updated: '+updated+' material changes across '+stored.days.length+' days');
}else console.log('Backoffice log unchanged; no new results or rule changes');
