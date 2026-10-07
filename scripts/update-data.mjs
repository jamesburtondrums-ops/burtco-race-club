import fs from 'node:fs/promises';
const file=new URL('../data/racing.json',import.meta.url);
const current=JSON.parse(await fs.readFile(file,'utf8'));
const url=process.env.RACING_DATA_API_URL;
const token=process.env.RACING_DATA_API_TOKEN;
if(!url){
  console.log('RACING_DATA_API_URL is not configured. Keeping verified demo dataset unchanged.');
  process.exit(0);
}
const headers={'accept':'application/json'};
if(token) headers.authorization=`Bearer ${token}`;
const res=await fetch(url,{headers});
if(!res.ok) throw new Error(`Feed request failed: ${res.status} ${res.statusText}`);
const incoming=await res.json();
if(!incoming || !Array.isArray(incoming.meetings) || !incoming.meta) throw new Error('Feed payload failed schema validation: meta and meetings are required.');
const merged={...current,...incoming,meta:{...current.meta,...incoming.meta,updated_at:new Date().toISOString(),mode:'Connected feed'}};
if(!Array.isArray(merged.signals)) merged.signals=current.signals;
if(!merged.deep_races) merged.deep_races=current.deep_races;
if(!Array.isArray(merged.tracker)) merged.tracker=current.tracker;
await fs.writeFile(file,JSON.stringify(merged,null,2)+'\n');
console.log(`Updated ${merged.meetings.length} meetings from configured feed.`);