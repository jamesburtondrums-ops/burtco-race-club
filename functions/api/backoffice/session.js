import {isAuthed,reply} from '../../_lib/backoffice-auth.mjs';
export async function onRequestGet({request,env}){
 const authenticated=await isAuthed(request,env);
 return reply({authenticated},authenticated?200:401);
}
