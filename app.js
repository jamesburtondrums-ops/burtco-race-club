const state={data:null,view:"today",filter:"ALL"};
const val=v=>v===undefined||v===null||v===""?"—":v;
const contextOf=x=>x.v42||x.v41||null;
const probabilityOf=x=>contextOf(x)?.winProbability??null;
const primeOf=x=>contextOf(x)?.isPrime===true;
const starsOf=x=>contextOf(x)?.stars??0;
const confidenceLabel=x=>primeOf(x)?"PRIME":starsOf(x)?Array.from({length:5},(_,i)=>i<starsOf(x)?"★":"☆").join(""):"WATCH";
const stars=n=>'<span class="stars">'+Array.from({length:5},(_,i)=>i<n?'★':'☆').join('')+'</span>';
async function load(){const r=await fetch("./data/races.json?"+Date.now());state.data=await r.json();render()}
function nav(){return [["today","Today"],["longshots","Longshots 20/1+"],["sources","Sources"]].map(([v,t])=>`<button class="${state.view===v?"active":""}" data-view="${v}">${t}</button>`).join("")}
function filters(){const x=["ALL","PRIME","★★★★★","★★★★☆","★★★☆☆","WATCH"];return `<div class="meeting-tabs">${x.map(f=>`<button data-filter="${f}" class="${state.filter===f?"active":""}">${f}</button>`).join("")}</div>`}
function card(x){
 const prime=primeOf(x), winStars=starsOf(x), p=probabilityOf(x), q=contextOf(x), label=confidenceLabel(x);
 const legacy=!q;
 return `<article class="pick-card ${prime?"prime-card":legacy?"legacy-card":""}">
   ${prime?'<div class="prime-banner">PRIME · '+p.toFixed(1)+'% WIN PROBABILITY</div>':legacy?'<div class="recheck-banner">V4.2 CONTEXT RECHECK</div>':`<div class="win-confidence"><span>${p.toFixed(1)}% WIN PROBABILITY</span>${stars(winStars)}</div>`}
   <div class="pick-head"><div><span class="tier ${prime?"prime":legacy?"watch":"confidence"}">${prime?"PRIME":legacy?"RECHECK":label}</span><h3>${x.horse}</h3><p>${x.course} · ${x.time}</p></div><strong class="price">${val(x.odds)}</strong></div>
   ${q?`<div class="v41-grid"><div><span>Market rank</span><b>#${val(q.marketRank)}</b></div><div><span>Check coverage</span><b>${val(q.criticalCoverage)}%</b></div><div><span>Race predictability</span><b>${val(q.racePredictability)}/100</b></div><div><span>Price view</span><b>${val(q.priceLabel||"PRICE WATCH")}</b></div></div>`:""}
   <div class="rating-strip"><div><span>OR</span><b>${val(x.or)}</b></div><div><span>TS</span><b>${val(x.ts)}</b></div><div><span>RPR</span><b>${val(x.rpr)}</b></div></div>
   <div class="signal-list">${(x.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
   <div class="pick-copy"><strong>Decision</strong><p>${legacy?"This horse has not yet been rerun through the live V4.2 Context Model.":x.reason}</p></div>
   ${q&&q.contextSummary?`<div class="context-summary"><strong>Context verdict</strong><p>${q.contextSummary}</p></div>`:""}
   ${q&&q.contextFactors?`<div class="factor-grid">${q.contextFactors.map(f=>`<div class="factor-row"><span>${f.name}</span><b class="factor-status">${f.status}</b><small>${f.detail}</small></div>`).join("")}</div>`:""}
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
 return `${d.scoringModel?.legacy?'<div class="panel" style="border-left:4px solid #a88026"><strong>V4.2 CONTEXT RECHECK</strong><p class="meta" style="margin-top:5px">These cards pre-date V4.1 Accuracy Mode. Their previous PRIME/stars are suppressed. A fresh grade now requires calibrated probability, favourite status, model dominance, race predictability, aiming/connection checks and late-market confirmation.</p></div>':''}<section class="hero"><div class="hero-main"><div class="eyebrow">8 OCTOBER 2026 · GB + IRE</div><h2>Today's strongest remaining selections.</h2><p>PRIME highlights the strongest overall win cases. The remaining stars show relative win confidence from the available evidence.</p></div>
 <div class="status-panel"><div class="status-row"><span>Meetings scanned</span><strong>${d.coverage.meetings}</strong></div><div class="status-row"><span>Races scanned</span><strong>${d.coverage.races}</strong></div><div class="status-row"><span>Selections rechecked</span><strong>${d.todaySelections.length}</strong></div><div class="status-row"><span>PRIME picks</span><strong>${d.todaySelections.filter(primeOf).length}</strong></div></div></section>
 ${filters()}
 ${primes.length?`<div class="section-head prime-section-title"><div><h3>PRIME</h3><p>Highest-conviction win profiles.</p></div></div><div class="prime-grid">${primes.map(card).join("")}</div>`:""}
 ${others.length?`<div class="section-head"><div><h3>Other selections</h3><p>Stars represent confidence in the data for win purposes — not value.</p></div></div><div class="pick-grid">${others.map(card).join("")}</div>`:""}
 `;
}
function systemV4(){
 const s=state.data.systemV4;
 const gradeRows=[s.grades.PRIME,s.grades.five,s.grades.four,s.grades.three,s.grades.two,s.grades.one];
 return `<section class="hero"><div class="hero-main"><div class="eyebrow">SYSTEM V4.2 CONTEXT MODEL · 10,000-RACE BACKTEST</div><h2>Context now refines probability instead of blocking good selections with rigid rules.</h2><p>The model combines ability and market probability with class/grade/value placement, trainer context, stable run-to-form, horse-jockey partnership, pace, going and targeting.</p></div><div class="status-panel"><div class="status-row"><span>Historical races</span><strong>${s.backtest.races.toLocaleString()}</strong></div><div class="status-row"><span>Unseen test races</span><strong>${s.backtest.unseenTestRaces.toLocaleString()}</strong></div><div class="status-row"><span>Clean market races</span><strong>${s.backtest.validMarketTestRaces.toLocaleString()}</strong></div><div class="status-row"><span>55% gate benchmark</span><strong>${s.backtest.prime55.strikeRate}%</strong></div></div></section>
 <div class="section-head"><div><h3>Confidence ladder</h3><p>Observed historical calibration is shown beside each rule.</p></div></div>
 <div class="panel grading-panel">
   <div class="grade-rule prime-rule"><b>PRIME</b><span>${s.grades.PRIME.rule}<br><small>${s.grades.PRIME.observed}</small></span></div>
   <div class="grade-rule"><b>★★★★★</b><span>${s.grades.five.rule}<br><small>${s.grades.five.observed}</small></span></div>
   <div class="grade-rule"><b>★★★★☆</b><span>${s.grades.four.rule}<br><small>${s.grades.four.observed}</small></span></div>
   <div class="grade-rule"><b>★★★☆☆</b><span>${s.grades.three.rule}<br><small>${s.grades.three.observed}</small></span></div>
   <div class="grade-rule"><b>★★☆☆☆</b><span>${s.grades.two.rule}<br><small>${s.grades.two.observed}</small></span></div>
   <div class="grade-rule"><b>★☆☆☆☆</b><span>${s.grades.one.rule}</span></div>
 </div>
 <div class="section-head"><div><h3>Dynamic PRIME routes</h3><p>V4.2 changes the threshold only where the historical test supports it.</p></div></div>
 <div class="panel decision-gates">
   <div><b>General</b><span>Favourite at ≥55% model probability. Historical unseen benchmark: 72.0% winners.</span></div>
   <div><b>Maiden / Novice</b><span>Favourite at ≥50% when unexposed and pedigree/context checks are complete. Benchmark: 71.4%.</span></div>
   <div><b>Course + Class</b><span>At ≥55%, a trainer ≥15% at this course in this class lifted the historical win rate to 78.3%.</span></div>
   <div><b>Course + Grade</b><span>At ≥55%, a trainer ≥15% at this course in this grade produced 74.0% winners.</span></div>
   <div><b>Nursery / Hurdle</b><span>Use greater caution; normally seek ~60% or unusually strong contextual agreement.</span></div>
   <div><b>No hard lead rule</b><span>Model lead, pace, aiming counts and draw now influence probability rather than automatically blocking a selection.</span></div>
 </div>
 <div class="section-head"><div><h3>Race-type rules</h3></div></div>
 <div class="source-grid">${Object.entries(s.accuracyMode.raceTypeRules).map(([k,v])=>`<div class="source-card"><h4>${k.toUpperCase()}</h4><p>${v}</p></div>`).join("")}</div>
 <div class="section-head"><div><h3>Evidence groups</h3><p>Independent evidence is more important than stacking correlated statistics.</p></div></div>
 <div class="panel check-list">${(s.contextModel?.factors||[]).map(g=>`<div class="check-group"><div class="check-title"><b>${g}</b><strong>V4.2 INPUT</strong></div></div>`).join("")}</div>
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
 const s=state.data.systemV4, rules=s.contextModel?.liveRules||{};
 return `<section class="hero"><div class="hero-main"><div class="eyebrow">V4.2 FULL RACE CHECK</div><h2>Every selection is built from race context, not a single ratings number.</h2><p>Class, grade and prize value are checked separately, alongside trainer placement, partnership, pace, conditions, handicap position and the live market.</p></div><div class="status-panel"><div class="status-row"><span>Historical races</span><strong>${s.backtest.races.toLocaleString()}</strong></div><div class="status-row"><span>Context factors</span><strong>${s.contextModel.factors.length}</strong></div><div class="status-row"><span>55% benchmark</span><strong>${s.backtest.prime55.strikeRate}%</strong></div></div></section>
 <div class="section-head"><div><h3>Factors checked on every relevant runner</h3></div></div>
 <div class="panel check-list">${s.contextModel.factors.map((x,i)=>`<div class="check-group"><div class="check-title"><b>${x}</b><strong>${String(i+1).padStart(2,"0")}</strong></div></div>`).join("")}</div>
 <div class="section-head"><div><h3>How the context is interpreted</h3></div></div>
 <div class="source-grid">${Object.entries(rules).map(([k,v])=>`<div class="source-card"><h4>${k.replace(/([A-Z])/g," $1").toUpperCase()}</h4><p>${v}</p></div>`).join("")}</div>
 <div class="section-head"><div><h3>Best validated interactions</h3><p>These are supporting context, not automatic bets.</p></div></div>
 <div class="table-wrap"><table><thead><tr><th>Factor</th><th>Condition</th><th>Sample</th><th>Winners</th><th>Strike</th></tr></thead><tbody>${(s.contextModel.latestInteractionAudit||[]).map(x=>`<tr><td class="horse">${x.factor}</td><td>${x.condition}</td><td>${x.races}</td><td>${x.wins}</td><td><strong>${x.strikeRate}%</strong></td></tr>`).join("")}</tbody></table></div>
 <div class="section-head"><div><h3>Hard blocks</h3></div></div><div class="panel"><ul class="protocol-list">${s.hardBlocks.map(x=>`<li>${x}</li>`).join("")}</ul></div>`;
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
function longshots(){
 const d=state.data, ls=d.longshotsToday||[];
 return `<section class="hero longshot-hero"><div class="hero-main"><div class="eyebrow">20/1+ EACH-WAY RADAR</div><h2>Big-price runners with a credible route into the places.</h2><p>${d.longshotsPolicy.publicNote}</p></div><div class="status-panel"><div class="status-row"><span>Minimum price</span><strong>${d.longshotsPolicy.minOdds}</strong></div><div class="status-row"><span>Candidates</span><strong>${ls.length}</strong></div><div class="status-row"><span>Updated</span><strong>13:48 BST</strong></div></div></section>
 <div class="longshot-note">${d.longshotsPolicy.priceRule}</div>
 <div class="pick-grid">${ls.map(x=>`<article class="pick-card longshot-card">
   <div class="longshot-banner"><span>E/W APPEAL</span>${stars(x.ewStars)}</div>
   <div class="pick-head"><div><span class="tier value">20/1+</span><h3>${x.horse}</h3><p>${x.course} · ${x.time}</p></div><strong class="price">${x.odds}</strong></div>
   <div class="ew-view"><strong>${x.placeView}</strong><small>${x.terms}</small></div>
   <div class="signal-list">${(x.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
   <div class="pick-copy"><strong>Why it can outrun the price</strong><p>${x.reason}</p></div>
   <div class="pick-risk"><strong>Risk</strong><p>${x.risk}</p></div>
   <div class="source-line">Source: ${x.source}</div>
 </article>`).join("")}</div>`;
}
function sources(){return `<div class="section-head"><div><h3>Sources</h3><p>Live web research snapshot.</p></div></div><div class="source-grid">${state.data.sources.map(s=>`<div class="source-card"><h4>${s.name}</h4><p><strong>${s.status}</strong><br>${s.role}</p></div>`).join("")}</div>`}
function render(){const body=state.view==="today"?today():state.view==="longshots"?longshots():sources();document.querySelector("#app").innerHTML=`<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-mark">R</div><div><h1>Racing Intelligence</h1><small>Daily GB + IRE selections</small></div></div><div class="nav">${nav()}</div></div></header><main class="main">${body}<div class="footer-note">Selections are evidence-based estimates, not guarantees. Longshots only qualify at 20/1 or bigger and are assessed primarily for each-way/place appeal.</div></main>`;bind()}
function bind(){document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()})}
load();