// On-demand multi-source web search via Bing's public RSS search feed.
// No automated requests to racing publishers themselves.
// Search snippets only auto-confirm when two independent publishers agree.
const SOURCES=[
 ['sportinglife.com','Sporting Life'],['attheraces.com','At The Races'],
 ['racingtv.com','Racing TV'],['skysports.com','Sky Sports'],
 ['racingpost.com','Racing Post'],['horseracing.net','HorseRacing.net'],
 ['gg.co.uk','GG'],['britishhorseracing.com','BHA'],['irishracing.com','Irish Racing']
];
const normal=value=>String(value||'').toLowerCase().replace(/\((ire|gb|fr)\)/g,'').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const escapeRegex=s=>s.replace(/[|\\{}()[\]^$+*?.]/g,'\\$&');
const decode=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
 .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
 .replace(/&lt;/g,'<').replace(/&gt;/g,'>')
 .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
 .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function parseRSS(xml){
 return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,15).map(([,body])=>{
  const field=tag=>decode(body.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'))?.[1]);
  return {title:field('title'),description:field('description'),url:field('link')};
 }).filter(x=>x.url&&x.title);
}
function sourceOf(url){
 try{const host=new URL(url).hostname.toLowerCase().replace(/^www\./,'');return SOURCES.find(([domain])=>host===domain||host.endsWith('.'+domain))?.[1]||null}catch{return null}
}
function isResultsPage(url){
 try {
  const path=new URL(url).pathname.toLowerCase();
  if (/\/(racecards?|tips?|news|meeting|live-show|previews?)\//.test(path)) return false;
  return /\/(?:results?|fast-results)\//.test(path);
 } catch {return false}
}
function dateInResult(x,date){
 const text=(x.title+' '+x.description+' '+x.url).toLowerCase();
 const [y,m,d]=date.split('-');
 const month=['','january','february','march','april','may','june','july','august','september','october','november','december'][Number(m)];
 return text.includes(date)||text.includes(d+'-'+m+'-'+y)||text.includes(d+'/'+m+'/'+y)||
   text.includes(Number(d)+' '+month+' '+y)||text.includes(month+' '+Number(d)+' '+y);
}
function explicitPlace(text,horse){
 const h=escapeRegex(normal(horse)).replace(/ /g,'\\s+');
 const clean=normal(text);
 const first=clean.match(new RegExp('(?:^|\\s)(1st|2nd|3rd|[4-9]th|1[0-9]th)\\s+(?:dh\\s+)?'+h+'(?:\\s|$)','i'));
 if(first)return parseInt(first[1],10);
 const after=clean.match(new RegExp('(?:^|\\s)'+h+'\\s+(?:finished\\s+|placed\\s+|came\\s+)?(1st|2nd|3rd|[4-9]th|1[0-9]th)(?:\\s|$)','i'));
 if(after)return parseInt(after[1],10);
 if(new RegExp('(?:^|\\s)'+h+'\\s+(?:has\\s+)?won(?:\\s|$)','i').test(clean))return 1;
 const words=clean.match(new RegExp(h+'\\s+(?:finished\\s+|came\\s+)(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)','i'))?.[1];
 if(words)return ['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'].indexOf(words)+1;
 return null;
}
const json=(data,code=200)=>new Response(JSON.stringify(data),{status:code,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'
}});
async function queryWeb(pick,date){
 const query='"'+pick.horse+'" "'+pick.course+'" '+date+' horse racing result finishing position';
 const target='https://www.bing.com/search?q='+encodeURIComponent(query)+'&format=rss';
 const ctrl=new AbortController(),kill=setTimeout(()=>ctrl.abort(),7000);
 try{
  const response=await fetch(target,{headers:{'accept':'application/rss+xml,application/xml,text/xml',
   'user-agent':'RacingIntelligenceResults/1.0 (user-requested RSS search)'},signal:ctrl.signal});
  if(!response.ok)throw Error('Search provider HTTP '+response.status);
  const xml=await response.text();
  if(!/<rss[\s>]/i.test(xml))throw Error('Search provider returned no RSS feed');
  const hits=parseRSS(xml).filter(hit=>{
    if(!sourceOf(hit.url)||!isResultsPage(hit.url)||!dateInResult(hit,date))return false;
    const text=normal(hit.title+' '+hit.description+' '+new URL(hit.url).pathname.replace(/[\/-]/g,' '));
    return text.includes(normal(pick.horse))&&text.includes(normal(pick.course));
  }).slice(0,5).map(hit=>({
    title:hit.title.slice(0,190),snippet:hit.description.slice(0,370),url:hit.url,
    source:sourceOf(hit.url),position:explicitPlace(hit.title+' '+hit.description,pick.horse)
  }));
  const support=new Map();
  for(const hit of hits.filter(x=>x.position)){
    if(!support.has(hit.position))support.set(hit.position,new Set());
    support.get(hit.position).add(hit.source);
  }
  const agreed=[...support].filter(([,publishers])=>publishers.size>=2);
  const confirmed=agreed.length===1?{
    position:agreed[0][0],status:'Weighed in',source:'Web search: '+[...agreed[0][1]].join(' + '),
    verifiedUrls:hits.filter(h=>h.position===agreed[0][0]).map(h=>h.url).slice(0,3)
  }:null;
  return {horse:pick.horse,course:pick.course,time:pick.time,date,hits,confirmed,checked:true};
 }catch(e){
  return {horse:pick.horse,course:pick.course,time:pick.time,date,
   hits:[],confirmed:null,checked:false,error:String(e).slice(0,150)};
 }finally{clearTimeout(kill)}
}
export async function onRequestGet({request,env}){
 const url=new URL(request.url);
 const page=await env.ASSETS.fetch(new Request(new URL('/data/races.json',url)));
 if(!page.ok)return json({ok:false,error:'Published selections unavailable'},503);
 const data=await page.json(),date=data.snapshotDate;
 const selections=['todaySelections','midshotsToday','longshotsToday']
  .flatMap(g=>(data[g]||[]))
  .filter(p=>!p.result?.position && !/^(NR|PU|F|DNF)$/i.test(p.result?.status||''));
 const key=url.searchParams.get('horse');
 let pending=key?selections.filter(p=>normal(p.horse)===normal(key)):selections;
 if(key&&!pending.length)return json({ok:false,error:'Selection is not awaiting a result'},400);
 pending=pending.slice(0,15);
 const results=[];
 for(let i=0;i<pending.length;i+=3)
  results.push(...await Promise.all(pending.slice(i,i+3).map(p=>queryWeb(p,date))));
 return json({ok:true,checkedAt:new Date().toISOString(),source:'Bing RSS search across racing publishers',
   date,searchCount:results.length,confirmedCount:results.filter(x=>x.confirmed).length,results,
   method:'Automatic settlement requires matching positions from two independent publishers. Other search hits require review.'});
}
