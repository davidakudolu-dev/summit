import {renderPublic} from '../backend/render.js';
export async function onRequest({request,env}){
 const url=new URL(request.url);
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const templateResponse=await env.ASSETS.fetch(new Request(new URL('/index.html',url.origin),{method:'GET',headers:request.headers}));
 const rendered=await renderPublic(request,env,{template:await templateResponse.text()});
 return rendered||env.ASSETS.fetch(request);
}
