// Separate, non-production completeness audit. Never infer fields from selected tips.
import {completeField} from './shadow-field-check.mjs';
export function countVerifiedFields(rows=[]){
 const groups=new Map();
 for(const r of rows){
  const id=[r.date,String(r.course||'').toLowerCase(),r.raceTime].join('|');
  if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(r);
 }
 let races=0,runners=0,comments=0;
 for(const field of groups.values())if(completeField(field)){
  races++;runners+=field.length;comments+=field.filter(r=>r.comment).length;
 }
 return {races,runners,comments,ready:races>=500&&runners>=2000&&comments>=1000};
}
