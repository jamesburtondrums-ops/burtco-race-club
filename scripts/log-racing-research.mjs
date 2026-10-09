// Records honest coverage of authenticated, dated historical racing features.
// Incremental snapshots only when underlying source data or confirmed outcomes change.
import fs from 'node:fs/promises';
import {researchCoverage,chronologicalAssessment} from '../functions/_lib/race-research.mjs';
const base=new URL('../',import.meta.url),read=async path=>JSON.parse(await fs.readFile(new URL(path,base),'utf8'));
const path='functions/_private/racing-research-journal.json';
const [journal,ledger,history]=await Promise.all([read(path),read('data/bet-ledger.json'),read('functions/_private/racing-historical-runs.json')]);
const current=researchCoverage(ledger,history.runs||[]);
const validation=chronologicalAssessment(history.runs||[]);
const clean=o=>{const {recordedAt,...fields}=o||{};return JSON.stringify(fields)};
const prior=journal.snapshots.at(-1);
const hasChange=clean(current)!==clean(prior)||JSON.stringify(validation)!==JSON.stringify(journal.validation);
if(hasChange){
 const now=new Date().toISOString();
 journal.updatedAt=now;
 journal.latest=current;
 journal.validation=validation;
 journal.snapshots.push({...current,recordedAt:now});
 if(journal.snapshots.length>365)journal.snapshots=journal.snapshots.slice(-365);
 await fs.writeFile(new URL(path,base),JSON.stringify(journal,null,2)+'\n');
 console.log('Research data coverage changed: '+current.sourcedHistoricalRaces+' historical races / '+current.confirmedFinishedOutcomes+' settled selection runners.');
}else console.log('Research dataset unchanged; no unsupported self-learning claimed.');
