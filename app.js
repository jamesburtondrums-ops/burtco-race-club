const state={data:null,view:"today",filter:"ALL"};
const val=v=>v===undefined||v===null||v===""?"—":v;
const contextOf=x=>x.v42||x.v41||null;
const probabilityOf=x=>contextOf(x)?.winProbability??null;
const primeOf=x=>contextOf(x)?.isPrime===true;
const starsOf=x=>contextOf(x)?.stars??0;
const confidenceLabel=x=>primeOf(x)?"PRIME":starsOf(x)?Array.from({length:5},(_,i)=>i<starsOf(x)?"★":"☆").join(""):"WATCH";
const stars=n=>'<span class="stars">'+Array.from({length:5},(_,i)=>i<n?'★':'☆').join('')+'</span>';
async function load(){const r=await fetch("./data/races.json?"+Date.now());state.data=await r.json();render()}
function nav(){return [["today","Today"],["midshots","Mid Shots 10/1–18/1"],["longshots","Longshots 20/1+"],["sources","Sources"]].map(([v,t])=>`<button class="${state.view===v?"active":""}" data-view="${v}">${t}</button>`).join("")}
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
function midshots(){
 const d=state.data, ms=d.midshotsToday||[];
 return `<section class="hero midshot-hero"><div class="hero-main"><div class="eyebrow">10/1–18/1 WIN + E/W RADAR</div><h2>Mid-price runners with a genuine route to winning.</h2><p>${d.midshotsPolicy.publicNote}</p></div><div class="status-panel"><div class="status-row"><span>Price band</span><strong>10/1–18/1</strong></div><div class="status-row"><span>Candidates</span><strong>${ms.length}</strong></div><div class="status-row"><span>Updated</span><strong>14:04 BST</strong></div></div></section>
 <div class="midshot-note">${d.midshotsPolicy.priceRule}</div>
 <div class="pick-grid">${ms.map(x=>`<article class="pick-card midshot-card">
   <div class="midshot-banner"><span>MID-SHOT APPEAL</span>${stars(x.midStars)}</div>
   <div class="pick-head"><div><span class="tier strong">10/1–18/1</span><h3>${x.horse}</h3><p>${x.course} · ${x.time}</p></div><strong class="price">${x.odds}</strong></div>
   <div class="ew-view"><strong>${x.view}</strong><small>${x.terms}</small></div>
   <div class="signal-list">${(x.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
   <div class="pick-copy"><strong>Why it can win / place</strong><p>${x.reason}</p></div>
   <div class="pick-risk"><strong>Risk</strong><p>${x.risk}</p></div>
   <div class="source-line">Source: ${x.source}</div>
 </article>`).join("")}</div>`;
}
function longshots(){
 const d=state.data, ls=d.longshotsToday||[];
 return `<section class="hero longshot-hero"><div class="hero-main"><div class="eyebrow">20/1+ EACH-WAY RADAR</div><h2>Big-price runners with a credible route into the places.</h2><p>${d.longshotsPolicy.publicNote}</p></div><div class="status-panel"><div class="status-row"><span>Minimum price</span><strong>${d.longshotsPolicy.minOdds}</strong></div><div class="status-row"><span>Candidates</span><strong>${ls.length}</strong></div><div class="status-row"><span>Updated</span><strong>14:04 BST</strong></div></div></section>
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
function render(){const body=state.view==="today"?today():state.view==="midshots"?midshots():state.view==="longshots"?longshots():sources();document.querySelector("#app").innerHTML=`<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-mark">R</div><div><h1>Racing Intelligence</h1><small>Daily GB + IRE selections</small></div></div><div class="nav">${nav()}</div></div></header><main class="main">${body}<div class="footer-note">Selections are evidence-based estimates, not guarantees. Longshots only qualify at 20/1 or bigger and are assessed primarily for each-way/place appeal.</div></main>`;bind()}
function bind(){document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()})}
load();