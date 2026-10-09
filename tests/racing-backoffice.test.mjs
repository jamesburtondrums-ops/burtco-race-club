import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {dailyReports,tuningNotes,settleEntry,settleTicket} from '../functions/_lib/backoffice-stats.mjs';
import {login,isAuthed,signOut} from '../functions/_lib/backoffice-auth.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const load=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const ledger=load('data/bet-ledger.json'),races=load('data/races.json'),history=load('functions/_private/backoffice-history.json');
const days=dailyReports(ledger);
assert.ok(days.length>=2,'Daily journal contains multiple race days');
assert.equal(days[0].date,'2026-10-08');
assert.equal(days[0].cumulative.settledProfit,-15.76,'Historical settled P/L matches site');
assert.equal(days[0].winStrikeRate,27.27,'Day-one win strike rate');
assert.equal(days[0].ewPlaceRate,37.5,'Known-place strike rate matches site');
assert.equal(days[0].cumulative.availableBank,984.24,'Bank after first day');
assert.ok(history.days.length>=2,'Snapshots persisted outside public assets');
assert.ok(history.tuningLog.some(e=>e.key==='min-odds'),'Odds floor recorded in system change log');
assert.ok(history.tuningLog.some(e=>e.key==='lucky15-price'),'Strict Lucky15 price history recorded');
assert.ok(tuningNotes(races).length>=4,'Current source rules produce a tuning register');
assert.equal(settleEntry({winStake:10,placeStake:0,betType:'win',result:{status:'NR'}}).returns,10,'NR refund');
assert.equal(settleTicket({totalStake:30,stakePerLinePerSide:1,legs:Array.from({length:4},()=>({result:{status:'NR'}}))}).returns,30,'Void Lucky15 returns original stake');
// Authentication tests use fake values. Production access secrets never appear in the repo.
const store=new Map();
const guard={
 get:async key=>store.get(key)||null,
 put:async(key,val)=>{store.set(key,String(val))},
 delete:async key=>store.delete(key)
};
const env={BACKOFFICE_PIN:'0007',BACKOFFICE_SESSION_KEY:'ab'.repeat(32),BACKOFFICE_GUARD:guard};
const endpoint='https://racing-intelligence.pages.dev/api/backoffice/login';
const post=(pin,ip='203.0.113.15')=>new Request(endpoint,{method:'POST',headers:{
 origin:'https://racing-intelligence.pages.dev','content-type':'application/json','CF-Connecting-IP':ip
},body:JSON.stringify({pin})});
let r=await login(post('9999'),env);
assert.equal(r.status,401,'Incorrect PIN rejected');
for(let i=0;i<4;i++)r=await login(post('9999'),env);
assert.equal(r.status,429,'Five incorrect attempts trigger 15-minute lockout');
r=await login(post('0007'),env);
assert.equal(r.status,429,'Correct PIN does not bypass temporary lockout');
r=await login(post('0007','203.0.113.16'),env);
assert.equal(r.status,200,'Correct server PIN accepted');
const cookie=r.headers.get('set-cookie');
assert.match(cookie,/HttpOnly; SameSite=Strict/,'Signed session uses HttpOnly SameSite cookie');
assert.ok(!cookie.includes(env.BACKOFFICE_PIN),'PIN never appears in cookie');
const request=new Request('https://racing-intelligence.pages.dev/api/backoffice/report',{headers:{cookie:cookie.split(';')[0]}});
assert.equal(await isAuthed(request,env),true,'Valid cookie authenticates');
assert.equal(await isAuthed(new Request(request.url),env),false,'No-cookie report access denied');
const tampered=cookie.split(';')[0].replace(/=([A-Za-z0-9_-])/,(_m,c)=>'='+(c==='A'?'B':'A'));
assert.equal(await isAuthed(new Request(request.url,{headers:{cookie:tampered}}),env),false,'Forged cookie denied');
assert.equal(signOut().headers.get('set-cookie').includes('Max-Age=0'),true,'Logout revokes browser cookie');
const page=readFileSync(new URL('../backoffice.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../backoffice.js',import.meta.url),'utf8');
assert.match(page,/pin-form/,'Accessible PIN sign-in form');
assert.match(page,/report-content/,'Daily analytics container');
assert.ok(script.includes('./api/backoffice/report'),'Back office calls protected server endpoint');
assert.ok(!script.includes(env.BACKOFFICE_PIN),'Frontend contains no mock PIN');
console.log('PASS: multi-day snapshots, payout rates, tuning provenance, 5-try PIN limit and signed sessions');
