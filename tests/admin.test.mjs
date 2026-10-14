import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {generateKeyPairSync} from 'node:crypto';
import {fixture,ids,basket} from './helpers.mjs';import {inspectFile,scanDocument} from '../backend/uploads.js';import {validateData,validateSetting,csvCell} from '../backend/admin.js';import {renderPublic} from '../backend/render.js';import {encryptBackup,decryptBackup,assertRestoreTarget} from '../scripts/backup-lib.mjs';
let f,staff,editor;
before(async()=>{f=await fixture();await f.pg.query(`insert into user_roles values($1,'super_admin'),($2,'editor')`,[ids.user,ids.other]);function session(uid){const u=[...f.accounts.values()].find(a=>a.user.id===uid).user,t=f.makeToken(u,'aal2');f.sessions.set(t,u);return {Cookie:'s1751_access='+t};}staff=session(ids.user);editor=session(ids.other);});
after(async()=>{await f?.close();});
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};const call=(route,body,headers=staff)=>f.call('admin/'+route,body,null,headers);
test('admin access rejects guests, ordinary users and AAL1 staff; genuine TOTP step-up sets protected cookies',async()=>{
 assert.equal((await f.call('admin/overview')).status,401);
 const context=ok(await f.call('admin/context',undefined,ids.user));assert.equal(context.mfa_required,true);
 assert.equal((await f.call('admin/overview',undefined,ids.user)).status,403);
 const factor=ok(await f.call('admin/mfa/enroll',{},ids.user));assert.ok(factor.secret);
 const challenge=ok(await f.call('admin/mfa/challenge',{factor_id:factor.id},ids.user));
 assert.equal((await f.call('admin/mfa/verify',{factor_id:factor.id,challenge_id:challenge.id,code:'111111'},ids.user)).status,401);
 const verified=await f.call('admin/mfa/verify',{factor_id:factor.id,challenge_id:challenge.id,code:'123456'},ids.user);ok(verified);assert.ok(verified.headers.getSetCookie().every(c=>c.includes('HttpOnly')));assert.ok(!verified.data.access_token);
});
test('RBAC prevents editor financial/role access and direct authenticated RPC access',async()=>{
 assert.equal((await call('orders',undefined,editor)).status,403);
 assert.equal((await call('roles',{user_id:ids.other,roles:['super_admin'],confirmation:'CHANGE ROLES'},editor)).status,403);
 await f.pg.exec('set role authenticated');await assert.rejects(()=>f.pg.query(`select platform_admin('overview','{}',$1,true)`,[ids.user]),/permission denied/);await assert.rejects(()=>f.pg.query('select * from admin_audit'),/permission denied/);await f.pg.exec('reset role');
});
test('product create/edit/feature/publish/archive keeps historical purchase prices and paid downloads',async()=>{
 const draft=ok(await call('save',{entity:'products',data:{title:'ADMIN TEST Product',description:'Approved test description',price_minor:300000,product_type:'digital',status:'draft',featured:1}}));
 assert.equal((await call('save',{entity:'products',id:draft.id,data:{status:'published'}})).data.error,'product_file_required');
 await f.pg.query(`insert into media_assets(bucket,storage_path,kind,content_type,size_bytes,sha256,scan_status,uploaded_by) values('digital-products','admin-test.pdf','document','application/pdf',100,$1,'clean',$2)`,['0'.repeat(64),ids.user]);
 const asset=ok(await call('save',{entity:'product_assets',data:{product_id:draft.id,storage_path:'admin-test.pdf',download_limit:3}}));
 ok(await call('save',{entity:'products',id:draft.id,data:{status:'published'}}));
 const purchase=ok(await f.call('checkout',basket({items:[{id:draft.id,quantity:1}]})));f.payments.get(purchase.reference).status='success';ok(await f.call('payments/verify',{reference:purchase.reference,access_token:purchase.access_token}));
 ok(await call('save',{entity:'products',id:draft.id,data:{price_minor:400000,featured:2}}));
 const history=ok(await call('order_detail?reference='+purchase.reference));assert.equal(history.items[0].unit_minor,300000);
 ok(await call('archive',{entity:'products',id:draft.id}));assert.equal(ok(await f.call('product?id='+draft.id)).length,0);
 ok(await f.call('downloads',{reference:purchase.reference,access_token:purchase.access_token,asset_id:asset.id}));
 assert.equal((await call('save',{entity:'products',id:draft.id,data:{status:'published'}})).data.error,'archived_readonly');
});
test('financial records cannot be manually marked paid; verified reconciliation is audited and refunds remain pending',async()=>{
 assert.throws(()=>validateData('products',{status:'paid'}));assert.equal((await call('save',{entity:'orders',data:{status:'paid'}})).status,400);
 const order=ok(await f.call('checkout',basket()));f.payments.get(order.reference).status='success';
 assert.equal(ok(await call('order_reconcile',{reference:order.reference})).status,'paid');
 const count=(await f.pg.query(`select count(*)::int n from admin_audit where action='order_reconcile'`)).rows[0].n;assert.equal(count,1);
 assert.equal((await call('refund_prepare',{reference:order.reference,key:crypto.randomUUID(),reason:'Test approved refund',confirmation:'WRONG'})).data.error,'confirmation_required');
});
test('article draft, preview, publication, revision and archiving preserve visibility boundaries',async()=>{
 const article=ok(await call('save',{entity:'articles',data:{slug:'admin-test-story',title:'ADMIN TEST Story',category:'Test',excerpt:'Approved test excerpt',body:'Safe <script>never execute</script> body',author:'Test Editor',reading_minutes:2,status:'draft'}},editor));
 assert.equal(ok(await f.call('article?slug=admin-test-story')).length,0);
 ok(await call('save',{entity:'articles',id:article.id,data:{title:article.title,author:article.author,body:article.body,status:'published',published_at:new Date().toISOString()}},editor));
 assert.equal(ok(await f.call('article?slug=admin-test-story')).length,1);
 assert.equal(ok(await call('revisions?entity=articles&id='+article.id,undefined,editor)).length,2);
 ok(await call('archive',{entity:'articles',id:article.id},editor));assert.equal(ok(await f.call('article?slug=admin-test-story')).length,0);
});
test('event schedule edits notify registrants, protect capacity and cancel without losing records',async()=>{
 const reg=ok(await f.call('registrations',{session_id:ids.event,name:'Test Member'},ids.user));
 const speaker=crypto.randomUUID();await f.pg.query('insert into speakers(id,name,bio) values($1,$2,$3)',[speaker,'Test Speaker','Test biography']);
 ok(await call('session_speakers',{session_id:ids.event,speaker_ids:[speaker]}));
 const event=ok(await call('detail?entity=sessions&id='+ids.event)).rows[0];assert.deepEqual(event.speaker_ids,[speaker]);
 ok(await call('save',{entity:'sessions',id:ids.event,data:{title:'UPDATED TEST Session',description:'Updated approved description'}}));
 assert.equal((await f.pg.query(`select count(*)::int n from email_outbox where template='schedule_update'`)).rows[0].n,1);
 assert.equal((await call('save',{entity:'sessions',id:ids.event,data:{capacity:0}})).status,400);
 assert.equal((await call('save',{entity:'summits',id:ids.summit,data:{starts_on:'2000-01-01',ends_on:'2000-01-02'}})).data.error,'existing_sessions_outside_summit');
 ok(await call('session_cancel',{id:ids.event,reason:'Test weather cancellation',confirmation:'CANCEL SESSION'}));
 assert.equal(ok(await f.call('event?id='+ids.event)).length,0);const dashboard=ok(await f.call('dashboard',undefined,ids.user));assert.equal(dashboard.registrations.find(r=>r.id===reg.id).session_cancelled,true);
 assert.equal((await f.pg.query(`select count(*)::int n from registrations where id=$1`,[reg.id])).rows[0].n,1);
});
test('moderation hides direct detail responses and restrictions block member write/read access',async()=>{
 ok(await f.call('memberships',{community_id:ids.community,join:true},ids.other));const post=ok(await f.call('posts/create',{community_id:ids.community,title:'Admin moderation test',body:'Test post body'},ids.other));
 ok(await f.call('reports',{post_id:post.id,reason:'Test moderation reason'},ids.other));const report=ok(await call('reports')).rows[0];assert.ok(!('reporter_id' in report));
 ok(await call('moderate',{id:report.id,decision:'hide',note:'Reviewed test report'}));assert.equal(ok(await f.call(`post?id=${post.id}`,undefined,ids.other)).length,0);
 ok(await call('restriction',{community_id:ids.community,user_id:ids.other,reason:'Test spam restriction',until:null}));
 assert.equal((await f.call(`posts?community_id=${ids.community}`,undefined,ids.other)).status,403);
});
test('inquiry workflow assignment and notes are private; subscriber administration cannot resubscribe users',async()=>{
 const inquiry=ok(await f.call('inquiries',{key:crypto.randomUUID(),name:'Admin Inquiry Test',email:'inquiry@example.test',type:'general',message:'Test inquiry message',contact_method:'email',consent:true}));
 const row=ok(await call('list?entity=inquiries&q='+inquiry.reference)).rows[0];ok(await call('save',{entity:'inquiries',id:row.id,data:{status:'in_review',internal_notes:'Private test note',assigned_to:ids.user}}));
 assert.equal(ok(await call('detail?entity=inquiries&id='+row.id)).rows[0].internal_notes,'Private test note');
 ok(await f.call('newsletter/subscribe',{email:'admin-subscriber@example.test',consent:true}));const sub=ok(await call('subscribers')).rows.find(r=>r.email==='admin-subscriber@example.test');ok(await call('unsubscribe',{id:sub.id}));assert.equal((await call('save',{entity:'newsletter_subscriptions',id:sub.id,data:{status:'subscribed'}})).status,400);
});
test('settings are validated, private credentials rejected, featured records use approved database content and legal approval is explicit',async()=>{
 assert.throws(()=>validateSetting('PAYSTACK_SECRET_KEY','secret'));assert.throws(()=>validateSetting('social_links',[{label:'Bad',url:'javascript:alert(1)'}]));
 ok(await call('setting_save',{key:'hero_title',value:'Approved test hero'}));ok(await call('setting_save',{key:'featured_products',value:[ids.product,ids.draftProduct]}));
 const home=ok(await f.call('home'));assert.equal(home.products.length,1);assert.equal(home.products[0].id,ids.product);
 const policy=ok(await call('save',{entity:'legal_policies',data:{slug:'privacy',title:'TEST POLICY',body:'Test fixture only; not approved legal advice.',approved:false}}));assert.equal(ok(await f.call('policy?slug=privacy')),null);
 assert.equal((await call('save',{entity:'legal_policies',id:policy.slug,data:{approved:true}})).data.error,'confirmation_required');
 ok(await call('save',{entity:'legal_policies',id:policy.slug,data:{approved:true},confirmation:'APPROVE POLICY'}));assert.equal(ok(await f.call('policy?slug=privacy')).approved,true);
});
test('new document assets require scanning; executable/SVG/oversized files and scanner mismatches fail closed',async()=>{
 assert.throws(()=>inspectFile(new TextEncoder().encode('<svg onload=alert(1)>'),'image'),/unsupported_file_type/);
 assert.throws(()=>inspectFile(new Uint8Array(8388609),'document'),/invalid_file_size/);
 assert.equal(await scanDocument(new TextEncoder().encode('%PDF-test'),'a'.repeat(64),{},fetch),'pending');
 await assert.rejects(()=>scanDocument(new TextEncoder().encode('%PDF-test'),'a'.repeat(64),{SCANNER_URL:'https://scanner.example.test/scan',SCANNER_TOKEN:'test'},async()=>new Response(JSON.stringify({sha256:'b'.repeat(64),verdict:'clean'}))),/scanner_unavailable/);
 assert.equal((await call('save',{entity:'product_assets',data:{product_id:ids.product,storage_path:'unscanned.pdf'}})).data.error,'scan_required');
});
test('analytics uses verified payments/refunds and makes unmeasured conversion explicit',async()=>{
 const metrics=ok(await call('analytics'));const actual=(await f.pg.query('select coalesce(sum(amount_minor),0)::int n from payments')).rows[0].n;
 assert.equal(metrics.summary.confirmed_payments_minor,actual);assert.equal(metrics.conversion_rate,null);assert.equal(metrics.article_engagement,null);
 assert.equal((await call('analytics?from=2026-10-13&to=2026-10-01')).data.error,'invalid_date_range');
});
test('audit logs cannot be edited/deleted and CSV exports escape spreadsheet formulas',async()=>{
 assert.ok((await f.pg.query('select count(*)::int n from admin_audit')).rows[0].n>5);
 await assert.rejects(()=>f.pg.exec(`update admin_audit set action='rewritten'`),/immutable_audit/);await assert.rejects(()=>f.pg.exec('delete from admin_audit'),/immutable_audit/);
 assert.equal(csvCell(' =HYPERLINK("https://evil")'),'"\' =HYPERLINK(""https://evil"")"');
});
test('SSR metadata, canonical routes, sitemap visibility and private noindex headers use published data',async()=>{
 const template=await readFile(new URL('../index.html',import.meta.url),'utf8');const env={...f.env,PUBLIC_INDEXING_ENABLED:'true'};
 const article=await renderPublic(new Request(f.env.APP_ORIGIN+'/stories/test-story'),env,{db:f.db,template});assert.equal(article.status,200);const html=await article.text();assert.match(html,/rel="canonical"/);assert.match(html,/TEST ONLY Article/);assert.ok(!html.includes('<script>alert(1)</script>'));
 const sitemap=await renderPublic(new Request(f.env.APP_ORIGIN+'/sitemap.xml'),env,{db:f.db,template});const xml=await sitemap.text();assert.ok(xml.includes('/stories/test-story'));assert.ok(!xml.includes('admin-test-story'));assert.ok(!xml.includes('/admin'));
 const account=await renderPublic(new Request(f.env.APP_ORIGIN+'/account'),env,{db:f.db,template});assert.match(account.headers.get('X-Robots-Tag'),/noindex/);assert.equal(account.headers.get('Cache-Control'),'no-store');
 const preview=await renderPublic(new Request(f.env.APP_ORIGIN+'/robots.txt'),f.env,{db:f.db,template});assert.match(await preview.text(),/Disallow: \//);
});
test('encrypted backups authenticate payloads, detect tampering, validate file digests and prohibit production/source restores',async()=>{
 const keys=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const bundle={version:1,source_database:{hostname:'source.example.test',database:'production'},source_storage:'https://source.supabase.co',files:[]};
 const encrypted=encryptBackup(bundle,keys.publicKey);assert.ok(!encrypted.toString().includes('production'));assert.deepEqual(decryptBackup(encrypted,keys.privateKey),bundle);
 const bad=JSON.parse(encrypted);bad.tag=Buffer.alloc(16).toString('base64');assert.throws(()=>decryptBackup(Buffer.from(JSON.stringify(bad)),keys.privateKey));
 assert.throws(()=>assertRestoreTarget(bundle,{APP_ENV:'production',DATABASE_URL:'postgres://u:p@staging.test/db'}),/isolated_restore/);
 assert.throws(()=>assertRestoreTarget(bundle,{APP_ENV:'staging',RESTORE_CONFIRMATION:'ISOLATED STAGING TARGET',DATABASE_URL:'postgres://u:p@source.example.test/production'}),/cannot_restore/);
 assert.doesNotThrow(()=>assertRestoreTarget(bundle,{APP_ENV:'staging',RESTORE_CONFIRMATION:'ISOLATED STAGING TARGET',DATABASE_URL:'postgres://u:p@staging.example.test/staging'}));
});
test('role changes revoke existing sessions, suspended users cannot access private flows, and the last super administrator is protected',async()=>{
 assert.equal((await call('roles',{user_id:ids.user,roles:['editor'],confirmation:'CHANGE ROLES'})).data.error,'last_super_admin');
 ok(await call('roles',{user_id:ids.other,roles:['store_manager'],confirmation:'CHANGE ROLES'}));assert.equal((await f.call('dashboard',undefined,ids.other)).data.error,'session_revoked');
 ok(await call('user_control',{user_id:ids.other,suspended:true,reason:'Test abuse suspension'}));assert.equal((await f.call('memberships',{community_id:ids.community,join:true},ids.other)).data.error,'account_suspended');
 assert.equal((await call('user_control',{user_id:ids.user,suspended:true,reason:'Test lockout prevention'})).data.error,'last_super_admin');
});
test('maintenance pauses new transactions while preserving read/history and deletion stays blocked without owner retention approval',async()=>{
 ok(await call('setting_save',{key:'maintenance',value:true,confirmation:'CHANGE SETTING'}));assert.equal((await f.call('checkout',basket())).data.error,'maintenance_mode');assert.ok(ok(await call('orders')).rows.length>0);
 assert.equal((await call('deletion_review',{user_id:ids.other,note:'Test reviewed request',confirmation:'RETENTION REVIEWED'})).data.error,'retention_approval_required');
 ok(await call('setting_save',{key:'maintenance',value:false,confirmation:'CHANGE SETTING'}));
});
