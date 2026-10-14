import {test} from 'node:test';import assert from 'node:assert/strict';
import {fixture,ids,basket} from './helpers.mjs';
test('settings batches roll back all fields when a sensitive update lacks confirmation',async()=>{
 const f=await fixture();try{
  await f.pg.query(`insert into user_roles values($1,'super_admin')`,[ids.user]);const user=f.accounts.get('test@example.test').user,token=f.makeToken(user,'aal2');f.sessions.set(token,user);
  const response=await f.call('admin/settings_batch',{updates:[{key:'hero_title',value:'MUST ROLL BACK'},{key:'maintenance',value:true}]},null,{Cookie:'s1751_access='+token});
  assert.equal(response.data.error,'confirmation_required');
  for(const [route,body] of [['roles',{user_id:ids.other,roles:['editor']}],['session_cancel',{id:ids.event,reason:'Test missing confirmation'}]]){const denied=await f.call('admin/'+route,body,null,{Cookie:'s1751_access='+token});assert.equal(denied.data.error,'confirmation_required');}
  assert.equal((await f.pg.query(`select count(*)::int n from website_settings where key in ('hero_title','maintenance')`)).rows[0].n,0);
 }finally{await f.close();}
});
test('owner-approved deletion removes identity, retains financial/history relationships and revokes access as configured',async()=>{
 const f=await fixture();try{
  await f.pg.query(`insert into user_roles values($1,'super_admin')`,[ids.user]);const user=f.accounts.get('test@example.test').user,token=f.makeToken(user,'aal2');f.sessions.set(token,user);
  const call=(action,body)=>f.call('admin/'+action,body,null,{Cookie:'s1751_access='+token});const good=r=>{assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
  const order=good(await f.call('checkout',basket({email:'other@example.test'}),ids.other));f.payments.get(order.reference).status='success';good(await f.call('payments/verify',{reference:order.reference},ids.other));
  const registration=good(await f.call('registrations',{session_id:ids.event,name:'Other Member'},ids.other));
  good(await f.call('memberships',{community_id:ids.community,join:true},ids.other));const post=good(await f.call('posts/create',{community_id:ids.community,title:'Preserved discussion',body:'History preserved after identity deletion'},ids.other));
  good(await f.call('account/delete-request',{},ids.other));
  const key=crypto.randomUUID(),request={user_id:ids.other,key,note:'TEST ONLY verified deletion request',confirmation:'DELETE ACCOUNT'};
  assert.equal((await call('delete_account',request)).data.error,'retention_approval_required');
  // Test fixture policies only: no production policies are invented or approved by these tests.
  await f.pg.exec(`insert into legal_policies(slug,title,body,approved) values('privacy','TEST ONLY policy','TEST FIXTURE NOT LEGAL ADVICE',true)`);
  good(await call('settings_batch',{updates:[{key:'retention_rules',value:{financial_days:365,retain_purchase_access:false}},{key:'retention_approved',value:true}],confirmation:'CHANGE SETTING'}));
  assert.equal(good(await call('delete_account',request)).completed,true);assert.equal(good(await call('delete_account',request)).completed,true);
  assert.equal((await f.pg.query('select count(*)::int n from auth.users where id=$1',[ids.other])).rows[0].n,0);
  const preserved=(await f.pg.query(`select o.user_id,o.status,e.revoked_at from orders o join entitlements e on e.order_id=o.id where o.reference=$1`,[order.reference])).rows[0];assert.equal(preserved.user_id,null);assert.equal(preserved.status,'paid');assert.ok(preserved.revoked_at);
  const reg=(await f.pg.query('select user_id,name,email from registrations where id=$1',[registration.id])).rows[0];assert.deepEqual(reg,{user_id:null,name:'Deleted member',email:'deleted@invalid.example'});
  assert.equal((await f.pg.query('select author_id from posts where id=$1',[post.id])).rows[0].author_id,null);
  assert.equal((await f.pg.query(`select count(*)::int n from admin_audit where action='delete_complete'`)).rows[0].n,1);
 }finally{await f.close();}
});
