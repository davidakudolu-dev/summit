import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { ApiError, handleRequest } from '../backend/api.js';
export const ids = Object.fromEntries(['user','other','moderator','product','asset','category','summit','event','paidEvent','community','privateCommunity','draftProduct','article'].map((n,i)=>[n,`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]));
export async function fixture(options={}) {
  const pg = new PGlite(options.dataDir);
  await pg.exec(`create schema auth; create table auth.users(id uuid primary key,email text,created_at timestamptz not null default now()); create function auth.uid() returns uuid language sql as 'select null::uuid';create role anon;create role authenticated;create role service_role;`);
  await pg.exec(await readFile(new URL('../supabase/migrations/202610130001_platform.sql',import.meta.url),'utf8'));
  if(options.stage3!==false)await pg.exec(await readFile(new URL('../supabase/migrations/202610130002_admin.sql',import.meta.url),'utf8'));
  await pg.query(`insert into auth.users(id,email) values($1,'test@example.test'),($2,'other@example.test'),($3,'moderator@example.test')`,[ids.user,ids.other,ids.moderator]);
  await pg.query(`insert into profiles(id,display_name) values($1,'Test Member'),($2,'Other Member'),($3,'Test Moderator')`,[ids.user,ids.other,ids.moderator]);
  await pg.query(`insert into user_roles values($1,'moderator')`,[ids.moderator]);
  await pg.query(`insert into categories(id,name) values($1,'Test Guides')`,[ids.category]);
  await pg.query(`insert into products(id,title,description,category_id,price_minor,image_url,status) values($1,'TEST ONLY Resource','Test resource description',$2,200000,'assets/img2.webp','published'),($3,'TEST ONLY Draft','Never public',$2,300000,null,'draft')`,[ids.product,ids.category,ids.draftProduct]);
  await pg.query(`insert into product_assets(id,product_id,storage_path) values($1,$2,'test-only.pdf')`,[ids.asset,ids.product]);
  await pg.query(`insert into summits(id,title,starts_on,ends_on,published) values($1,'TEST ONLY Summit',current_date+10,current_date+14,true)`,[ids.summit]);
  await pg.query(`insert into sessions(id,summit_id,title,starts_at,ends_at,capacity,registration_closes_at,registration_open,published,meeting_url,price_minor,waitlist_enabled) values($1,$2,'TEST ONLY Free Session',now()+interval '10 days',now()+interval '10 days 1 hour',1,now()+interval '9 days',true,true,'https://example.test/private-meeting',0,true),($3,$2,'TEST ONLY Paid Session',now()+interval '11 days',now()+interval '11 days 1 hour',1,now()+interval '9 days',true,true,'https://example.test/private-paid',500000,false)`,[ids.event,ids.summit,ids.paidEvent]);
  await pg.query(`insert into communities(id,name,published,visibility) values($1,'TEST ONLY Public Community',true,'public'),($2,'TEST ONLY Private Community',true,'members')`,[ids.community,ids.privateCommunity]);
  await pg.query(`insert into articles(id,slug,title,category,body,author,published_at,reading_minutes,status) values($1,'test-story','TEST ONLY Article','Test','Test body <script>alert(1)</script>','Test Author',now()-interval '1 day',2,'published')`,[ids.article]);
  const adminDb=async(action,p={},actor=null,mfa=false)=>{
    try{return (await pg.query('select platform_admin($1,$2::jsonb,$3::uuid,$4) value',[action,JSON.stringify(p),actor,mfa])).rows[0].value;}
    catch(e){throw new ApiError(e.message,['forbidden','mfa_required','account_suspended'].includes(e.message)?403:e.message==='unauthorized'?401:e.message==='not_found'?404:409);}
  };
  const db = async (action,p={},actor=null) => {
    try { return (await pg.query('select platform($1,$2::jsonb,$3::uuid) value',[action,JSON.stringify(p),actor])).rows[0].value; }
    catch(e){ const code = e.message; throw new ApiError(code,code==='forbidden'?403:code==='unauthorized'?401:code==='not_found'?404:409); }
  };
  const env={ APP_ORIGIN:'http://localhost:8788',SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-service',PAYSTACK_SECRET_KEY:'sk_test_fixture',APP_SECRET:'test-only-app-secret-of-at-least-32-characters',JOB_SECRET:'test-only-job-secret-of-at-least-32-characters',RESEND_API_KEY:'test-resend',EMAIL_FROM:'1751 <sender@example.test>',TEAM_INBOX:'team@example.test' };
  const accounts=new Map(),sessions=new Map(),payments=new Map(),sent=[];
  for(const [id,email,name] of [[ids.user,'test@example.test','Test Member'],[ids.other,'other@example.test','Other Member'],[ids.moderator,'moderator@example.test','Test Moderator']]) {
    const user={id,email,email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),user_metadata:{display_name:name},factors:[]};
    accounts.set(email,{user,password:'long-test-password',verified:true}); sessions.set(`session-${id}`,user);
  }
  const tokens=new Map();
  function makeToken(user,aal='aal1',sid=crypto.randomUUID()){const stamp=Math.floor(Date.now()/1000);const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');return encode({alg:'TEST-ONLY'})+'.'+encode({sub:user.id,iat:stamp,aal,session_id:sid,amr:[{method:'password',timestamp:stamp},...(aal==='aal2'?[{method:'totp',timestamp:stamp}]:[])]})+'.test-signature';}
  for(const a of accounts.values()){const t=makeToken(a.user,a.user.id===ids.moderator?'aal2':'aal1');tokens.set(a.user.id,t);sessions.set(t,a.user);}
  function sessionFor(a,aal='aal1'){const access_token=makeToken(a.user,aal),refresh_token=crypto.randomUUID();sessions.set(access_token,a.user);sessions.set(refresh_token,a.user);return {user:a.user,access_token,refresh_token,expires_in:3600};}
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  const provider=async (url,init={})=>{
    const u=new URL(url),body=typeof init.body==='string'?JSON.parse(init.body):{},bearer=init.headers?.Authorization?.replace('Bearer ','');
    if(u.hostname==='test.supabase.co' && u.pathname.startsWith('/auth/v1/')) {
      const action=u.pathname.slice('/auth/v1/'.length);
      if(action==='signup') {
        const existing=accounts.get(body.email);if(existing)return json({user:existing.user});
        const user={id:crypto.randomUUID(),email:body.email,created_at:new Date().toISOString(),user_metadata:body.data};
        await pg.query('insert into auth.users(id,email) values($1,$2)',[user.id,user.email]);
        accounts.set(body.email,{user,password:body.password,verified:false});return json({user});
      }
      if(action==='token' && u.searchParams.get('grant_type')==='password') {const a=accounts.get(body.email);return a?.password===body.password&&a.verified?json(sessionFor(a)):json({},400);}
      if(action==='token') {const user=sessions.get(body.refresh_token);return user?json(sessionFor({user})):json({},400);}
      if(action==='recover')return json({});
      if(action==='verify') {const a=accounts.get(body.token_hash.replace(/^verify:/,''));if(!a)return json({},400);a.verified=true;a.user.email_confirmed_at=new Date().toISOString();return json(sessionFor(a));}
      if(action==='user') {const user=sessions.get(bearer);if(!user)return json({},401);if(init.method==='PUT'){accounts.get(user.email).password=body.password;}return json(user);}
      if(action==='factors'&&init.method==='POST'){const user=sessions.get(bearer);if(!user)return json({},401);const factor={id:crypto.randomUUID(),factor_type:'totp',status:'unverified'};user.factors.push(factor);return json({...factor,totp:{secret:'TESTONLYSETUPKEY',uri:'otpauth://totp/test-only'}});}
      if(action.endsWith('/challenge'))return json({id:crypto.randomUUID()});
      if(action.endsWith('/verify')){const user=sessions.get(bearer);if(!user||body.code!=='123456')return json({},401);const fid=action.split('/')[1];user.factors.find(f=>f.id===fid).status='verified';return json(sessionFor({user},'aal2'));}
      if(action==='logout'){sessions.delete(bearer);return json({});}
      if(action.startsWith('admin/users/')&&init.method==='DELETE'&&bearer===env.SUPABASE_SERVICE_ROLE_KEY){const target=action.split('/')[2];await pg.query('delete from auth.users where id=$1',[target]);for(const [key,value]of sessions)if(value.id===target)sessions.delete(key);for(const [key,a]of accounts)if(a.user.id===target)accounts.delete(key);return new Response(null,{status:204});}
    }
    if(u.hostname==='api.paystack.co') {
      if(u.pathname==='/transaction/initialize') {payments.set(body.reference,{id:payments.size+1,reference:body.reference,domain:'test',currency:body.currency,amount:body.amount,status:'pending'});return json({status:true,data:{authorization_url:`https://checkout.paystack.com/test-${body.reference}`}});}
      if(u.pathname.startsWith('/transaction/verify/')) {const t=payments.get(decodeURIComponent(u.pathname.slice('/transaction/verify/'.length)));return t?json({status:true,data:t}):json({status:false},404);}
    }
    if(u.hostname==='api.resend.com') {sent.push(body);return options.emailFailure?json({message:'failure'},503):json({id:crypto.randomUUID()});}
    if(u.pathname.startsWith('/storage/v1/'))return json({signedURL:'/object/sign/digital-products/test-only.pdf?token=test-token'});
    throw new Error(`Unexpected test provider call ${u.host}${u.pathname}`);
  };
  const call=async(route,body,userId=null,extra={})=> {
    const req=new Request(`${env.APP_ORIGIN}/api/${route}`,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{Origin:env.APP_ORIGIN,'X-1751-Request':'1','Content-Type':'application/json'}),...(userId?{Cookie:`s1751_access=${tokens.get(userId)}`} : {}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const response=await handleRequest(req,env,{db,adminDb,fetch:provider});return {status:response.status,data:await response.json(),headers:response.headers};
  };
  return {pg,db,adminDb,env,provider,accounts,sessions,payments,sent,tokens,makeToken,call,close:()=>pg.close()};
}
export const basket=(extra={})=>({key:crypto.randomUUID(),name:'Test Buyer',email:'guest@example.test',items:[{id:ids.product,quantity:1}],...extra});
