import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, ids, basket } from './helpers.mjs';
import { hmac, handleRequest, validateItems, renderEmail, createDatabase } from '../backend/api.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
let f;
before(async()=>{f=await fixture();});after(async()=>{await f.close();});
const success=r=>{assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};

test('public catalog, search, details, filtering, sorting and draft exclusion',async()=>{
 assert.equal(success(await f.call('products')).length,1);
 assert.equal(success(await f.call('products?q=no-such-resource')).length,0);
 assert.equal(success(await f.call('products?category=Test%20Guides&sort=low'))[0].price_minor,200000);
 assert.equal(success(await f.call(`product?id=${ids.draftProduct}`)).length,0);
 const s=success(await f.call('search?q=TEST'));assert.equal(s.products.length,1);assert.equal(s.articles.length,1);assert.equal(s.events.length,2);
 assert.equal(success(await f.call('articles'))[0].body,null);
 assert.match(success(await f.call('article?slug=test-story'))[0].body,/<script>/);
});
test('RLS enabled everywhere; clients cannot directly read private tables or invoke business RPC',async()=>{
 const tables=(await f.pg.query(`select relname,relrowsecurity from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='public' and relkind='r'`)).rows;
 assert.ok(tables.length>20);assert.ok(tables.every(t=>t.relrowsecurity));
 await f.pg.exec('set role anon');
 await assert.rejects(()=>f.pg.query('select * from orders'),/permission denied/);
 await assert.rejects(()=>f.pg.query(`select platform('products')`),/permission denied/);
 await f.pg.exec('reset role');
 await f.pg.exec('set role authenticated');
 await assert.rejects(()=>f.pg.query('select * from newsletter_subscriptions'),/permission denied/);
 await f.pg.exec('reset role');
});
test('request boundaries reject cross-origin, wrong content type, oversized bodies and invalid IDs',async()=>{
 assert.equal((await f.call('inquiries',{},null,{Origin:'https://attacker.test'})).status,403);
 assert.equal((await f.call('inquiries',{},null,{'Content-Type':'text/plain'})).status,415);
 assert.equal((await f.call('inquiries',{message:'a'.repeat(21000)})).status,413);
 assert.equal((await f.call('product?id=not-a-uuid')).status,400);
 assert.equal((await f.call('products?offset=-1')).status,400);
 assert.throws(()=>validateItems([{id:ids.product,quantity:1},{id:ids.product,quantity:1}]),/invalid_quantity/);
});
test('account lifecycle: signup, verification requirement, verify, login, persistent cookies, profile, logout, recover, password, deletion request',async()=>{
 const signup=success(await f.call('auth/signup',{email:'new@example.test',password:'long-test-password',display_name:'New Member'}));assert.equal(signup.verification_required,true);
 assert.equal((await f.call('auth/login',{email:'new@example.test',password:'long-test-password'})).status,401);
 const verify=await f.call('auth/verify',{token_hash:'verify:new@example.test',type:'signup'});success(verify);
 const cookies=verify.headers.getSetCookie();assert.ok(cookies.every(c=>c.includes('HttpOnly')&&c.includes('SameSite=Lax')));assert.ok(!('access_token' in verify.data));
 const login=await f.call('auth/login',{email:'new@example.test',password:'long-test-password'});success(login);
 const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 assert.equal(success(await f.call('auth/session',undefined,null,{Cookie:cookie})).user.email,'new@example.test');
 success(await f.call('profile',{display_name:'Changed Member',avatar_url:''},null,{Cookie:cookie}));
 assert.equal(success(await f.call('dashboard',undefined,null,{Cookie:cookie})).profile.display_name,'Changed Member');
 success(await f.call('auth/password',{password:'changed-test-password'},null,{Cookie:cookie}));
 success(await f.call('account/delete-request',{},null,{Cookie:cookie}));
 assert.equal(success(await f.call('dashboard',undefined,null,{Cookie:cookie})).deletion_requested,true);
 const logout=await f.call('auth/logout',{},null,{Cookie:cookie});success(logout);assert.ok(logout.headers.getSetCookie().every(c=>c.includes('Max-Age=0')));
 success(await f.call('auth/recover',{email:'new@example.test'}));
 assert.equal((await f.call('auth/login',{email:'new@example.test',password:'long-test-password'})).status,401);
 success(await f.call('auth/login',{email:'new@example.test',password:'changed-test-password'}));
});
test('expired access sessions refresh securely and invalid sessions lose authorization',async()=>{
 const refresh='test-refresh';f.sessions.set(refresh,f.accounts.get('test@example.test').user);
 const r=await f.call('dashboard',undefined,null,{Cookie:`s1751_access=expired;s1751_refresh=${refresh}`});success(r);assert.equal(r.headers.getSetCookie().length,2);
 assert.equal((await f.call('dashboard',undefined,null,{Cookie:'s1751_access=expired;s1751_refresh=invalid'})).status,401);
});
test('account carts persist and cannot be read by another identity',async()=>{
 success(await f.call('cart',{items:[{id:ids.product,quantity:1}]},ids.user));
 assert.equal(success(await f.call('cart',undefined,ids.user)).length,1);assert.equal(success(await f.call('cart',undefined,ids.other)).length,0);
 assert.equal((await f.call('cart')).status,401);
 success(await f.call('cart',{items:[]},ids.user));
});
test('checkout ignores browser prices and totals; repeat requests create one order',async()=>{
 const b=basket({total_minor:1,items:[{id:ids.product,quantity:1,price_minor:1}]});
 const a=success(await f.call('checkout',b));assert.equal(a.total_minor,200000);assert.equal(a.status,'pending');
 const again=success(await f.call('checkout',b));assert.equal(a.reference,again.reference);assert.equal(a.access_token,again.access_token);
 const o=success(await f.call('orders',{reference:a.reference,access_token:a.access_token}));assert.equal(o.items[0].assets.length,0);
 assert.equal((await f.call('orders',{reference:a.reference,access_token:'0'.repeat(64)})).status,404);
 assert.equal((await f.call('downloads',{reference:a.reference,access_token:a.access_token,asset_id:ids.asset})).status,403);
 assert.equal((await f.call('checkout',{...b,promotion:'UNKNOWN'})).data.error,'conflict');
});
test('unavailable items roll back all order inserts; digital quantity and disabled promotions rejected',async()=>{
 const before=(await f.pg.query('select count(*)::int n from orders')).rows[0].n;
 assert.equal((await f.call('checkout',basket({items:[{id:ids.product,quantity:1},{id:ids.draftProduct,quantity:1}]}))).data.error,'unavailable_product');
 assert.equal((await f.pg.query('select count(*)::int n from orders')).rows[0].n,before);
 assert.equal((await f.call('checkout',basket({items:[{id:ids.product,quantity:2}]}))).data.error,'invalid_quantity');
 await f.pg.exec(`insert into promotions values('TEST',10,now()+interval '1 day',1,false,0)`);
 assert.equal((await f.call('checkout',basket({promotion:'TEST'}))).data.error,'invalid_promotion');
 await f.pg.exec(`update promotions set active=true where code='TEST'`);
 assert.equal(success(await f.call('checkout',basket({promotion:'TEST'}))).total_minor,180000);
 assert.equal((await f.call('checkout',basket({promotion:'TEST'}))).data.error,'invalid_promotion');
});
test('independent verification rejects amount/currency/live mismatch and fulfills once',async()=>{
 const a=success(await f.call('checkout',basket())); const p=f.payments.get(a.reference);p.status='success';p.amount=1;
 assert.equal((await f.call('payments/verify',{reference:a.reference,access_token:a.access_token})).data.error,'payment_mismatch');
 p.amount=200000;p.domain='live';assert.equal((await f.call('payments/verify',{reference:a.reference,access_token:a.access_token})).data.error,'payment_mismatch');
 p.domain='test';p.currency='USD';assert.equal((await f.call('payments/verify',{reference:a.reference,access_token:a.access_token})).data.error,'payment_mismatch');p.currency='NGN';
 assert.equal(success(await f.call('payments/verify',{reference:a.reference,access_token:a.access_token})).status,'paid');
 success(await f.call('payments/verify',{reference:a.reference,access_token:a.access_token}));
 const order=success(await f.call('orders',{reference:a.reference,access_token:a.access_token}));assert.equal(order.items[0].assets.length,1);
 const dl=success(await f.call('downloads',{reference:a.reference,access_token:a.access_token,asset_id:ids.asset}));assert.equal(dl.expires_in,60);
 assert.equal((await f.pg.query('select count(*)::int n from entitlements where order_id=$1',[order.id])).rows[0].n,1);
 assert.equal((await f.pg.query(`select count(*)::int n from email_outbox where dedupe_key=$1`,['order:'+order.id])).rows[0].n,1);
 await f.db('refund',{reference:a.reference,amount:200000,provider_id:'refund-test'});
 assert.equal((await f.call('downloads',{reference:a.reference,access_token:a.access_token,asset_id:ids.asset})).status,403);
 assert.equal(success(await f.call('payments/verify',{reference:a.reference,access_token:a.access_token})).status,'refunded');
});
test('webhook signature validation, replay and authoritative provider verification',async()=>{
 const a=success(await f.call('checkout',basket()));f.payments.get(a.reference).status='success';
 const raw=JSON.stringify({event:'charge.success',data:{reference:a.reference,amount:1}});
 const request=sig=>new Request(`${f.env.APP_ORIGIN}/api/payments/webhook`,{method:'POST',headers:{'x-paystack-signature':sig},body:raw});
 assert.equal((await handleRequest(request('invalid'),f.env,{db:f.db,fetch:f.provider})).status,401);
 const sig=await hmac(f.env.PAYSTACK_SECRET_KEY,raw,'SHA-512');
 assert.equal((await handleRequest(request(sig),f.env,{db:f.db,fetch:f.provider})).status,200);
 assert.equal((await handleRequest(request(sig),f.env,{db:f.db,fetch:f.provider})).status,200);
 assert.equal(success(await f.call('orders',{reference:a.reference,access_token:a.access_token})).status,'paid');
});
test('declined/pending/cancelled payment does not grant access; retry keeps the reference',async()=>{
 const a=success(await f.call('checkout',basket()));f.payments.get(a.reference).status='failed';
 assert.equal(success(await f.call('payments/verify',{reference:a.reference,access_token:a.access_token})).status,'failed');
 assert.equal(success(await f.call('payments/retry',{reference:a.reference,access_token:a.access_token})).reference,a.reference);
 assert.equal((await f.call('downloads',{reference:a.reference,access_token:a.access_token,asset_id:ids.asset})).status,403);
 f.payments.get(a.reference).status='abandoned';assert.equal(success(await f.call('payments/verify',{reference:a.reference,access_token:a.access_token})).status,'cancelled');
});
test('live payment credentials are always rejected',async()=>{
 const old=f.env.PAYSTACK_SECRET_KEY;f.env.PAYSTACK_SECRET_KEY='sk_live_notallowed';
 assert.equal((await f.call('checkout',basket())).data.error,'sandbox_configuration_required');f.env.PAYSTACK_SECRET_KEY=old;
});
test('free event registration, duplicate prevention, capacity/waitlist, meeting privacy and promotion on cancellation',async()=>{
 const a=success(await f.call('registrations',{session_id:ids.event,name:'Test Member'},ids.user));assert.equal(a.status,'confirmed');
 assert.equal(success(await f.call('registrations',{session_id:ids.event,name:'Test Member'},ids.user)).reference,a.reference);
 const w=success(await f.call('registrations',{session_id:ids.event,name:'Other Member'},ids.other));assert.equal(w.status,'waitlisted');
 assert.ok(!('meeting_url' in success(await f.call(`event?id=${ids.event}`))[0]));
 assert.equal(success(await f.call('dashboard',undefined,ids.other)).registrations[0].meeting_url,null);
 assert.equal(success(await f.call('dashboard',undefined,ids.user)).registrations[0].meeting_url,'https://example.test/private-meeting');
 success(await f.call('registrations/cancel',{id:a.id},ids.user));
 assert.equal(success(await f.call('dashboard',undefined,ids.other)).registrations[0].status,'confirmed');
 assert.equal((await f.call('registrations/cancel',{id:w.id},ids.user)).status,404);
});
test('paid event reserves capacity, only confirms after payment, and appears in dashboard',async()=>{
 const r=success(await f.call('registrations',{session_id:ids.paidEvent,name:'Test Member'},ids.user));assert.equal(r.status,'pending');assert.ok(r.checkout_url);
 assert.equal((await f.call('registrations',{session_id:ids.paidEvent,name:'Other Member'},ids.other)).data.error,'capacity_full');
 const p=f.payments.get(r.order_reference);p.status='success';
 success(await f.call('payments/verify',{reference:r.order_reference},ids.user));
 assert.equal(success(await f.call('dashboard',undefined,ids.user)).registrations.find(x=>x.id===r.id).status,'confirmed');
 assert.equal((await f.call('registrations/cancel',{id:r.id},ids.user)).data.error,'paid_cancellation_requires_review');
 assert.equal((await f.call('registrations/check-in',{reference:r.reference},ids.moderator)).status,403);
 await f.pg.query(`insert into user_roles values($1,'event_manager')`,[ids.moderator]);
 success(await f.call('registrations/check-in',{reference:r.reference},ids.moderator));
 assert.equal((await f.call('registrations/check-in',{reference:r.reference},ids.other)).status,403);
});
test('community join/post/comment/edit/report/moderation; members-only reads and author boundaries',async()=>{
 assert.equal((await f.call(`posts?community_id=${ids.privateCommunity}`)).status,403);
 success(await f.call('memberships',{community_id:ids.privateCommunity,join:true},ids.user));
 const p=success(await f.call('posts/create',{community_id:ids.privateCommunity,title:'Test discussion',body:'Test body <img onerror=alert(1)>'},ids.user));
 assert.equal((await f.call(`post?id=${p.id}`,undefined,ids.other)).status,403);
 success(await f.call('memberships',{community_id:ids.privateCommunity,join:true},ids.other));
 const c=success(await f.call('comments/create',{post_id:p.id,body:'Test comment'},ids.other));
 success(await f.call('comments/update',{id:c.id,body:'Edited comment'},ids.other));
 assert.equal((await f.call('posts/update',{id:p.id,title:'Hijacked',body:'Hacked'},ids.other)).status,403);
 success(await f.call('posts/update',{id:p.id,title:'Edited discussion',body:'Edited body'},ids.user));
 success(await f.call('reports',{comment_id:c.id,reason:'Test report reason'},ids.user));
 assert.equal((await f.call('reports',undefined,ids.other)).status,403);
 const report=success(await f.call('reports',undefined,ids.moderator))[0];
 success(await f.call('moderation',{id:report.id,hide:true},ids.moderator));
 assert.equal(success(await f.call(`post?id=${p.id}`,undefined,ids.user))[0].comments.length,0);
 success(await f.call('posts/delete',{id:p.id},ids.user));
 assert.equal(success(await f.call(`posts?community_id=${ids.privateCommunity}`,undefined,ids.user)).length,0);
 success(await f.call('memberships',{community_id:ids.privateCommunity,join:false},ids.user));
 assert.equal((await f.call(`posts?community_id=${ids.privateCommunity}`,undefined,ids.user)).status,403);
});
test('inquiry persistence, idempotency, consent, spam trap and private notification outbox',async()=>{
 const b={key:crypto.randomUUID(),name:'Test Sender',email:'sender@example.test',type:'training',message:'Test training inquiry',contact_method:'email',consent:true};
 const a=success(await f.call('inquiries',b));assert.equal(a.notification,'queued');assert.equal(success(await f.call('inquiries',b)).reference,a.reference);
 assert.equal((await f.call('inquiries',{...b,consent:false})).data.error,'consent_required');
 assert.equal((await f.call('inquiries',{...b,website:'spam'})).status,400);
 assert.equal((await f.pg.query(`select count(*)::int n from inquiries where client_key=$1`,[b.key])).rows[0].n,1);
 assert.equal((await f.call('jobs/email',{},null,{Authorization:`Bearer ${f.env.JOB_SECRET}`})).status,200);
 assert.ok(f.sent.some(e=>e.to[0]===f.env.TEAM_INBOX));
});
test('newsletter double opt-in, duplicate prevention, unsubscribe persistence and expired links',async()=>{
 success(await f.call('newsletter/subscribe',{email:'subscriber@example.test',consent:true}));
 success(await f.call('newsletter/subscribe',{email:'subscriber@example.test',consent:true}));
 const row=(await f.pg.query(`select * from newsletter_subscriptions where email='subscriber@example.test'`)).rows[0];assert.equal(row.status,'pending');
 const job=(await f.pg.query(`select data from email_outbox where dedupe_key=$1`,['newsletter:'+row.token_hash])).rows[0].data;
 const confirm=job.confirm_url.split('/').at(-1),unsub=job.unsubscribe_url.split('/').at(-1);
 assert.equal(success(await f.call('newsletter/confirm',{token:confirm})).status,'subscribed');
 assert.equal(success(await f.call('newsletter/unsubscribe',{token:unsub})).status,'unsubscribed');
 assert.equal((await f.call('newsletter/confirm',{token:confirm})).status,409);
 assert.equal((await f.pg.query('select status from newsletter_subscriptions where id=$1',[row.id])).rows[0].status,'unsubscribed');
 assert.equal((await f.call('newsletter/subscribe',{email:'x@example.test',consent:false})).status,400);
 success(await f.call('newsletter/subscribe',{email:'expired@example.test',consent:true}));
 const expired=(await f.pg.query(`select token_hash from newsletter_subscriptions where email='expired@example.test'`)).rows[0];
 const expiryJob=(await f.pg.query('select data from email_outbox where dedupe_key=$1',['newsletter:'+expired.token_hash])).rows[0].data;
 await f.pg.exec(`update newsletter_subscriptions set token_expires_at=now()-interval '1 minute' where email='expired@example.test'`);
 assert.equal((await f.call('newsletter/confirm',{token:expiryJob.confirm_url.split('/').at(-1)})).data.error,'invalid_or_expired');
});
test('protected email jobs and retries; template output escapes user input',async()=>{
 assert.equal((await f.call('jobs/email',{})).status,401);
 assert.match(renderEmail('inquiry',{message:'<script>alert(1)</script>'}).html,/&lt;script&gt;/);
 assert.ok(!renderEmail('inquiry',{message:'<script>alert(1)</script>'}).html.includes('<script>'));
});
test('database rate limiting rejects excess requests and does not use browser state',async()=>{
 for(let i=0;i<3;i++)assert.equal((await f.db('rate',{bucket:'test-rate',max:3})).allowed,true);
 assert.equal((await f.db('rate',{bucket:'test-rate',max:3})).allowed,false);
});
test('public browsing does not consume the stricter authentication-mutation rate bucket',async()=>{
 for(let i=0;i<20;i++)success(await f.call('products'));
 assert.equal(success(await f.call('auth/session',undefined,ids.user)).user.id,ids.user);
});
test('payment initialization outage returns access to the durable pending guest order',async()=>{
 const request=new Request(`${f.env.APP_ORIGIN}/api/checkout`,{method:'POST',headers:{Origin:f.env.APP_ORIGIN,'X-1751-Request':'1','Content-Type':'application/json'},body:JSON.stringify(basket())});
 const r=await handleRequest(request,f.env,{db:f.db,fetch:async(url,init)=>String(url).includes('transaction/initialize')?new Response(JSON.stringify({status:false}),{status:503}):f.provider(url,init)});
 assert.equal(r.status,502);const result=await r.json();assert.ok(result.order.reference);assert.ok(result.order.access_token);
 assert.equal(success(await f.call('orders',{reference:result.order.reference,access_token:result.order.access_token})).status,'pending');
});
test('failed file-signing requests restore the reserved download count',async()=>{
 const order=success(await f.call('checkout',basket()));f.payments.get(order.reference).status='success';success(await f.call('payments/verify',{reference:order.reference,access_token:order.access_token}));
 const count=(await f.pg.query('select count(*)::int n from downloads')).rows[0].n;
 const request=new Request(`${f.env.APP_ORIGIN}/api/downloads`,{method:'POST',headers:{Origin:f.env.APP_ORIGIN,'X-1751-Request':'1','Content-Type':'application/json'},body:JSON.stringify({reference:order.reference,access_token:order.access_token,asset_id:ids.asset})});
 const r=await handleRequest(request,f.env,{db:f.db,fetch:async(url,init)=>String(url).includes('/storage/')?new Response(JSON.stringify({error:'test failure'}),{status:503}):f.provider(url,init)});
 assert.equal(r.status,502);assert.equal((await f.pg.query('select count(*)::int n from downloads')).rows[0].n,count);
});
test('provider email outage preserves accepted submissions and leaves retryable outbox records',async()=>{
 await f.pg.query(`insert into email_outbox(dedupe_key,recipient,template,data) values('email-failure-test','test@example.test','registration','{"reference":"TEST"}')`);
 const request=new Request(`${f.env.APP_ORIGIN}/api/jobs/email`,{method:'POST',headers:{Authorization:`Bearer ${f.env.JOB_SECRET}`}});
 const r=await handleRequest(request,f.env,{db:f.db,fetch:async(url,init)=>String(url).includes('api.resend.com')?new Response(JSON.stringify({message:'test failure'}),{status:503}):f.provider(url,init)});
 assert.equal(r.status,200);assert.equal((await r.json()).sent,0);
 const job=(await f.pg.query(`select status,attempts from email_outbox where dedupe_key='email-failure-test'`)).rows[0];assert.equal(job.status,'pending');assert.equal(job.attempts,1);
});
test('production database adapter redacts unexpected database details',async()=>{
 const db=createDatabase(f.env,async()=>new Response(JSON.stringify({message:'private database details and values'}),{status:500}));
 await assert.rejects(()=>db('products'),e=>e.code==='database_error'&&e.status===503&&!e.message.includes('private'));
});
test('rollback removes platform objects while retaining authentication identities',async()=>{
 const isolated=await fixture({stage3:false});await isolated.pg.exec(await (await import('node:fs/promises')).readFile(new URL('../supabase/rollback.sql',import.meta.url),'utf8'));
 assert.equal((await isolated.pg.query(`select count(*)::int n from auth.users`)).rows[0].n,3);
 assert.equal((await isolated.pg.query(`select count(*)::int n from pg_tables where schemaname='public'`)).rows[0].n,0);await isolated.close();
});
test('PostgreSQL data survives a database shutdown and a new process connection',async()=>{
 const dir=await mkdtemp('/tmp/1751-persistence-');const persistent=await fixture({dataDir:dir});
 const order=success(await persistent.call('checkout',basket(),ids.user));persistent.payments.get(order.reference).status='success';success(await persistent.call('payments/verify',{reference:order.reference},ids.user));
 success(await persistent.call('profile',{display_name:'Persistent Member',avatar_url:''},ids.user));success(await persistent.call('cart',{items:[{id:ids.product,quantity:1}]},ids.user));await persistent.close();
 const reopened=new PGlite(dir);
 const dashboard=(await reopened.query(`select platform('dashboard','{}',$1::uuid) data`,[ids.user])).rows[0].data;assert.equal(dashboard.profile.display_name,'Persistent Member');assert.equal(dashboard.orders[0].status,'paid');
 const receipt=(await reopened.query(`select platform('order',$1::jsonb,$2::uuid) data`,[JSON.stringify({reference:order.reference}),ids.user])).rows[0].data;assert.equal(receipt.items[0].assets.length,1);
 assert.equal((await reopened.query(`select platform('cart','{}',$1::uuid) data`,[ids.user])).rows[0].data[0].quantity,1);
 await reopened.close();await rm(dir,{recursive:true,force:true});
});
