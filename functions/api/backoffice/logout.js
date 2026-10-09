import {signOut,strictOrigin,reply} from '../../_lib/backoffice-auth.mjs';
export async function onRequestPost({request}){
 return strictOrigin(request)?signOut():reply({ok:false,error:'Origin check failed'},403);
}
