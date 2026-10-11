// Research-only comparison of publicly attributed editorials with primary horse evidence.
// Source time must precede the forecasted race, not the analysis date.
// Missing source coverage is always UNKNOWN, never a negative selection signal.
const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const validTime=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d/.test(x)&&Number.isFinite(Date.parse(x));
const observationKinds=new Set(['factual-statistic','editorial-opinion','trainer-quote','market-comment']);
const stances=new Set(['positive','negative','neutral']);
export function auditThirdPartyNote(note,providers,cutoffUtc){
 if(!note||!providers[note.providerId])return {ok:false,reason:'Unknown provider'};
 if(!note.horse||!note.course||!note.raceDate||!note.raceTime)return {ok:false,reason:'Horse, course, date and time required'};
 if(!/^20\d\d-\d\d-\d\d$/.test(note.raceDate)||!/^\d\d:\d\d$/.test(note.raceTime))return {ok:false,reason:'Invalid race date/time'};
 if(!observationKinds.has(note.kind)||!stances.has(note.stance))return {ok:false,reason:'Invalid evidence kind or stance'};
 if(!note.factor||!note.finding||String(note.finding).length>700)return {ok:false,reason:'Short independent finding and factor required'};
 if(!/^https:\/\//i.test(String(note.sourceUrl||'')))return {ok:false,reason:'Attributable HTTPS source URL required'};
 let host;try{host=new URL(note.sourceUrl).hostname.replace(/^www\./,'').toLowerCase()}catch{return {ok:false,reason:'Invalid provider URL'}};
 const allowed={olbg:['olbg.com'],myracing:['myracing.com'],'winners-enclosure':['thewinnersenclosure.com']};
 if(!allowed[note.providerId]?.some(h=>host===h||host.endsWith('.'+h)))return {ok:false,reason:'URL must be on stated provider domain'};
 if(!validTime(note.publishedAt)||!validTime(note.observedAt))return {ok:false,reason:'Source publication and observation time required'};
 const publication=Date.parse(note.publishedAt),seen=Date.parse(note.observedAt);
 if(publication>seen)return {ok:false,reason:'Source published after it was supposedly reviewed'};
 if(!validTime(cutoffUtc))return {ok:false,reason:'No independently timestamped target-race cutoff; cannot establish pre-race evidence'};
 const deadline=Date.parse(cutoffUtc);
 if(publication>=deadline||seen>=deadline)return {ok:false,reason:'Source published or reviewed after the race started'};
 return {ok:true};
}
export function compareThirdPartyResearch({raceDate,horse,course,time,startUtc,notes=[],providers={}}={}){
 const matches=(notes||[]).filter(x=>norm(x.horse)===norm(horse)&&norm(x.course)===norm(course)&&x.raceDate===raceDate&&x.raceTime===time);
 const observations=[],unusable=[];
 for(const note of matches){
  const check=auditThirdPartyNote(note,providers,startUtc);
  if(check.ok)observations.push({providerId:note.providerId,provider:providers[note.providerId].name,kind:note.kind,
   stance:note.stance,factor:note.factor,finding:note.finding,sourceUrl:note.sourceUrl,
   publishedAt:note.publishedAt,observedAt:note.observedAt});
  else unusable.push({providerId:note.providerId||'unknown',reason:check.reason});
 }
 const sourceCount=new Set(observations.map(n=>n.providerId)).size;
 const opinions=observations.filter(n=>n.kind==='editorial-opinion');
 const endorsers=new Set(opinions.filter(n=>n.stance==='positive').map(x=>x.providerId));
 const challengers=new Set(opinions.filter(n=>n.stance==='negative').map(x=>x.providerId));
 return {horse,course,time,sourceCount,observations,unusable,positiveEditorialSources:endorsers.size,
  negativeEditorialSources:challengers.size,
  status:observations.length?'attributed pre-race reference findings':'not independently verified',
  conclusion:sourceCount<2?'No multi-source comparison yet; missing sources are neutral':
   endorsers.size&&challengers.size?'Conflicting published editorial views; inspect evidence, do not average opinions':
   'Multiple independent publisher records; no automatic win-probability adjustment',
  limits:'Source-specific tips can be copied or correlated; editorial agreement is not calibrated probability. Official results, handicap ratings and permissioned sectionals are primary evidence.'};
}
export function thirdPartyReport(racecard,notes=[],config={}){
 const providers=config.providers||{},date=racecard?.snapshotDate;
 const selected=['todaySelections','midshotsToday','longshotsToday'].flatMap(k=>racecard?.[k]||[]);
 return {sources:Object.values(providers).map(x=>({name:x.name,url:x.url,kind:x.kind,areas:x.areas,rules:x.rules})),
  coverage:selected.map(x=>compareThirdPartyResearch({raceDate:date,horse:x.horse,course:x.course,time:x.time,startUtc:x.raceStartUtc,notes,providers})),
  raceDate:date,enabledAutomation:false,notesStored:(notes||[]).length,
  status:'Manual attributed third-party analysis available; no live source API connected',
  methodology:'Require before-the-off publication and observation timestamps plus source URL. No fabricated expert consensus, no unauthorised extraction, no inference of private trainer intent.'};
}
