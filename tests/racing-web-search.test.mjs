import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const races=JSON.parse(readFileSync(new URL('../data/races.json',import.meta.url),'utf8'));
const src=readFileSync(new URL('../functions/api/search-results.js',import.meta.url),'utf8').replace('export async function onRequestGet','async function onRequestGet');
const selected={horse:'Aighear',course:'Ayr',time:'17:13'};
const rss = (items)=>'<?xml version="1.0"?><rss><channel>'+items.map(x=>'<item><title>'+x.title+'</title><link>'+x.url+'</link><description>'+x.description+'</description></item>').join('')+'</channel></rss>';
const first={title:'1st Aighear Ayr 8 October 2026',description:'1st Aighear at Ayr 8 October 2026',url:'https://www.racingtv.com/results/2026-10-08/ayr/1713'};
const second={title:'Ayr result 8 October 2026: 1st Aighear',description:'Aighear won at Ayr on 8 October 2026',url:'https://www.skysports.com/racing/results/08-10-2026/ayr/1713'};
const forecast={title:'1st Aighear Ayr 8 October 2026',description:'1st Aighear at Ayr 8 October 2026',url:'https://www.sportinglife.com/racing/racecards/2026-10-08/ayr/racecard/1713'};
let mockRss=rss([first,second,forecast]);
const context=vm.createContext({URL,Request,Response,AbortController,setTimeout,clearTimeout,console,
 fetch:async url=>({ok:true,text:async()=>mockRss})});
const search=vm.runInContext(src+';onRequestGet',context);
const env={ASSETS:{fetch:async()=>({ok:true,json:async()=>({snapshotDate:races.snapshotDate,todaySelections:[selected]})})}};
const invoke=async()=>{
 const res=await search({request:new Request('https://racing-intelligence.pages.dev/api/search-results?horse=Aighear'),env});
 return res.json();
};
const full=await invoke();
assert.equal(full.ok,true);
assert.equal(full.searchCount,1);
assert.equal(full.confirmedCount,1);
assert.equal(full.results[0].confirmed.position,1);
assert.equal(full.results[0].hits.length,2,'Racecard prediction must not appear as a result');
mockRss=rss([first,forecast]);
const single=await invoke();
assert.equal(single.confirmedCount,0,'One publisher cannot automatically settle');
mockRss=rss([first,{...second,title:'2nd Aighear Ayr 8 October 2026',description:'2nd Aighear Ayr 8 October 2026'}]);
const conflict=await invoke();
assert.equal(conflict.confirmedCount,0,'Conflicting published finishes must not settle');
console.log('PASS: multi-source search, racecard exclusion, single-source and conflict safety');
