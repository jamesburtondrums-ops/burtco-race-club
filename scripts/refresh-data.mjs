import fs from "node:fs/promises";

const API="https://api.theracingapi.com/v1";
const USER=process.env.RACING_API_USERNAME;
const PASS=process.env.RACING_API_PASSWORD;
const PLAN=(process.env.RACING_API_PLAN||"standard").toLowerCase();
const target="data/races.json";

const auth=()=>({Authorization:"Basic "+Buffer.from(`${USER}:${PASS}`).toString("base64"),Accept:"application/json"});
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const key=s=>String(s||"").toLowerCase().replace(/\([^)]*\)/g,"").replace(/[^a-z0-9]/g,"");
const pos=v=>{const m=String(v||"").match(/\d+/);return m?Number(m[0]):null};
const cls=v=>{const m=String(v||"").match(/class\s*(\d+)/i);return m?Number(m[1]):null};
const hidden=/hamper|blocked|denied|short of room|checked|stumbled|slowly away|dwelt|wide|keen|eased|not clear run/i;

async function get(url){
  const r=await fetch(url,{headers:auth()});
  if(!r.ok)throw new Error(`${r.status} ${r.statusText} — ${url}`);
  return r.json();
}
async function batches(items,fn,size=4){
  const out=[];
  for(let i=0;i<items.length;i+=size){
    const chunk=items.slice(i,i+size);
    out.push(...await Promise.all(chunk.map(async x=>{try{return await fn(x)}catch(e){return {error:e.message}}})));
    if(i+size<items.length)await new Promise(r=>setTimeout(r,1050));
  }
  return out;
}
function runnerFromResult(row,horseId,horseName){
  if(Array.isArray(row.runners))return row.runners.find(x=>x.horse_id===horseId||key(x.horse)===key(horseName))||{};
  return row;
}
function historyMetrics(results,race,runner){
  const rows=(results||[]).map(x=>({...x,_r:runnerFromResult(x,runner.horse_id,runner.horse)}));
  const currentOR=n(runner.ofr??runner.or);
  const wins=rows.filter(x=>pos(x._r.position??x.position)===1);
  const lastWin=wins[0];
  const lastWinOR=lastWin?n(lastWin._r.ofr??lastWin._r.or??lastWin.rating):null;
  const bestWinOR=wins.map(x=>n(x._r.ofr??x._r.or??x.rating)).filter(Number.isFinite).sort((a,b)=>b-a)[0]??null;
  const sameCourse=rows.filter(x=>key(x.course)===key(race.course));
  const sameCD=sameCourse.filter(x=>String(x.dist??x.distance??"").replace(/\s/g,"")===String(race.distance??"").replace(/\s/g,""));
  const last=rows[0];
  const currentClass=cls(race.race_class), lastClass=last?cls(last.race_class??last.class):null;
  return {
    starts:rows.length,
    last_win_or:lastWinOR,
    best_win_or:bestWinOR,
    lbs_below_last_win:currentOR!==null&&lastWinOR!==null?lastWinOR-currentOR:null,
    course_starts:sameCourse.length,
    course_wins:sameCourse.filter(x=>pos(x._r.position??x.position)===1).length,
    cd_places:sameCD.filter(x=>{const p=pos(x._r.position??x.position);return p&&p<=3}).length,
    class_drop:currentClass&&lastClass?currentClass>lastClass:null,
    hidden_run_flag:rows.slice(0,3).some(x=>hidden.test(String(x._r.comment??x.comments??""))),
    recent:rows.slice(0,8).map(x=>({
      date:x.date,course:x.course,position:x._r.position??x.position,
      or:x._r.ofr??x._r.or??x.rating??null,
      pr:x._r.performance_rating??null,sr:x._r.speed_rating??null,
      class:x.race_class??x.class??"",going:x.going??"",distance:x.dist??x.distance??"",
      comment:x._r.comment??x.comments??""
    }))
  };
}
const label=v=>v>=2?"Strong Positive":v===1?"Positive":v===0?"Neutral":v===-1?"Negative":"Unknown";
function grade(ev){
  const vals=Object.values(ev),sp=vals.filter(x=>x==="Strong Positive").length,p=vals.filter(x=>x==="Positive").length,neg=vals.filter(x=>x==="Negative").length,known=vals.filter(x=>x!=="Unknown").length;
  if(known<4)return"C"; if(sp>=2&&sp+p>=4&&neg===0)return"A"; if(sp+p>=3&&neg<=1)return"B+"; if(sp+p>=2)return"B"; return"C";
}
function score(race,r,h){
  const or=n(r.ofr??r.or),pr=n(r.performance_rating),sr=n(r.speed_rating);
  let handicap=0,suit=0,course=0,hiddenSig=-99,jockey=0,trainer=0,pedigree=-99;
  if(or!==null&&h.last_win_or!==null&&h.last_win_or!==undefined){
    const d=h.last_win_or-or; handicap=d>=5?2:d>=2?1:d<=-6?-1:0;
  }
  if(pr!==null&&or!==null&&pr>=or+5)handicap=Math.max(handicap,1);
  if(sr!==null&&or!==null&&sr>=or+5)suit=Math.max(suit,1);
  if(h.course_wins>0)course=2; else if(h.course_starts>=2)course=1;
  if(h.cd_places>=2)suit=Math.max(suit,2); else if(h.class_drop)suit=Math.max(suit,1);
  if(h.hidden_run_flag)hiddenSig=1;
  const claim=n(r.jockey_claim_lbs??r.claim); if(claim>=5)jockey=1;
  const pct=n(r.trainer_14_days?.percent??r.trainer_14_days?.percentage),rtf=n(r.trainer_rtf);
  if((pct!==null&&pct>=20)||(rtf!==null&&rtf>=65))trainer=1;
  if((r.sire||r.dam||r.damsire)&&n(r.age)<=3)pedigree=1;
  const evidence={market:"Unknown",handicap:label(handicap),suitability:label(suit),hidden:label(hiddenSig),course:label(course),pace:"Unknown",jockey:label(jockey),trainer:label(trainer),pedigree:label(pedigree),quality:"Positive"};
  const tags=[];
  if(handicap>=2)tags.push("WELL HANDICAPPED");
  if(course>=2)tags.push("COURSE SPECIALIST");
  if(h.class_drop)tags.push("CLASS DROP");
  if(h.hidden_run_flag)tags.push("HIDDEN LAST-TIME-OUT RUN");
  if(jockey>0)tags.push("JOCKEY CLAIM");
  if(trainer>0)tags.push("TRAINER FORM");
  if(pedigree>0)tags.push("UNEXPOSED / PEDIGREE");
  if(h.lbs_below_last_win>=2)tags.push(`${h.lbs_below_last_win}LB BELOW LAST WIN`);
  return{evidence,tags,grade:grade(evidence)};
}
function odds(r){
  const rows=Array.isArray(r.odds)?r.odds:[];
  return rows.map(x=>({bookmaker:x.bookmaker||"",decimal:n(x.decimal),fractional:x.fractional||""})).filter(x=>x.decimal);
}

