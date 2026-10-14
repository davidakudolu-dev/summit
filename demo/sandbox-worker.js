// The sandbox uses the real Stage 3 API; provider credentials are runtime bindings.
import platform from '../.local/functions/index.js';
export default {
 async fetch(request,env,ctx){
  const response=await platform.fetch(request,{...env,APP_ENV:'staging',PUBLIC_INDEXING_ENABLED:'false',HTTPS_VERIFIED:'false'},ctx);
  const result=new Response(response.body,response);
  result.headers.set('X-Robots-Tag','noindex, nofollow');
  return result;
 }
};
