// Real workerd runtime; database/Auth/payment/email are isolated test fixtures only.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';import assert from 'node:assert/strict';import {resolve} from 'node:path';import {readFile} from 'node:fs/promises';
import {fixture,ids,basket} from './helpers.mjs';
const f=await fixture();f.env.APP_ORIGIN='https://sandbox.test';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'platform',modules:true,scriptPath:resolve('.local/functions/index.js'),compatibilityDate:'2026-10-13',bindings:f.env,serviceBindings:{ASSETS:async request=>{let path=new URL(request.url).pathname;if(['/admin','/admin/'].includes(path))path='/admin/index.html';try{if(path.includes('..'))throw Error();return new Response(await readFile('dist'+path));}catch{return new Response('Not found',{status:404});}}},outboundService:async request=>{
 const url=new URL(request.url),body=request.method==='GET'||request.method==='HEAD'?undefined:await request.text();
 if(url.hostname==='test.supabase.co'&&url.pathname.startsWith('/rest/v1/rpc/')){
  try{const params=JSON.parse(body),action=url.pathname.split('/').pop(),result=action==='platform_admin'?await f.adminDb(params.action,params.p,params.actor,params.mfa):await f.db(params.action,params.p,params.actor);return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});}
  catch(e){return new Response(JSON.stringify({message:e.message}),{status:400,headers:{'Content-Type':'application/json'}});}
 }
 const headers=Object.fromEntries(request.headers);headers.Authorization=request.headers.get('Authorization');
 return f.provider(request.url,{method:request.method,headers,...(body!==undefined?{body}:{})});
}}]}));
const call=async(path,body,cookie)=>{const response=await mf.dispatchFetch(f.env.APP_ORIGIN+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{Origin:f.env.APP_ORIGIN,'X-1751-Request':'1','Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {response,data:await response.json()};};
try{
 const health=await call('/api/health');assert.equal(health.data.configured,true);
 const store=await mf.dispatchFetch(f.env.APP_ORIGIN+'/store');assert.equal(store.status,200);assert.match(await store.text(),/TEST ONLY Resource/);
 const products=await call('/api/products');assert.equal(products.data.length,1);
 assert.equal((await call('/api/admin/overview')).response.status,401);
 const login=await call('/api/auth/login',{email:'test@example.test',password:'long-test-password'});assert.equal(login.response.status,200);const cookie=login.response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 assert.equal((await call('/api/dashboard',undefined,cookie)).response.status,200);
 const order=await call('/api/checkout',basket(),cookie);assert.equal(order.response.status,200);f.payments.get(order.data.reference).status='success';
 const paid=await call('/api/payments/verify',{reference:order.data.reference},cookie);assert.equal(paid.response.status,200);assert.equal(paid.data.status,'paid');
 const download=await call('/api/downloads',{reference:order.data.reference,asset_id:ids.asset},cookie);assert.equal(download.response.status,200);assert.ok(download.data.url);
 const reg=await call('/api/registrations',{session_id:ids.event,name:'Runtime Tester'},cookie);assert.equal(reg.response.status,200);assert.equal(reg.data.status,'confirmed');
 const mail=await mf.dispatchFetch(f.env.APP_ORIGIN+'/api/jobs/email',{method:'POST',headers:{Authorization:'Bearer '+f.env.JOB_SECRET}});assert.equal(mail.status,200);assert.ok(f.sent.length>0);
 await f.pg.query(`insert into user_roles values($1,'super_admin')`,[ids.user]);const user=f.accounts.get('test@example.test').user,token=f.makeToken(user,'aal2');f.sessions.set(token,user);
 assert.equal((await call('/api/admin/overview',undefined,'s1751_access='+token)).response.status,200);
 const css=await mf.dispatchFetch(f.env.APP_ORIGIN+'/stage1.css');assert.equal(css.status,200);
 const privateFile=await mf.dispatchFetch(f.env.APP_ORIGIN+'/.dev.vars');assert.equal(privateFile.status,404);
 console.log('PASS actual workerd: API dispatch, SSR/store, authentication/dashboard, Paystack test verification, registration, admin MFA permissions, assets and credential-file denial. Provider doubles are test-only.');
}finally{await mf.dispose();await f.close();}