if(!USER||!PASS){
  console.log("RACING_API_USERNAME / RACING_API_PASSWORD not configured. Keeping last valid dataset.");
  process.exit(0);
}
const endpoint=PLAN==="pro"?"pro":PLAN==="free"?"free":"standard";
const qs=new URLSearchParams({limit:"500"});
if(endpoint==="pro")qs.set("date",new Date().toISOString().slice(0,10)); else qs.set("day","today");
qs.append("region_codes","gb");qs.append("region_codes","ire");
const raw=await get(`${API}/racecards/${endpoint}?${qs}`);
const cards=(raw.racecards||raw||[]).filter(x=>x&&!x.is_abandoned);
const entries=cards.flatMap(r=>(r.runners||[]).filter(x=>x.horse_id).map(x=>({race:r,runner:x})));
console.log(`Racecards: ${cards.length}; runners: ${entries.length}`);

const hs=await batches(entries,async ({race,runner})=>{
  const end=new Date().toISOString().slice(0,10),startDate=new Date();startDate.setFullYear(startDate.getFullYear()-4);
  const q=new URLSearchParams({start_date:startDate.toISOString().slice(0,10),end_date:end});
  const d=await get(`${API}/racecards/${encodeURIComponent(runner.horse_id)}/results?${q}`);
  return{horse_id:runner.horse_id,metrics:historyMetrics(d.results||d||[],race,runner)};
});
const history=new Map(hs.filter(x=>x&&!x.error).map(x=>[x.horse_id,x.metrics]));

