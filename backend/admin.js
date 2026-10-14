import { ApiError, id, text, option, email, fetchJson, supabase, authCall, paystack, verifyPayment, hash, equal } from './api.js';
import { ENTITIES } from '../shared/admin-model.js';
export { ENTITIES };
const error=(code,status=400)=>{throw new ApiError(code,status);};
export function validateData(entity,data) {
 const schema=ENTITIES[entity];if(!schema||!data||typeof data!=='object'||Array.isArray(data))error('invalid_entity');
 const result={};
 for(const [key,value] of Object.entries(data)){
  let type=schema.fields[key];if(!type)error('invalid_field');
  if(Array.isArray(type)){result[key]=option(value,type);continue;}
  const nullable=type.endsWith('?');type=type.replace('?','');
  if(nullable&&(value===null||value==='')){result[key]=null;continue;}
  if(type==='uuid')result[key]=id(value);
  else if(type==='boolean'){if(typeof value!=='boolean')error('invalid_input');result[key]=value;}
  else if(['price','positive','nonnegative','percent'].includes(type)){
   if(!Number.isSafeInteger(value)||value<(type==='nonnegative'?0:1)||value>(type==='percent'?90:2000000000))error('invalid_number');result[key]=value;
  }else if(type==='datetime'||type==='date'){
   if(typeof value!=='string'||!Number.isFinite(Date.parse(value))||(type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(value)))error('invalid_date');result[key]=value;
  }else if(type==='url')result[key]=safeUrl(value);
  else if(type==='path'){result[key]=text(value,1,250);if(!/^[A-Za-z0-9_./-]+$/.test(value)||value.startsWith('/')||value.split('/').includes('..'))error('invalid_path');}
  else if(type==='code'){result[key]=text(value,1,50).toUpperCase();if(!/^[A-Z0-9_-]+$/.test(result[key]))error('invalid_input');}
  else if(type==='slug'){result[key]=text(value,1,100);if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value))error('invalid_slug');}
  else result[key]=text(value,nullable||type==='body'?0:1,type==='body'?50000:250);
 }
 if(entity==='articles'&&result.status==='published'){
  if(!result.title?.trim()||!result.author?.trim()||!result.body?.trim())error('incomplete_content');
  result.published_at ||= new Date().toISOString();
 }
 return result;
}
export function safeUrl(value){
 if(/^assets\/img\d+\.webp$/.test(value))return value;
 try{const u=new URL(text(value,1,1500));if(u.protocol!=='https:'||u.username||u.password)error('invalid_url');return u.href;}catch{error('invalid_url');}
}
export function validatedClaims(bearer){
 // Called only AFTER the Auth service has validated the bearer and returned its identity.
 try{const part=bearer.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(part));}catch{return {};}
}
export function isMfa(claims){return claims.aal==='aal2';}
export function requireRecentMfa(claims){
 const times=(claims.amr||[]).filter(x=>['totp','mfa/totp'].includes(x.method)).map(x=>Number(x.timestamp));
 const latest=Math.max(...times),now=Date.now()/1000;
 if(!isMfa(claims)||!Number.isFinite(latest)||now-latest>900||latest>now+60)error('recent_mfa_required',403);
}
export function createAdminDatabase(env,fetcher){return async(action,p,actor,mfa)=>{
 const {response,data}=await fetchJson(fetcher,`${supabase(env)}/rest/v1/rpc/platform_admin`,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({action,p,actor,mfa})},'database_unavailable');
 if(!response.ok){const allowed=new Set(['unauthorized','forbidden','mfa_required','account_suspended','not_found','edit_conflict','invalid_entity','invalid_field','invalid_date_range','capacity_below_reserved','schedule_outside_summit','invalid_schedule','invalid_timezone','scan_required','last_super_admin','confirmation_required','refund_exists','capacity_full','paid_cancellation_requires_review','retention_approval_required','invalid_fulfillment','session_revoked','archived_readonly','product_file_required','existing_sessions_outside_summit','staff_deletion_requires_role_review','deletion_request_required','identity_deletion_unverified']);const code=allowed.has(data.message)?data.message:'database_error';error(code,code==='unauthorized'||code==='session_revoked'?401:['forbidden','mfa_required','account_suspended'].includes(code)?403:code==='database_error'?503:409);}return data;
};}
const SETTINGS={retention_rules:'retention',site_name:'text',contact_email:'email',contact_details:'body',announcement:'body',hero_title:'text',hero_intro:'body',summit_intro:'body',service_intro:'body',logo_url:'url',hero_images:'urls',social_links:'links',footer_links:'links',ecosystem_descriptions:'ecosystem',featured_products:'ids',featured_stories:'ids',maintenance:'boolean',retention_approved:'boolean',site_origin:'origin'};
export function validateSetting(key,value){
 const type=SETTINGS[key];if(!type)error('invalid_setting');
 if(value===null&&!['retention','boolean','origin'].includes(type))return null;
 if(type==='retention'){if(!value||!Number.isInteger(value.financial_days)||value.financial_days<1||value.financial_days>3650||typeof value.retain_purchase_access!=='boolean')error('owner_retention_policy_required');return {financial_days:value.financial_days,retain_purchase_access:value.retain_purchase_access};}
 if(type==='boolean'){if(typeof value!=='boolean')error('invalid_input');return value;}
 if(type==='email')return email(value);
 if(type==='url')return safeUrl(value);
 if(type==='origin'){const u=new URL(safeUrl(value));if(u.pathname!=='/'||u.search||u.hash)error('invalid_origin');return u.origin;}
 if(type==='ids'){if(!Array.isArray(value)||value.length>12)error('invalid_input');return value.map(id);}
 if(type==='urls'){if(!Array.isArray(value)||value.length>3)error('invalid_input');return value.map(safeUrl);}
 if(type==='links'){if(!Array.isArray(value)||value.length>8)error('invalid_input');return value.map(v=>({label:text(v.label,1,60),url:safeUrl(v.url)}));}
 if(type==='ecosystem'){if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(k=>!['Yolena','Store','Community','Compound Interest Summit','Services','Stories'].includes(k)))error('invalid_input');return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,text(v,1,600)]));}
 return text(value,0,type==='body'?3000:200);
}
export async function handleAdmin({route,b,request,env,fetcher,db,adminDb,session,cookieHeaders,requestId}){
 const actor=session.user?.id;if(!session.user?.email_confirmed_at)error('unauthorized',401);
 const claims=validatedClaims(session.bearer),mfa=isMfa(claims);
 const run=(action,p={})=>adminDb(action,{...p,request_id:requestId},actor,mfa);
 if(route==='admin/context')return run('context');
 if(route.startsWith('admin/mfa/')){
  await run('context');
  if(route==='admin/mfa/factors'){const u=await authCall(env,fetcher,'user','GET',null,session.bearer);return {factors:(u.factors||[]).map(f=>({id:f.id,factor_type:f.factor_type,status:f.status,friendly_name:f.friendly_name}))};}
  if(request.method!=='POST')error('method_not_allowed',405);
  if(route==='admin/mfa/enroll'){
   const factor=await authCall(env,fetcher,'factors','POST',{factor_type:'totp',friendly_name:'1751 administration'},session.bearer);
   return {id:factor.id,secret:factor.totp?.secret,uri:factor.totp?.uri};
  }
  if(route==='admin/mfa/challenge')return authCall(env,fetcher,`factors/${id(b.factor_id)}/challenge`,'POST',{},session.bearer);
  if(route==='admin/mfa/verify'){
   if(!/^\d{6}$/.test(b.code||''))error('invalid_mfa_code');
   const s=await authCall(env,fetcher,`factors/${id(b.factor_id)}/verify`,'POST',{challenge_id:id(b.challenge_id),code:b.code},session.bearer);
   const {sessionCookies}=await import('./api.js');cookieHeaders.splice(0,cookieHeaders.length,...sessionCookies(s,env));
   const c=validatedClaims(s.access_token);if(!isMfa(c))error('mfa_required',403);
   await adminDb('context',{request_id:requestId},actor,true);await adminDb('access_log',{request_id:requestId},actor,true);return {verified:true};
  }
  error('not_found',404);
 }
 await run('context');if(!mfa)error('mfa_required',403);
 const action=route.replace('admin/','');
 const highSettings=['maintenance','retention_approved','retention_rules','site_origin'];
 if(['roles','user_control','refund_prepare','deletion_review','delete_account'].includes(action)||(action==='setting_save'&&highSettings.includes(b.key))||(action==='settings_batch'&&b.updates?.some(v=>highSettings.includes(v.key))))requireRecentMfa(claims);
 if(request.method==='GET'){
  const readActions=['overview','analytics','list','detail','revisions','orders','order_detail','registrations','reports','posts','memberships','users','user_detail','deletions','subscribers','settings','policies','health','audit','incidents','media'];
  if(action==='export')return exportCsv(run,b);
  if(!readActions.includes(action))error('method_not_allowed',405);
  if(['list','detail','revisions'].includes(action)&&!ENTITIES[b.entity])error('invalid_entity');
  const data=await run(action,b);
  if(action==='health')return {...data,integrations:Object.fromEntries(['SUPABASE_URL','PAYSTACK_SECRET_KEY','RESEND_API_KEY','SCANNER_URL','OPS_INBOX'].map(k=>[k,{configured:!!env[k],verification:'Not independently verified by presence alone'}]))};
  return data;
 }
 if(action==='save'){
  const data=validateData(b.entity,b.data);
  if(b.entity==='legal_policies'&&data.approved){requireRecentMfa(claims);if(b.confirmation!=='APPROVE POLICY')error('confirmation_required',409);}
  return run('save',{entity:b.entity,id:b.id||null,data,expected_updated_at:b.expected_updated_at||null});
 }
 if(action==='archive')return run('archive',{entity:option(b.entity,['products','articles','summits','communities']),id:id(b.id)});
 if(action==='setting_save')return run('setting_save',{key:b.key,value:validateSetting(b.key,b.value),confirmation:b.confirmation});
 if(action==='settings_batch'){if(!Array.isArray(b.updates)||b.updates.length>20)error('invalid_input');return run('settings_batch',{updates:b.updates.map(v=>({key:v.key,value:validateSetting(v.key,v.value)})),confirmation:b.confirmation});}
 if(action==='roles'){
  if(!Array.isArray(b.roles)||b.roles.length>6)error('invalid_input');
  return run('roles',{user_id:id(b.user_id),roles:[...new Set(b.roles.map(r=>option(r,['super_admin','admin','editor','event_manager','store_manager','moderator'])))],confirmation:b.confirmation});
 }
 if(action==='user_control')return run(action,{user_id:id(b.user_id),...(typeof b.suspended==='boolean'?{suspended:b.suspended}:{}),reason:text(b.reason,5,1000)});
 if(action==='deletion_review')return run(action,{user_id:id(b.user_id),note:text(b.note,10,2000),confirmation:b.confirmation});
 if(action==='delete_account'){
  const op=await run('delete_prepare',{user_id:id(b.user_id),key:id(b.key),note:text(b.note,10,2000),confirmation:b.confirmation});
  if(op.status==='completed')return {completed:true};
  let response;try{response=await fetcher(`${supabase(env)}/auth/v1/admin/users/${b.user_id}`,{method:'DELETE',headers:{Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,apikey:env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(15000)});}catch{error('identity_deletion_requires_reconciliation',409);}
  if(!response.ok&&response.status!==404)error('identity_deletion_requires_reconciliation',409);
  return run('delete_complete',{id:op.id});
 }
 if(action==='session_cancel')return run(action,{id:id(b.id),reason:text(b.reason,5,1000),confirmation:b.confirmation});
 if(action==='session_speakers'){
  if(!Array.isArray(b.speaker_ids)||b.speaker_ids.length>20)error('invalid_input');return run(action,{session_id:id(b.session_id),speaker_ids:[...new Set(b.speaker_ids.map(id))]});
 }
 if(action==='registration_action')return run(action,{id:id(b.id),operation:option(b.operation,['check_in','promote','cancel'])});
 if(action==='moderate')return run(action,{id:id(b.id),decision:option(b.decision,['hide','dismiss']),note:text(b.note||'',0,2000)});
 if(action==='post_moderate')return run(action,{id:id(b.id),...Object.fromEntries(['hidden','featured','announcement'].filter(k=>typeof b[k]==='boolean').map(k=>[k,b[k]]))});
 if(action==='restriction')return run(action,{community_id:id(b.community_id),user_id:id(b.user_id),reason:text(b.reason,5,1000),until:b.until?new Date(b.until).toISOString():null});
 if(action==='unsubscribe')return run(action,{id:id(b.id)});
 if(action==='order_resolve')return run(action,{reference:text(b.reference,5,100),reason:text(b.reason,5,1000)});
 if(action==='order_reconcile'){
  await run(action,{reference:text(b.reference,5,100),reason:'Staff requested authoritative provider verification'});
  return verifyPayment(b.reference,env,fetcher,db);
 }
 if(action==='refund_prepare'){
  const prepared=await run(action,{reference:text(b.reference,5,100),key:id(b.key),reason:text(b.reason,5,1000),confirmation:b.confirmation});
  if(prepared.status!=='requested')return prepared;
  // Persist an uncertain state BEFORE the external call: never blindly retry a lost refund response.
  await run('refund_result',{id:prepared.id,status:'uncertain'});
  try{
   const refund=await paystack(env,fetcher,'refund',{transaction:b.reference,merchant_note:b.reason});
   if(!refund?.id)throw new ApiError('payment_provider_rejected',502);
   return run('refund_result',{id:prepared.id,status:'submitted',provider_id:String(refund.id)});
  }catch{error('refund_requires_reconciliation',409);}
 }
 if(action==='incident_resolve'||action==='outbox_retry')return run(action,{id:id(b.id)});
 error('not_found',404);
}
export function csvCell(value){const s=typeof value==='object'?JSON.stringify(value):String(value??'');return '"'+(/^[\s]*[=+\-@]/.test(s)?"'"+s:s).replace(/"/g,'""')+'"';}
async function exportCsv(run,b){
 const action=option(b.entity,['orders','registrations','subscribers','users','inquiries']);const rows=[];
 for(let offset=0;offset<=5000;offset+=100){
  const result=await run(action==='inquiries'?'list':action,{...b,entity:action,offset,limit:100,...(action==='subscribers'?{status:'subscribed'}:{})});
  const batch=result.rows||[];if(rows.length+batch.length>5000)error('export_too_large',409);rows.push(...batch);if(batch.length<100)break;
 }
 const columns=action==='orders'?['reference','customer_name','email','total_minor','currency','status','created_at']:action==='registrations'?['reference','name','email','session_title','status','checked_in_at','created_at']:action==='subscribers'?['email','status','consent_at','confirmed_at']:action==='users'?['id','email','display_name','created_at','suspended']:['reference','name','email','inquiry_type','status','created_at'];
 return new Response([columns.map(csvCell).join(','),...rows.map(row=>columns.map(k=>csvCell(row[k])).join(','))].join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="1751-${action}.csv"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'}});
}
