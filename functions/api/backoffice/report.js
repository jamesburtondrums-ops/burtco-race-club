import history from '../../_private/backoffice-history.json';
import researchHistory from '../../_private/racing-research-journal.json';
import historicalRuns from '../../_private/racing-historical-runs.json';
import trackProfiles from '../../_private/racing-track-profiles.json';
import {isAuthed,reply} from '../../_lib/backoffice-auth.mjs';
import {dailyReports,tuningNotes} from '../../_lib/backoffice-stats.mjs';
import {researchCoverage,chronologicalAssessment,historicalPriceAudit} from '../../_lib/race-research.mjs';

export async function onRequestGet({request,env}){
 if(!await isAuthed(request,env))return reply({ok:false,error:'PIN authentication required'},401);
 try{
  const base=new URL(request.url).origin;
  const [ledgerRes,raceRes]=await Promise.all([
   env.ASSETS.fetch(new Request(base+'/data/bet-ledger.json',{cache:'no-store'})),
   env.ASSETS.fetch(new Request(base+'/data/races.json',{cache:'no-store'}))
  ]);
  if(!ledgerRes.ok||!raceRes.ok)throw Error('Published ledger temporarily unavailable');
  const [ledger,race]=await Promise.all([ledgerRes.json(),raceRes.json()]);
  const computed=dailyReports(ledger);
  const known=new Map(computed.map(d=>[d.date,d]));
  // Historical captured snapshots survive daily racecard turnover.
  for(const day of history.days||[])if(!known.has(day.date))known.set(day.date,day);
  const days=[...known.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const tuning=new Map((history.tuningLog||[]).map(e=>[e.key,e]));
  for(const entry of tuningNotes(race))if(!tuning.has(entry.key))tuning.set(entry.key,{...entry,evidenceStatus:'Rule implemented; effectiveness not independently demonstrated'});
  const changes=[...tuning.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const latest=days.at(-1)||null;
  return reply({
   ok:true,generatedAt:new Date().toISOString(),source:'Published paper-bet ledger plus private daily snapshots',
   overview:latest?.cumulative||null,daily:days,tuning:changes,archiveDays:(history.days||[]).length,
   research:{
    coverage:researchCoverage(ledger,historicalRuns.runs||[]),
    factors:researchHistory.factors||[],
    sources:researchHistory.sources||[],
    validation:chronologicalAssessment(historicalRuns.runs||[]),
    priceAudit:historicalPriceAudit(ledger),
    snapshotsRecorded:researchHistory.snapshots?.length||0,
    tracks:trackProfiles.tracks||[],
    status:'Evidence-backed shadow research: do not update live picks until out-of-sample improvement is established'
   },
   methodology:{
    strikeRate:'Confirmed winning finishers divided by all known finishes; non-runners excluded',
    placeRate:'Each-way selections placed within known paid-place terms / settled each-way runners with verified terms',
    profit:'Credited returns less fully settled stakes; unsettled paper stakes excluded from settled P/L',
    dailyTracking:'All dates are rebuilt from recorded results. Scheduled snapshots are committed when figures materially change.',
    caveat:'Rules are explicitly revised. No autonomous model training or demonstrated predictive improvement is claimed.'
   }
  });
 }catch(err){
  return reply({ok:false,error:'Back-office report could not be loaded'},503);
 }
}