const races=cards.map(c=>({
  id:c.race_id,course:c.course,time:c.off_time||"",off_dt:c.off_dt,date:c.date,name:c.race_name,
  region:c.region,type:c.type,distance:c.distance,surface:c.surface,going:c.going,race_class:c.race_class,rating_band:c.rating_band,
  conditions:[c.age_band,c.distance,c.surface,c.going,c.race_class,c.rating_band,`${c.field_size||c.runners?.length||0} runners`].filter(Boolean).join(" · "),
  runners:(c.runners||[]).map(r=>{
    const h=history.get(r.horse_id)||{};
    const s=score(c,r,h),prices=odds(r).sort((a,b)=>b.decimal-a.decimal),best=prices[0]||null;
    return{
      horse:r.horse,horse_id:r.horse_id,number:r.number,draw:r.draw,age:r.age,weight:r.weight||r.lbs||"",
      or:r.ofr??r.or??"—",performance_rating:r.performance_rating??"—",speed_rating:r.speed_rating??"—",
      form:r.form||"",last_run:r.last_run||"",jockey:r.jockey||"",claim:r.jockey_claim_lbs||"",trainer:r.trainer||"",
      sire:r.sire||"",dam:r.dam||"",damsire:r.damsire||"",headgear:r.headgear||"",wind_surgery:r.wind_surgery||"",
      best_odds:best?(best.fractional||best.decimal):"—",best_odds_decimal:best?.decimal??null,odds_sources:prices.length,
      history:h,evidence:s.evidence,tags:s.tags,grade:s.grade,model:s.tags[0]||"Evidence profile",
      fact:[r.form?`Form ${r.form}`:null,(r.ofr??r.or)?`OR ${r.ofr??r.or}`:null,r.performance_rating&&r.performance_rating!=="-"?`PR ${r.performance_rating}`:null,r.speed_rating&&r.speed_rating!=="-"?`SR ${r.speed_rating}`:null].filter(Boolean).join(" · ")
    };
  })
}));
const meetings=[...new Map(races.map(r=>[r.course,{course:r.course,code:r.type||r.region||"",times:races.filter(x=>x.course===r.course).map(x=>x.time)}])).values()];
const out={
 snapshotDate:new Date().toISOString().slice(0,10),verifiedAt:new Date().toISOString(),mode:"LIVE GB + IRE FEED",
 sources:[
  {name:"The Racing API",status:"connected",role:"GB + IRE racecards, OR, PR, SR, current odds and horse history",detail:`${PLAN.toUpperCase()} adapter; API data refreshes approximately every five minutes.`},
  {name:"BHA",status:"reference",role:"GB official handicap validation",detail:"Official weekly ratings and performance-figure publications."},
  {name:"IHRB",status:"reference",role:"Irish handicap validation",detail:"Official Irish Flat and National Hunt handicap ratings."},
  {name:"Betfair",status:"not-connected",role:"Exchange liquidity / back-lay / traded volume",detail:"Optional next market layer."},
  {name:"TPD",status:"not-connected",role:"Sectionals / position / ground loss",detail:"Optional hidden-run layer."}
 ],meetings,races
};
await fs.writeFile(target,JSON.stringify(out,null,2)+"\n","utf8");
console.log(`Saved ${races.length} GB/IRE races and ${entries.length} runners.`);