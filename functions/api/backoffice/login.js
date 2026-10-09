import {login} from '../../_lib/backoffice-auth.mjs';
export async function onRequestPost({request,env}){return login(request,env)}
export async function onRequestGet(){return new Response('Method not allowed',{status:405,headers:{'allow':'POST','cache-control':'no-store'}})}
