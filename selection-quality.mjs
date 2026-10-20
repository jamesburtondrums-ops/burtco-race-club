// Editorial WIN shortlisting: independent horse/race evidence, never the betting price.
// A credible contender may have manageable risks and one incompletely evidenced factor.
// Previous paper bets and historical judgements are never reclassified retroactively.
const coreFactors=['form','abilityClass','courseGoingTrip','opposition'];
const supportFactors=['fitness','trainerJockey'];
const isTime=t=>typeof t==='string'&&Number.isFinite(Date.parse(t))&&/(?:Z|[+-]\d{2}:\d{2})$/.test(t);
const isUrl=u=>typeof u==='string'&&/^https:\/\/[^\s/]+\.[^\s/]+/.test(u);
const textOf=v=>typeof v==='string'?v.trim():'';
const wellSupported=f=>f&&['strong','supported'].includes(f.grade)&&textOf(f.finding).length>=18&&isUrl(f.sourceUrl);
export function assessWinConfidence(pick){
 const review=pick?.winAssessment;
 const fail=reason=>({qualified:false,reason,level:'UNASSESSED'});
 if(!review||review.decision!=='win-contender')return fail('No current, reviewed WIN contender assessment');
 const publishedAt=pick.selectionPublishedAt||pick.earlyOddsLockedAt;
 if(!isTime(publishedAt)||!isTime(review.reviewedAt)||Date.parse(review.reviewedAt)>Date.parse(publishedAt))
   return fail('Review not documented before or at publication');
 if(!['low','moderate'].includes(review.riskSeverity)||!Array.isArray(review.riskNotes)||!review.riskNotes.length||review.riskNotes.some(r=>textOf(r).length<12))
   return fail('Insufficient downside review');
 if(review.hasCriticalUnknown===true||review.withdrawn===true)return fail('Critical risk or non-runner');
 const f=review.factors||{};
 // Present form and today's ground/surface/distance cannot be skipped.
 if(!wellSupported(f.form)||!wellSupported(f.courseGoingTrip))
   return fail('Current form or conditions unverified');
 const supportedCore=coreFactors.filter(k=>wellSupported(f[k]));
 if(supportedCore.length<3)return fail('Fewer than three of four core factors evidenced');
 if(!supportFactors.some(k=>wellSupported(f[k])))return fail('Neither fitness nor trainer/jockey support evidenced');
 const sources=[...coreFactors,...supportFactors].filter(k=>wellSupported(f[k])).map(k=>f[k].sourceUrl);
 if(new Set(sources.map(u=>(u.match(/^https:\/\/([^/]+)/)?.[1]||'').replace(/^www\./,''))).size<2)
   return fail('Independent evidence sources not established');
 const strong=supportedCore.filter(k=>f[k].grade==='strong').length;
 const level=strong>=3&&review.riskSeverity==='low'?'STRONG':'SOLID';
 return {qualified:true,level,reason:'Evidence-backed WIN contender with disclosed '+review.riskSeverity+' risks; not a calibrated prediction',coreSupported:supportedCore.length};
}
// Intended as user-facing editorial text, not an auto-generated certainty claim.
export function publicSummary(pick){
 const explicit=textOf(pick?.summary);
 if(explicit)return explicit;
 const original=textOf(pick?.reason);
 const sentence=original.match(/^.*?[.!?](?=\s|$)/)?.[0]||original;
 return sentence||'Awaiting a concise evidence-based summary.';
}
const concern=/\b(?:warning|caution|uncertain|unproven|risk|recheck|unknown|longshot|watch|price dependent|high stall|surface switch|class doubt)\b/i;
export function positivePoints(pick){
 const authored=Array.isArray(pick?.positivePoints)?pick.positivePoints:[];
 const source=authored.length?authored:(pick?.tags||[]).filter(t=>!concern.test(String(t)));
 return source.map(textOf).filter(x=>x&& !concern.test(x)).slice(0,4);
}


// Unified Bet Selections prospective gate (effective from 21 October 2026).
// This is an EVIDENCE-COMPLETENESS guard, NOT a verified predictive model.
// Only apply to yet-to-run prospective picks. Never remove published historical results.
export function assessUnifiedBetReadiness(pick){
 const fail=reason=>({qualified:false,reason});
 if(!pick||!textOf(pick.horse)||!textOf(pick.course)||!textOf(pick.time))
   return fail('Horse, course or off-time missing');
 if(!isTime(pick.selectionPublishedAt))return fail('Pre-publication timestamp missing');
 if(!isUrl(pick.sourceUrl))return fail('Source racecard URL missing');
 const field=Number(pick.runnerCount);
 if(!Number.isInteger(field)||field<2)return fail('Declared runner field not verified');
 const comparison=pick.oppositionReview;
 const threats=comparison?.threats;
 const required=Math.min(2,field-1);
 if(!comparison||comparison.allRunnersReviewed!==true||!isTime(comparison.reviewedAt)||
    Date.parse(comparison.reviewedAt)>Date.parse(pick.selectionPublishedAt)||
    !Array.isArray(threats)||threats.length<required||
    new Set(threats.map(t=>textOf(t.horse).toLowerCase())).size<required||
    threats.some(t=>!textOf(t.horse)||textOf(t.whyThreat).length<18||!isUrl(t.sourceUrl)))
   return fail('Missing pre-publication comparison of whole field and at least two sourced rival threats');
 if(/(?:hurdle|chase|steeple|national hunt)/i.test(String(pick.raceClass||''))){
   const jump=pick.disciplineReview;
   if(!jump||jump.checked!==true||!isTime(jump.reviewedAt)||
      Date.parse(jump.reviewedAt)>Date.parse(pick.selectionPublishedAt)||
      (jump.changeOfDiscipline===true&&jump.recentSameDisciplineEvidence!==true))
     return fail('Jump-race discipline/switch evidence incomplete');
 }
 if(pick.betType==='win'){
   const q=assessWinConfidence(pick);
   if(!q.qualified)return fail('WIN confidence gate: '+q.reason);
   if(!wellSupported(pick.winAssessment?.factors?.opposition))
      return fail('WIN candidate lacks current sourced rival-opposition comparison');
   if(pick.winRank==='NAP' &&
     (pick.winAssessment.riskSeverity!=='low'||
       pick.winAssessment.factors.courseGoingTrip.grade!=='strong'||
       pick.winAssessment.factors.opposition.grade!=='strong'))
     return fail('NAP requires LOW risk and strong conditions and opposition evidence');
   const p=String(pick.odds||'').match(/^(\\d+)\\s*\\/\\s*(\\d+)$/);
   if(p&&Number(p[2])>0&&Number(p[1])/Number(p[2])<1)
     return fail('WIN quote below evens, not eligible for published selection');
   return {qualified:true,reason:'Source-backed WIN selection and opposition review completed',level:q.level};
 }
 if(pick.betType==='each-way'){
   const e=pick.placeAssessment;
   if(!e||!isTime(e.reviewedAt)||Date.parse(e.reviewedAt)>Date.parse(pick.selectionPublishedAt)||
      !isUrl(e.sourceUrl)||e.recentCompetitiveForm!==true||
      e.todayConditionsSupported!==true||e.placeTermsReviewed!==true||
      !Number.isInteger(Number(e.paidPlaces))||Number(e.paidPlaces)<2)
     return fail('Each-way form, conditions, or bookmaker paid-place terms not confirmed');
   return {qualified:true,reason:'Sourced current form, whole-field threat review and each-way terms checked',level:'EACH WAY'};
 }
 return fail('Bet type must be WIN or EACH WAY');
}
