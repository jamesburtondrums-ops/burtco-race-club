const state={data:null,view:"today",filter:"ALL"};
const val=v=>v===undefined||v===null||v===""?"—":v;
const v41=x=>x.v41||null;
const probabilityOf=x=>v41(x)?.winProbability??null;
const leadOf=x=>v41(x)?.leadOverSecond??null;
const confidenceLabel=x=>{
 const p=probabilityOf(x);
 if(p===null)return "RECHECK";
 if(primeOf(x))return "PRIME";
 if(p>=45)return "★★★★★";
 if(p>=35)return "★★★★☆";
 if(p>=27.5)return "★★★☆☆";
 if(p>=20)return "★★☆☆☆";
 return "★☆☆☆☆";
};
const primeOf=x=>{
 const q=v41(x); if(!q)return false;
 const rt=(q.raceType||"").toLowerCase();
 const threshold=["nursery","hurdle"].includes(rt)?60:55;
 const handicap=rt==="handicap";
 return q.winProbability>=threshold &&
   q.marketRank===1 &&
   q.leadOverSecond>=8 &&
   q.criticalCoverage>=90 &&
   (q.positiveGroups||0)>=5 &&
   !q.majorRedFlag &&
   q.lateMarketConfirmed===true &&
   (!q.newcomer || q.pedigreeComplete===true) &&
   (q.racePredictability||0)>=70;
};
const starsOf=x=>{
 const p=probabilityOf(x);
 if(p===null)return 0;
 return p>=45?5:p>=35?4:p>=27.5?3:p>=20?2:1;
};
const stars=n=>'<span class="stars">'+Array.from({length:5},(_,i)=>i<n?'★':'☆').join('')+'</span>';
async function load(){const r=await fetch("./data/races.json?"+Date.now());state.data=await r.json();render()}
function nav(){return [["today","Today"],["system","V4 System"],["checks","All checks"],["backtest","Backtest"],["sources","Sources"]].map(([v,t])=>`<button class="${state.view===v?"active":""}" data-view="${v}">${t}</button>`).join("")}
function filters(){const x=["ALL","PRIME","★★★★★","★★★★☆","★★★☆☆","WATCH"];return `<div class="meeting-tabs">${x.map(f=>`<button data-filter="${f}" class="${state.filter===f?"active":""}">${f}</button>`).join("")}</div>`}
function card(x){
 const prime=primeOf(x), winStars=starsOf(x), p=probabilityOf(x), q=v41(x), label=confidenceLabel(x);
 const legacy=!q;
 return `<article class="pick-card ${prime?"prime-card":legacy?"legacy-card":""}">
   ${prime?'<div class="prime-banner">PRIME · '+p.toFixed(1)+'% WIN PROBABILITY</div>':legacy?'<div class="recheck-banner">V4.1 RECHECK REQUIRED</div>':`<div class="win-confidence"><span>${p.toFixed(1)}% WIN PROBABILITY</span>${stars(winStars)}</div>`}
   <div class="pick-head"><div><span class="tier ${prime?"prime":legacy?"watch":"confidence"}">${prime?"PRIME":legacy?"RECHECK":label}</span><h3>${x.horse}</h3><p>${x.course} · ${x.time}</p></div><strong class="price">${val(x.odds)}</strong></div>
   ${q?`<div class="v41-grid"><div><span>Model lead</span><b>${val(q.leadOverSecond)}pp</b></div><div><span>Market rank</span><b>#${val(q.marketRank)}</b></div><div><span>Check coverage</span><b>${val(q.criticalCoverage)}%</b></div><div><span>Race predictability</span><b>${val(q.racePredictability)}/100</b></div></div>`:""}
   <div class="rating-strip"><div><span>OR</span><b>${val(x.or)}</b></div><div><span>TS</span><b>${val(x.ts)}</b></div><div><span>RPR</span><b>${val(x.rpr)}</b></div></div>
   <div class="signal-list">${(x.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
   <div class="pick-copy"><strong>Decision</strong><p>${legacy?"This horse has not yet been rerun through V4.1 Accuracy Mode. Its old grade is intentionally suppressed.":x.reason}</p></div>
   ${q?`<div class="score-grid v41-checks"><span>Positive evidence groups</span><b>${val(q.positiveGroups)}</b><span>Aiming groups</span><b>${val(q.aimingGroups)}</b><span>Retained ability</span><b>${q.retainedAbility?"YES":"NO"}</b><span>Late market confirmed</span><b>${q.lateMarketConfirmed?"YES":"NO"}</b><span>Price view</span><b>${val(q.priceLabel||"PRICE WATCH")}</b></div>`:""}
   <div class="pick-risk"><strong>Risk</strong><p>${x.risk||"—"}</p></div>
   <div class="source-line">Source: ${x.source||"—"}</div>
 </article>`
}
function today(){
 const d=state.data;
 const picks=d.todaySelections.filter(x=>{
   const label=confidenceLabel(x);
   if(state.filter==="ALL")return true;
   if(state.filter==="WATCH")return label==="★☆☆☆☆"||label==="RECHECK";
   return label===state.filter;
 });
 const primes=picks.filter(primeOf);
 const others=picks.filter(x=>!primeOf(x));
 return `${d.scoringModel?.legacy?'<div class="panel" style="border-left:4px solid #a88026"><strong>V4.1 RECHECK REQUIRED</strong><p class="meta" style="margin-top:5px">These cards pre-date V4.1 Accuracy Mode. Their previous PRIME/stars are suppressed. A fresh grade now requires calibrated probability, favourite status, model dominance, race predictability, aiming/connection checks and late-market confirmation.</p></div>':''}<section class="hero"><div class="hero-main"><div class="eyebrow">8 OCTOBER 2026 · GB + IRE</div><h2>Today's selections — fully rechecked under V4.1 Accuracy Mode.</h2><p>PRIME is now deliberately rare: 55%+ calibrated win probability, favourite status, clear model dominance and full safeguards. If a race is too uncertain, the correct output is NO SELECTION.</p></div>
 <div class="status-panel"><div class="status-row"><span>Meetings scanned</span><strong>${d.coverage.meetings}</strong></div><div class="status-row"><span>Races scanned</span><strong>${d.coverage.races}</strong></div><div class="status-row"><span>Selections rechecked</span><strong>${d.todaySelections.length}</strong></div><div class="status-row"><span>PRIME picks</span><strong>${d.todaySelections.filter(primeOf).length}</strong></div></div></section>
 ${filters()}
 ${primes.length?`<div class="section-head prime-section-title"><div><h3>PRIME</h3><p>Highest-conviction win profiles.</p></div></div><div class="prime-grid">${primes.map(card).join("")}</div>`:""}
 ${others.length?`<div class="section-head"><div><h3>Other selections</h3><p>Stars represent confidence in the data for win purposes — not value.</p></div></div><div class="pick-grid">${others.map(card).join("")}</div>`:""}
 `;
}
function systemV4(){
 const s=state.data.systemV4;
 const gradeRows=[s.grades.PRIME,s.grades.five,s.grades.four,s.grades.three,s.grades.two,s.grades.one];
 return `<section class="hero"><div class="hero-main"><div class="eyebrow">SYSTEM V4.1 ACCURACY MODE · 10,000-RACE BACKTEST</div><h2>PRIME now optimises for accuracy by sacrificing selection volume.</h2><p>The system first decides whether a race is predictable enough to select from, then requires probability, market, dominance and aiming evidence to agree before a horse can be PRIME.</p></div><div class="status-panel"><div class="status-row"><span>Historical races</span><strong>${s.backtest.races.toLocaleString()}</strong></div><div class="status-row"><span>Unseen test races</span><strong>${s.backtest.unseenTestRaces.toLocaleString()}</strong></div><div class="status-row"><span>Clean market races</span><strong>${s.backtest.validMarketTestRaces.toLocaleString()}</strong></div><div class="status-row"><span>55% gate benchmark</span><strong>${s.backtest.prime55.strikeRate}%</strong></div></div></section>
 <div class="section-head"><div><h3>Confidence ladder</h3><p>Observed historical calibration is shown beside each rule.</p></div></div>
 <div class="panel grading-panel">
   <div class="grade-rule prime-rule"><b>PRIME</b><span>${s.grades.PRIME.rule}<br><small>${s.grades.PRIME.observed}</small></span></div>
   <div class="grade-rule"><b>★★★★★</b><span>${s.grades.five.rule}<br><small>${s.grades.five.observed}</small></span></div>
   <div class="grade-rule"><b>★★★★☆</b><span>${s.grades.four.rule}<br><small>${s.grades.four.observed}</small></span></div>
   <div class="grade-rule"><b>★★★☆☆</b><span>${s.grades.three.rule}<br><small>${s.grades.three.observed}</small></span></div>
   <div class="grade-rule"><b>★★☆☆☆</b><span>${s.grades.two.rule}<br><small>${s.grades.two.observed}</small></span></div>
   <div class="grade-rule"><b>★☆☆☆☆</b><span>${s.grades.one.rule}</span></div>
 </div>
 <div class="section-head"><div><h3>PRIME Accuracy Gate</h3><p>All conditions are required; failing one means downgrade or NO SELECTION.</p></div></div>
 <div class="panel decision-gates">
   <div><b>Probability</b><span>≥55% normally; ≥60% for nurseries/hurdles.</span></div>
   <div><b>Market</b><span>Must be favourite at final PRIME check.</span></div>
   <div><b>Dominance</b><span>At least 8 percentage points clear of the second-ranked horse.</span></div>
   <div><b>Race quality</b><span>Predictability score ≥70/100.</span></div>
   <div><b>Evidence</b><span>≥90% critical checks and at least five independent positive groups.</span></div>
   <div><b>Aiming</b><span>Retained ability and targeting signals move probability but are not hard gates; forcing them reduced historical accuracy.</span></div>
   <div><b>Market close</b><span>Late market confirmation required; unexplained drift blocks PRIME.</span></div>
 </div>
 <div class="section-head"><div><h3>Race-type rules</h3></div></div>
 <div class="source-grid">${Object.entries(s.accuracyMode.raceTypeRules).map(([k,v])=>`<div class="source-card"><h4>${k.toUpperCase()}</h4><p>${v}</p></div>`).join("")}</div>
 <div class="section-head"><div><h3>Evidence groups</h3><p>Independent evidence is more important than stacking correlated statistics.</p></div></div>
 <div class="panel check-list">${s.probabilityEngine.evidenceGroups.map(g=>`<div class="check-group"><div class="check-title"><b>${g.name}</b><strong>${g.weight}</strong></div><ul>${g.checks.map(x=>`<li>${x}</li>`).join("")}</ul>${g.research?`<p class="meta"><strong>Backtest:</strong> ${g.research}</p>`:""}</div>`).join("")}</div>
 <div class="section-head"><div><h3>Hard PRIME blocks</h3></div></div><div class="panel"><ul class="protocol-list">${s.hardBlocks.map(x=>`<li>${x}</li>`).join("")}</ul></div>
 <div class="section-head"><div><h3>Price / ROI policy</h3></div></div><div class="panel"><div class="alert"><strong>${s.pricePolicy.status}</strong><br><span class="meta">${s.pricePolicy.reason} ${s.pricePolicy.currentUse}</span></div></div>`;
}
function grading(){
 const g=state.data.gradingSystem;
 return `<div class="section-head"><div><h3>Grading system</h3><p>Chance and price are deliberately separated.</p></div></div>
 <div class="panel grading-panel"><div class="grade-rule prime-rule"><b>PRIME</b><span>${g.PRIME}<br><small>${state.data.scoringModel.primeRule}</small></span></div><div class="grade-rule"><b>STRONG</b><span>${g.STRONG}</span></div><div class="grade-rule"><b>VALUE</b><span>${g.VALUE}</span></div><div class="grade-rule"><b>SPECULATIVE</b><span>${g.SPECULATIVE}</span></div><div class="grade-rule"><b>WATCH</b><span>${g.WATCH}</span></div></div>
 <div class="section-head"><div><h3>Win-confidence scoring</h3><p>Stars are calculated, not manually assigned.</p></div></div><div class="panel"><div class="star-legend"><b>★★★★★</b><span>76–81/100 (PRIME begins at 82 with extra safeguards)</span><b>★★★★☆</b><span>68–75/100</span><b>★★★☆☆</b><span>58–67/100</span><b>★★☆☆☆</b><span>48–57/100</span><b>★☆☆☆☆</b><span>0–47/100</span></div></div>`;
}
function checks(){
 const f=state.data.scoringFrameworkV2;
 const model=(title,rows)=>`<div class="section-head"><div><h3>${title}</h3><p>Maximum 100 points before risk deductions.</p></div></div><div class="panel check-list">${rows.map(r=>`<div class="check-group"><div class="check-title"><b>${r.label}</b><strong>${r.max} pts</strong></div><ul>${r.checks.map(c=>`<li>${c}</li>`).join("")}</ul></div>`).join("")}</div>`;
 return `<section class="hero"><div class="hero-main"><div class="eyebrow">SCORING FRAMEWORK V2.0</div><h2>No confident selection without the full evidence chain.</h2><p>Established runners and newcomers are scored differently. Missing critical evidence reduces confidence and can block PRIME completely.</p></div><div class="status-panel"><div class="status-row"><span>Established model</span><strong>100 pts</strong></div><div class="status-row"><span>Newcomer model</span><strong>100 pts</strong></div><div class="status-row"><span>Risk deductions</span><strong>Up to -25</strong></div><div class="status-row"><span>PRIME coverage</span><strong>≥90%</strong></div></div></section>
 ${model("Established runners",f.establishedModel)}
 ${model("Newcomers / lightly raced horses",f.newcomerModel)}
 <div class="section-head"><div><h3>Critical checks</h3><p>PRIME is blocked until these are complete.</p></div></div>
 <div class="source-grid"><div class="source-card"><h4>Established</h4><ul>${f.criticalChecksEstablished.map(x=>`<li>${x}</li>`).join("")}</ul></div><div class="source-card"><h4>Newcomer / lightly raced</h4><ul>${f.criticalChecksNewcomer.map(x=>`<li>${x}</li>`).join("")}</ul></div></div>
 <div class="section-head"><div><h3>Daily research protocol</h3></div></div><div class="panel"><ol class="protocol-list">${state.data.dailyResearchProtocol.map(x=>`<li>${x}</li>`).join("")}</ol></div>
 <div class="section-head"><div><h3>Decision gates</h3></div></div><div class="panel decision-gates">${Object.entries(f.decisionGates).map(([k,v])=>`<div><b>${k.toUpperCase()}</b><span>${v}</span></div>`).join("")}</div>`;
}
function backtest(){
 const b=state.data.pilotBacktest,m=b.metrics,v3=state.data.confidenceMethodV3;
 const metric=(title,x)=>`<div class="signal-card"><div class="label">${title}</div><h4>${x.wins}/${x.bets} winners</h4><div class="status-row"><span>Strike rate</span><strong>${x.strikeRate}%</strong></div><div class="status-row"><span>ROI at ISP</span><strong>${x.roi>0?"+":""}${x.roi}%</strong></div></div>`;
 return `<section class="hero"><div class="hero-main"><div class="eyebrow">HISTORICAL PILOT</div><h2>Use old races to test the confidence logic before trusting it live.</h2><p>${b.warning}</p></div><div class="status-panel"><div class="status-row"><span>Sample</span><strong>12 races</strong></div><div class="status-row"><span>Best accuracy subset</span><strong>Model + market agreement</strong></div><div class="status-row"><span>Status</span><strong>${v3.status}</strong></div></div></section>
 <div class="section-head"><div><h3>Pilot results</h3><p>The unusually high ROI shows why this sample must not be extrapolated.</p></div></div>
 <div class="cards">${metric("Blind model pick",m.blindModel)}${metric("Favourite baseline",m.favouriteBaseline)}${metric("Model + market agreement",m.modelMarketAgreement)}${metric("Hard evidence + shortening",m.hardEvidencePlusShortening)}</div>
 <div class="section-head"><div><h3>Race-by-race</h3></div></div><div class="table-wrap"><table><thead><tr><th>Race</th><th>Pick</th><th>Forecast</th><th>SP</th><th>Result</th><th>Market</th></tr></thead><tbody>${b.races.map(r=>`<tr><td>${r.race}</td><td class="horse">${r.pick}</td><td>${r.forecast}</td><td>${r.sp}</td><td><strong>${r.result}</strong></td><td>${r.marketAgreement?"Model + market agree":r.shortened?"Shortened":"Drifted"}</td></tr>`).join("")}</tbody></table></div>
 <div class="section-head"><div><h3>Confidence method V3</h3><p>Market prior + independent evidence, with VALUE handled separately.</p></div></div>
 <div class="source-grid"><div class="source-card"><h4>Accuracy lane</h4><ul>${v3.accuracyLane.map(x=>`<li>${x}</li>`).join("")}</ul></div><div class="source-card"><h4>Value lane</h4><ul>${v3.valueLane.map(x=>`<li>${x}</li>`).join("")}</ul></div></div>
 <div class="section-head"><div><h3>Before we call it calibrated</h3></div></div><div class="panel"><ol class="protocol-list">${v3.calibrationPlan.map(x=>`<li>${x}</li>`).join("")}</ol></div>`;
}
function sources(){return `<div class="section-head"><div><h3>Sources</h3><p>Live web research snapshot.</p></div></div><div class="source-grid">${state.data.sources.map(s=>`<div class="source-card"><h4>${s.name}</h4><p><strong>${s.status}</strong><br>${s.role}</p></div>`).join("")}</div>`}
function render(){const body=state.view==="today"?today():state.view==="system"?systemV4():state.view==="checks"?checks():state.view==="backtest"?backtest():sources();document.querySelector("#app").innerHTML=`<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-mark">R</div><div><h1>Racing Intelligence</h1><small>Daily GB + IRE selections</small></div></div><div class="nav">${nav()}</div></div></header><main class="main">${body}<div class="footer-note">System V4.1 Accuracy Mode: PRIME normally requires ≥55% calibrated probability, favourite status, ≥8pp model lead, ≥90% check coverage, race predictability ≥70 and all targeting safeguards. Historical strike rates are benchmarks, not guarantees.</div></main>`;bind()}
function bind(){document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()})}
load();