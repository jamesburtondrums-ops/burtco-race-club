// Racing Intelligence: decision to feature a horse as a high-confidence WIN selection.
// Horse/race evidence only: NO odds, favourite status, betting market rank, stakes,
// stake returns, or betting popularity may influence this gate.
const coreFactors=['form','abilityClass','courseGoingTrip','opposition'];
const supportFactors=['fitness','trainerJockey'];
const isTime=t=>typeof t==='string'&&Number.isFinite(Date.parse(t))&&/(?:Z|[+-]\d{2}:\d{2})$/.test(t);
const isUrl=u=>typeof u==='string'&&/^https:\/\/[^\s/]+\.[^\s/]+/.test(u);
const textOf=v=>typeof v==='string'?v.trim():'';
export function assessWinConfidence(pick){
 const review=pick?.winAssessment;
 const fail=reason=>({qualified:false,reason,level:'UNASSESSED'});
 if(!review||review.decision!=='high-confidence')return fail('No completed high-confidence evidence assessment');
 const publishedAt=pick.selectionPublishedAt||pick.earlyOddsLockedAt;
 if(!isTime(publishedAt)||!isTime(review.reviewedAt)||Date.parse(review.reviewedAt)>Date.parse(publishedAt))
  return fail('Evidence review was not frozen before the published selection');
 if((review.majorRisks||[]).length>0)return fail('Material unresolved concern recorded');
 for(const factorName of [...coreFactors,...supportFactors]){
  const factor=review.factors?.[factorName];
  if(!factor)return fail('Missing '+factorName+' evidence');
  const acceptable=coreFactors.includes(factorName)?factor.grade==='strong':['strong','supported'].includes(factor.grade);
  if(!acceptable)return fail('Insufficient '+factorName+' evidence');
  if(textOf(factor.finding).length<18||!isUrl(factor.sourceUrl)||!isTime(factor.checkedAt)||
    Date.parse(factor.checkedAt)>Date.parse(review.reviewedAt))
   return fail('Unverifiable or post-review '+factorName+' evidence');
 }
 return {qualified:true,reason:'Strong pre-publication evidence on ability, form, conditions and opposition with supported fitness and connections',level:'HIGH CONFIDENCE'};
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
