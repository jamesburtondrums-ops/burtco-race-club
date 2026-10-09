// Browser never sees the PIN or signing key. All secrets come from Cloudflare Pages.
// Four-digit secrets demand server-side rate limiting and short-lived signed sessions.
export const COOKIE='__Host-ri_backoffice';
const enc=new TextEncoder();
const headers={'cache-control':'no-store, private','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer'};
export function reply(data,status=200,extraHeaders={}){
 return new Response(JSON.stringify(data),{status,headers:{...headers,'content-type':'application/json; charset=utf-8',...extraHeaders}});
}
const hexToBytes=h=>{
 if(!/^[0-9a-f]{64}$/i.test(String(h||'')))return null;
 return new Uint8Array(String(h).match(/.{2}/g).map(p=>parseInt(p,16)));
};
const b64url=bytes=>btoa(Array.from(bytes,x=>String.fromCharCode(x)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const fromB64=text=>{
 try{const b=atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4));return Uint8Array.from(b,ch=>ch.charCodeAt(0))}
 catch{return null}
};
function configured(env){return /^\d{4}$/.test(String(env.BACKOFFICE_PIN||''))&&hexToBytes(env.BACKOFFICE_SESSION_KEY)&&env.BACKOFFICE_GUARD}
async function signer(env){
 const bytes=hexToBytes(env.BACKOFFICE_SESSION_KEY);
 return bytes?crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']):null;
}
async function equalPin(one,two){
 const a=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(one)));
 const b=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(two)));
 let x=0;for(let i=0;i<a.length;i++)x|=a[i]^b[i];
 return x===0;
}
async function failKey(request){
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(ip)));
 return 'login-fail:'+b64url(digest.slice(0,18));
}
export function strictOrigin(request){
 const origin=request.headers.get('Origin');
 try{return origin&&new URL(origin).origin===new URL(request.url).origin}
 catch{return false}
}
export async function login(request,env){
 if(!configured(env))return reply({ok:false,error:'Back office unavailable: server authentication not configured'},503);
 if(!strictOrigin(request))return reply({ok:false,error:'Request origin not accepted'},403);
 const len=Number(request.headers.get('content-length')||0);
 if(len>1024)return reply({ok:false,error:'Invalid request'},413);
 let obj;
 try{const txt=await request.text();if(txt.length>1024)throw Error('Invalid size');obj=JSON.parse(txt)}
 catch{return reply({ok:false,error:'Invalid request'},400)}
 const key=await failKey(request);
 let attempts=Number(await env.BACKOFFICE_GUARD.get(key))||0;
 if(attempts>=5)return reply({ok:false,error:'Too many incorrect attempts. Try again in 15 minutes.'},429,{'retry-after':'900'});
 const supplied=String(obj?.pin??'');
 if(!/^\d{4}$/.test(supplied)||!(await equalPin(supplied,env.BACKOFFICE_PIN))){
  attempts++;
  await env.BACKOFFICE_GUARD.put(key,String(attempts),{expirationTtl:900});
  return reply({ok:false,error:attempts>=5?'Access locked temporarily':'Incorrect PIN',remaining:Math.max(0,5-attempts)},attempts>=5?429:401);
 }
 await env.BACKOFFICE_GUARD.delete(key);
 const now=Math.floor(Date.now()/1000);
 const nonce=b64url(crypto.getRandomValues(new Uint8Array(16)));
 const data=enc.encode(JSON.stringify({v:1,iat:now,exp:now+8*3600,nonce}));
 const keyObject=await signer(env);
 const sig=new Uint8Array(await crypto.subtle.sign('HMAC',keyObject,data));
 const value=b64url(data)+'.'+b64url(sig);
 return reply({ok:true,expiresAt:new Date((now+8*3600)*1000).toISOString()},200,{
  'set-cookie':COOKIE+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800'
 });
}
export async function isAuthed(request,env){
 if(!configured(env))return false;
 const cookie=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
 if(!cookie)return false;
 const [payload,signature,...extra]=cookie.slice(COOKIE.length+1).split('.');
 if(!payload||!signature||extra.length||payload.length>1024)return false;
 const data=fromB64(payload),sig=fromB64(signature);
 if(!data||!sig||sig.length!==32)return false;
 try{
  const signed=await crypto.subtle.verify('HMAC',await signer(env),sig,data);
  if(!signed)return false;
  const p=JSON.parse(new TextDecoder().decode(data)),now=Math.floor(Date.now()/1000);
  return p.v===1&&Number.isFinite(p.iat)&&Number.isFinite(p.exp)&&p.exp>now&&p.exp<=p.iat+8*3600&&p.iat<=now+60&&typeof p.nonce==='string';
 }catch{return false}
}
export function signOut(){
 return reply({ok:true},200,{'set-cookie':COOKIE+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'});
}
