// Shadow-only audit, not loaded by public racing pages.
export function priorOnly(rows,date,observedBefore){
 return rows.filter(r=>r.date<date&&Date.parse(r.sourceCheckedAt)<Date.parse(observedBefore));
}
export function completeField(rows){
 const n=Number(rows[0]?.runnerCount);
 return Number.isInteger(n)&&n>=2&&rows.length===n&&
  new Set(rows.map(r=>String(r.horse).toLowerCase())).size===n&&
  rows.every(r=>Number(r.runnerCount)===n&&
   ['licensed','open-licensed','owner-supplied'].includes(r.sourceRights)&&
   r.permissionReference&&r.sourceUrl&&r.sourceCheckedAt&&
   (Number(r.finishingPosition)>0||/^(F|PU|UR|BD|RO|RR|DNF|DSQ)$/i.test(String(r.finishStatus||''))));
}
