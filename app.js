const state={data:null,view:"today",filter:"ALL"};
const val=v=>v===undefined||v===null||v===""?"—":v;
const scoreOf=x=>{const c=x.scoreComponents||{};return Math.max(0,Math.min(100,(c.recentForm||0)+(c.ratings||0)+(c.conditions||0)+(c.handicap||0)+(c.courseTrip||0)+(c.connections||0)+(c.dataQuality||0)+(c.riskPenalty||0)))};
const primeOf=x=>{if(state.data?.scoringModel?.legacy)return false;const c=x.scoreComponents||{}, strong=[c.recentForm>=18,c.ratings>=18,c.conditions>=11,c.handicap>=11,c.courseTrip>=8,c.connections>=4].filter(Boolean).length;return scoreOf(x)>=82&&c.dataQuality===5&&strong>=4&&(c.riskPenalty||0)>=-6};
const starsOf=x=>{const s=scoreOf(x);return s>=76?5:s>=68?4:s>=58?3:s>=48?2:1};
const stars=n=>'<span class="stars">'+Array.from({length:5},(_,i)=>i<n?'★':'☆').join('')+'</span>';
async function load(){const r=await fetch("./data/races.json?"+Date.now());state.data=await r.json();render()}
function nav(){return [["today","Today"],["system","V4 System"],["checks","All checks"],["backtest","Backtest"],["sources","Sources"]].map(([v,t])=>`<button class="${state.view===v?"active":""}" data-view="${v}">${t}</button>`).join("")}
function filters(){const x=["ALL","PRIME","STRONG","VALUE","SPECULATIVE"];return `<div class="meeting-tabs">${x.map(f=>`<button data-filter="${f}" class="${state.filter===f?"active":""}">${f}</button>`).join("")}</div>`}
function card(x){
 const prime=primeOf(x); const winStars=starsOf(x);
 return `<article class="pick-card ${prime?"prime-card":""}">
   ${prime?'<div class="prime-banner">PRIME SELECTION · '+scoreOf(x)+'/100</div>':`<div class="win-confidence"><span>WIN CONFIDENCE · ${scoreOf(x)}/100</span>${stars(winStars)}</div>`}
   <div class="pick-head"><div><span class="tier ${x.tier.toLowerCase()}">${x.tier}</span><h3>${x.horse}</h3><p>${x.course} · ${x.time}</p></div><strong class="price">${val(x.odds)}</strong></div>
   <div class="rating-strip"><div><span>OR</span><b>${val(x.or)}</b></div><div><span>TS</span><b>${val(x.ts)}</b></div><div><span>RPR</span><b>${val(x.rpr)}</b></div></div>
   <div class="signal-list">${x.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
   <div class="pick-copy"><strong>Why it rates</strong><p>${x.reason}</p></div>
   <div class="pick-risk"><strong>Risk</strong><p>${x.risk}</p></div>
   <div class="score-breakdown"><strong>Score breakdown</strong><div class="score-grid">${state.data.scoringModel.components.map(c=>`<span>${c.label}</span><b>${x.scoreComponents?.[c.key]??0}/${c.max}</b>`).join("")}<span>Risk adjustment</span><b>${x.scoreComponents?.riskPenalty??0}</b></div><p class="meta">${x.scoreComponents?.notes||""}</p></div>
   <div class="source-line">Source: ${x.source}</div>
 </article>`
}
function today(){
 const d=state.data;
 const picks=d.todaySelections.filter(x=>state.filter==="ALL"||x.tier===state.filter);
 const primes=picks.filter(primeOf);
 const others=picks.filter(x=>!primeOf(x));
 return `${d.scoringModel?.legacy?'<div class="panel" style="border-left:4px solid #a88026"><strong>V4 RECHECK REQUIRED</strong><p class="meta" style="margin-top:5px">These selections pre-date System V4. They remain visible for reference, but PRIME is blocked until each race is freshly researched through the V4 probability, targeting, connection and market checks.</p></div>':''}<section class="hero"><div class="hero-main"><div class="eyebrow">8 OCTOBER 2026 · GB + IRE</div><h2>Today's win selections, separated by confidence and value.</h2><p>PRIME is reserved for the strongest complete win profiles. Every other pick carries a star score for win confidence, independent of whether the price represents value.</p></div>
 <div class="status-panel"><div class="status-row"><span>Meetings scanned</span><strong>${d.coverage.meetings}</strong></div><div class="status-row"><span>Races scanned</span><strong>${d.coverage.races}</strong></div><div class="status-row"><span>Selections</span><strong>${d.todaySelections.length}</strong></div><div class="status-row"><span>PRIME picks</span><strong>${d.todaySelections.filter(primeOf).length}</strong></div></div></section>
 ${filters()}
 ${primes.length?`<div class="section-head prime-section-title"><div><h3>PRIME</h3><p>Highest-conviction win profiles.</p></div></div><div class="prime-grid">${primes.map(card).join("")}</div>`:""}
 ${others.length?`<div class="section-head"><div><h3>Other selections</h3><p>Stars represent confidence in the data for win purposes — not value.</p></div></div><div class="pick-grid">${others.map(card).join("")}</div>`:""}
 `;
}
function systemV4(){
 const s=state.data.systemV4;
 const gradeRows=[s.grades.PRIME,s.grades.five,s.grades.four,s.grades.three,s.grades.two,s.grades.one];
 return `<section class="hero"><div class="hero-main"><div class="eyebrow">SYSTEM V4.0 · 10,000-RACE BACKTEST</div><h2>Confidence is now a calibrated win probability, not a subjective points score.</h2><p>The system combines the market with independent form, placement and connection evidence, then applies hard safeguards before promoting a horse.</p></div><div class="status-panel"><div class="status-row"><span>Historical races</span><strong>${s.backtest.races.toLocaleString()}</strong></div><div class="status-row"><span>Unseen test races</span><strong>${s.backtest.unseenTestRaces.toLocaleString()}</strong></div><div class="status-row"><span>Clean market races</span><strong>${s.backtest.validMarketTestRaces.toLocaleString()}</strong></div><div class="status-row"><span>PRIME test win rate</span><strong>${s.backtest.prime50.strikeRate}%</strong></div></div></section>
 <div class="section-head"><div><h3>Confidence ladder</h3><p>Observed historical calibration is shown beside each rule.</p></div></div>
 <div class="panel grading-panel">
   <div class="grade-rule prime-rule"><b>PRIME</b><span>${s.grades.PRIME.rule}<br><small>${s.grades.PRIME.observed}</small></span></div>
   <div class="grade-rule"><b>★★★★★</b><span>${s.grades.five.rule}<br><small>${s.grades.five.observed}</small></span></div>
   <div class="grade-rule"><b>★★★★☆</b><span>${s.grades.four.rule}<br><small>${s.grades.four.observed}</small></span></div>
   <div class="grade-rule"><b>★★★☆☆</b><span>${s.grades.three.rule}<br><small>${s.grades.three.observed}</small></span></div>
   <div class="grade-rule"><b>★★☆☆☆</b><span>${s.grades.two.rule}<br><small>${s.grades.two.observed}</small></span></div>
   <div class="grade-rule"><b>★☆☆☆☆</b><span>${s.grades.one.rule}</span></div>
 </div>
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
function render(){const body=state.view==="today"?today():state.view==="system"?systemV4():state.view==="checks"?checks():state.view==="backtest"?backtest():sources();document.querySelector("#app").innerHTML=`<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-mark">R</div><div><h1>Racing Intelligence</h1><small>Daily GB + IRE selections</small></div></div><div class="nav">${nav()}</div></div></header><main class="main">${body}<div class="footer-note">System V4: PRIME requires a calibrated fused win probability of at least 50%, market top-two status, complete targeting/connection checks and no major red flag. Historical strike rates are descriptive backtest results, not guarantees.</div></main>`;bind()}
function bind(){document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()})}
load();