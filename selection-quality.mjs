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
