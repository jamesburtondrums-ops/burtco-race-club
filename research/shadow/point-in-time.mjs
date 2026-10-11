// Shadow research only: do not import into published tips or paper settlement.
const instant=s=>typeof s==='string'&&s.includes('T')&&/(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s));
const https=s=>typeof s==='string'&&/^https:\/\/[^/\s]+/.test(s);
export function asOfEligibility(row,{predictionAt,targetRaceId}={}){
 if(!row||typeof row!=='object')return {eligible:false,reasons:['invalid-row']};
 const reasons=[];
 if(!instant(predictionAt))reasons.push('invalid-prediction-time');
 if(row.permissionVerified!==true||row.sourceRightsStatus!=='licensed-feature'||!row.sourceLicenseId)reasons.push('rights-not-cleared');
 if(row.featureEligible!==true)reasons.push('feature-not-authorised');
 if(!https(row.sourceUrl))reasons.push('source-missing');
 for(const field of ['raceOffAt','observedAt','sourcePublishedAt']){
  if(!instant(row[field]))reasons.push('unknown-'+field);
  else if(instant(predictionAt)&&Date.parse(row[field])>=Date.parse(predictionAt))reasons.push('leak-'+field);
 }
 if(row.raceId&&targetRaceId&&row.raceId===targetRaceId)reasons.push('same-race');
 return {eligible:reasons.length===0,reasons};
}
export function validateReviewManifest(m){
 if(!m||typeof m!=='object')return {valid:false,errors:['invalid-review']};
 const errors=[],races=m.raceReviews||[],notes=m.namedNotes||[],ids=new Set(races.map(x=>x.raceId));
 if(!instant(m.observedAt))errors.push('observedAt');
 if(m.sourceRights?.status!=='review-only'||m.sourceRights?.permissionVerified!==false||m.sourceRights?.modelFeatureUseAllowed!==false)errors.push('rights');
 if(ids.size!==races.length)errors.push('duplicate-race');
 for(const r of races)if(!https(r.resultSourceUrl)||!https(r.stewardsSourceUrl)||!Number.isInteger(r.starters)||r.starters<1||!instant(r.observedAt))errors.push('invalid-race');
 for(const n of notes)if(!ids.has(n.raceId)||!https(n.sourceUrl)||!instant(n.observedAt)||n.permissionVerified!==false||n.sourceRightsStatus!=='review-only'||n.featureEligible!==false)errors.push('invalid-note');
 if(m.counts?.distinctRaceReviews!==races.length||m.counts?.startersInReviewedRaces!==races.reduce((s,r)=>s+r.starters,0)||m.counts?.distinctNamedNotes!==notes.length)errors.push('count-mismatch');
 return {valid:errors.length===0,errors};
}
