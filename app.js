const state={data:null,view:"today",filter:"ALL"};
const val=v=>v===undefined||v===null||v===""?"—":v;
const stars=n=>n?'<span class="stars">'+Array.from({length:5},(_,i)=>i<n?'★':'☆').join('')+'</span>':'';
async function load(){const r=await fetch("./data/races.json?"+Date.now());state.data=await r.json();render()}
function nav(){return [["today","Today"],["grading","Grading"],["sources","Sources"]].map(([v,t])=>`<button class="${state.view===v?"active":""}" data-view="${v}">${t}</button>`).join("")}
function filters(){const x=["ALL","PRIME","STRONG","VALUE","SPECULATIVE"];return `<div class="meeting-tabs">${x.map(f=>`<button data-filter="${f}" class="${state.filter===f?"active":""}">${f}</button>`).join("")}</div>`}
function card(x){
 const prime=x.tier==="PRIME";
 return `<article class="pick-card ${prime?"prime-card":""}">
   ${prime?'<div class="prime-banner">PRIME SELECTION</div>':`<div class="win-confidence"><span>WIN CONFIDENCE</span>${stars(x.winStars)}</div>`}
   <div class="pick-head"><div><span class="tier ${x.tier.toLowerCase()}">${x.tier}</span><h3>${x.horse}</h3><p>${x.course} · ${x.time}</p></div><strong class="price">${val(x.odds)}</strong></div>
   <div class="rating-strip"><div><span>OR</span><b>${val(x.or)}</b></div><div><span>TS</span><b>${val(x.ts)}</b></div><div><span>RPR</span><b>${val(x.rpr)}</b></div></div>
   <div class="signal-list">${x.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
   <div class="pick-copy"><strong>Why it rates</strong><p>${x.reason}</p></div>
   <div class="pick-risk"><strong>Risk</strong><p>${x.risk}</p></div>
   <div class="source-line">Source: ${x.source}</div>
 </article>`
}
function today(){
 const d=state.data;
 const picks=d.todaySelections.filter(x=>state.filter==="ALL"||x.tier===state.filter);
 const primes=picks.filter(x=>x.tier==="PRIME");
 const others=picks.filter(x=>x.tier!=="PRIME");
 return `<section class="hero"><div class="hero-main"><div class="eyebrow">8 OCTOBER 2026 · GB + IRE</div><h2>Today's win selections, separated by confidence and value.</h2><p>PRIME is reserved for the strongest complete win profiles. Every other pick carries a star score for win confidence, independent of whether the price represents value.</p></div>
 <div class="status-panel"><div class="status-row"><span>Meetings scanned</span><strong>${d.coverage.meetings}</strong></div><div class="status-row"><span>Races scanned</span><strong>${d.coverage.races}</strong></div><div class="status-row"><span>Selections</span><strong>${d.todaySelections.length}</strong></div><div class="status-row"><span>PRIME picks</span><strong>${d.todaySelections.filter(x=>x.tier==="PRIME").length}</strong></div></div></section>
 ${filters()}
 ${primes.length?`<div class="section-head prime-section-title"><div><h3>PRIME</h3><p>Highest-conviction win profiles.</p></div></div><div class="prime-grid">${primes.map(card).join("")}</div>`:""}
 ${others.length?`<div class="section-head"><div><h3>Other selections</h3><p>Stars represent confidence in the data for win purposes — not value.</p></div></div><div class="pick-grid">${others.map(card).join("")}</div>`:""}
 `;
}
function grading(){
 const g=state.data.gradingSystem;
 return `<div class="section-head"><div><h3>Grading system</h3><p>Chance and price are deliberately separated.</p></div></div>
 <div class="panel grading-panel"><div class="grade-rule prime-rule"><b>PRIME</b><span>${g.PRIME}</span></div><div class="grade-rule"><b>STRONG</b><span>${g.STRONG}</span></div><div class="grade-rule"><b>VALUE</b><span>${g.VALUE}</span></div><div class="grade-rule"><b>SPECULATIVE</b><span>${g.SPECULATIVE}</span></div><div class="grade-rule"><b>WATCH</b><span>${g.WATCH}</span></div></div>
 <div class="section-head"><div><h3>Win-confidence stars</h3></div></div><div class="panel"><div class="star-legend"><b>★★★★★</b><span>Very strong win evidence</span><b>★★★★☆</b><span>Strong win evidence</span><b>★★★☆☆</b><span>Credible win chance</span><b>★★☆☆☆</b><span>Possible, material doubts</span><b>★☆☆☆☆</b><span>Watch only</span></div></div>`;
}
function sources(){return `<div class="section-head"><div><h3>Sources</h3><p>Live web research snapshot.</p></div></div><div class="source-grid">${state.data.sources.map(s=>`<div class="source-card"><h4>${s.name}</h4><p><strong>${s.status}</strong><br>${s.role}</p></div>`).join("")}</div>`}
function render(){const body=state.view==="today"?today():state.view==="grading"?grading():sources();document.querySelector("#app").innerHTML=`<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-mark">R</div><div><h1>Racing Intelligence</h1><small>Daily GB + IRE selections</small></div></div><div class="nav">${nav()}</div></div></header><main class="main">${body}<div class="footer-note">OR = official rating. TS = Topspeed. RPR = Racing Post Rating. Ratings and prices are evidence inputs, not guarantees. Price snapshots may move.</div></main>`;bind()}
function bind(){document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()})}
load();