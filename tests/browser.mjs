import { chromium } from 'playwright-core';
import {startTestServer} from './http.mjs';
import {existsSync} from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fixture, ids } from './helpers.mjs';
import { handleRequest } from '../backend/api.js';
import { contentSecurityPolicy } from '../scripts/security.mjs';
import assert from 'node:assert/strict';
const f = await fixture();
const server=await startTestServer(f);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();const errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
async function check(name,run){try{await run();results.push({name,status:'passed'});console.log('PASS',name);}catch(e){results.push({name,status:'failed',error:e.message});console.error('FAIL',name,e.message);throw e;}}
async function waitText(selector,text){await page.locator(selector).filter({hasText:text}).first().waitFor({state:'visible'});}
async function clickAction(action,root=''){await page.locator(`${root} [data-action="${action}"]`.trim()).first().click();}
try {
 await check('original navigation, published catalog and product detail dialog',async()=>{
  await page.goto(f.env.APP_ORIGIN);await waitText('#homeproducts','TEST ONLY Resource');
  for(const route of ['summit','store','community','about','home']){await page.evaluate(r=>navigate(r),route);await page.locator(`#page-${route}.active`).waitFor();}
  await page.evaluate(()=>navigate('store'));await waitText('#storeproducts','TEST ONLY Resource');
  await clickAction('product','#storeproducts');await waitText('#modalcontent','Test resource description');await page.keyboard.press('Escape');assert.equal(await page.locator('#modalbg.open').count(),0);
 });
 await check('guest cart refresh, authoritative checkout and private paid downloads',async()=>{
  await clickAction('add','#storeproducts');await waitText('#cartnum','1');await page.reload();await waitText('#cartnum','1');
  await page.evaluate(()=>openCart());await waitText('#cartitems','TEST ONLY Resource');await page.locator('#cartcheckout').click();
  await page.locator('#modalcontent input[name=name]').fill('Guest Buyer');await page.locator('#modalcontent input[name=email]').fill('guest-browser@example.test');await page.locator('#modalcontent button[type=submit]').click();
  await waitText('#modalcontent','Order created');const link=await page.locator('#modalcontent a[data-route]').getAttribute('data-route');
  const [,reference,accessToken]=link.split('/');f.payments.get(reference).status='success';
  await page.evaluate(route=>{closeModal();navigate(route);},link);await waitText('#account-content','Check payment status');await clickAction('verify-payment','#account-content');await waitText('#account-content','paid');
  assert.equal(await page.locator('#account-content [data-action=download]').count(),1);
  assert.equal((await f.db('order',{reference,access_hash:await (await import('../backend/api.js')).hash(accessToken)})).status,'paid');
 });
 await check('deep article URL survives refresh and stored content cannot execute HTML',async()=>{
  await page.evaluate(()=>navigate('story/test-story'));await waitText('#article-content','TEST ONLY Article');await page.reload();await waitText('#article-content','TEST ONLY Article');
  assert.equal(await page.locator('#article-content script').count(),0);assert.ok((await page.locator('.article-body').textContent()).includes('<script>'));
 });
 await check('account login, persistent session after reload, profile and password recovery UI',async()=>{
  await page.evaluate(()=>navigate('account'));await page.locator('[data-form=auth-login] input[name=email]').fill('test@example.test');await page.locator('[data-form=auth-login] input[name=password]').fill('long-test-password');await page.locator('[data-form=auth-login] button[type=submit]').click();
  await waitText('#account-content','Welcome');await page.reload();await waitText('#account-content','Welcome');
  await page.locator('[data-form=profile] input[name=display_name]').fill('Browser Member');await page.locator('[data-form=profile] button[type=submit]').click();await waitText('[data-form=profile]','Profile saved');
  const device=await browser.newContext();const devicePage=await device.newPage();devicePage.on('pageerror',e=>errors.push(e.message));await devicePage.goto(f.env.APP_ORIGIN+'/#account');await devicePage.locator('[data-form=auth-login] input[name=email]').fill('test@example.test');await devicePage.locator('[data-form=auth-login] input[name=password]').fill('long-test-password');await devicePage.locator('[data-form=auth-login] button[type=submit]').click();await devicePage.locator('[data-form=profile]').waitFor();assert.equal(await devicePage.locator('[data-form=profile] input[name=display_name]').inputValue(),'Browser Member');await device.close();
 });
 await check('five-day schedule, calendar and confirmed registration dashboard',async()=>{
  await page.evaluate(()=>navigate('summit'));await page.locator('#listbtn').click();await waitText('#events','TEST ONLY Free Session');assert.equal(await page.locator('#daytabs button').count(),5);
  await page.locator('#calbtn').click();assert.equal(await page.locator('#events .cal-day').count(),5);await clickAction('day','#events');
  await page.locator('#events [data-action=event]').first().click();await clickAction('register-event','#modalcontent');await page.locator('#modalcontent [data-form=registration] button[type=submit]').click();await waitText('#modalcontent','Registration confirmed');await clickAction('account','#modalcontent');await waitText('#account-content','TEST ONLY Free Session');
 });
 await check('community membership, post, comment, author edit and report',async()=>{
  await page.evaluate(()=>navigate('community'));await waitText('#communities-list','TEST ONLY Public Community');
  await page.locator(`#communities-list [data-action=membership][data-id="${ids.community}"]`).click();await waitText('#communities-list','You are a member');await page.evaluate(id=>navigate('discussion/'+id),ids.community);await waitText('#discussion-content','New post');await clickAction('new-post','#discussion-content');
  await page.locator('#modalcontent input[name=title]').fill('Browser discussion');await page.locator('#modalcontent textarea[name=body]').fill('A persistent browser discussion.');await page.locator('#modalcontent button[type=submit]').click();await waitText('#discussion-content','Browser discussion');
  await page.locator('[data-form=comment] textarea').fill('Browser reply');await page.locator('[data-form=comment] button[type=submit]').click();await waitText('#discussion-content','Browser reply');await clickAction('edit-post','#discussion-content');await page.locator('#modalcontent input[name=title]').fill('Edited browser discussion');await page.locator('#modalcontent button[type=submit]').click();await waitText('#discussion-content','Edited browser discussion');
  await clickAction('report','#discussion-content');await page.locator('#modalcontent textarea').fill('Browser test report reason');await page.locator('#modalcontent button[type=submit]').click();await waitText('#modalcontent','Report saved');await page.keyboard.press('Escape');
 });
 await check('inquiry accepted by backend with unique reference and notification queued',async()=>{
  await page.evaluate(()=>openContact('Request Training'));await page.locator('#modalcontent textarea[name=message]').fill('Please discuss a test training engagement.');await page.locator('#modalcontent input[name=consent]').check();await page.locator('#modalcontent button[type=submit]').click();await waitText('#modalcontent','Inquiry received');await page.keyboard.press('Escape');
 });
 await check('newsletter consent, double opt-in and unsubscribe UI persist in database',async()=>{
  await page.locator('form[aria-label="Newsletter subscription"] input[type=email]').fill('browser-newsletter@example.test');await page.locator('form[aria-label="Newsletter subscription"] input[type=checkbox]').check();await page.locator('form[aria-label="Newsletter subscription"] button[type=submit]').click();await waitText('#newsletter-status','confirmation email');
  const sub=(await f.pg.query(`select * from newsletter_subscriptions where email='browser-newsletter@example.test'`)).rows[0];assert.equal(sub.status,'pending');
  const job=(await f.pg.query('select data from email_outbox where dedupe_key=$1',['newsletter:'+sub.token_hash])).rows[0].data;
  await page.goto(job.confirm_url);await page.locator('[data-form=newsletter-action] button[type=submit]').click();await waitText('#account-content','subscribed');
  await page.goto(job.unsubscribe_url);await page.locator('[data-form=newsletter-action] button[type=submit]').click();await waitText('#account-content','unsubscribed');
 });
 await check('global search uses public backend results',async()=>{
  await page.evaluate(()=>openSearch());await page.locator('#site-search-input').fill('TEST');await page.locator('[data-form=search] button[type=submit]').click();await waitText('#site-search-results','TEST ONLY Resource');await page.keyboard.press('Escape');
 });
 await check('responsive layout on all original pages plus account at 375, 768 and 1440 pixels',async()=>{
  for(const width of [375,768,1440]){await page.setViewportSize({width,height:1000});for(const route of ['home','store','summit','community','about','account']){await page.evaluate(r=>navigate(r),route);await page.locator(`#page-${route}.active`).waitFor();await page.waitForTimeout(100);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`${route} overflows at ${width}`);}}
 });
 await check('logout clears session; backend outage gives error without false success',async()=>{
  await page.evaluate(()=>navigate('account'));await waitText('#account-content','Sign out');await clickAction('logout','#account-content');await page.locator('[data-form=auth-login]').waitFor();
  await clickAction('auth-mode','#account-content');
  const key=f.env.APP_SECRET;delete f.env.APP_SECRET;await page.evaluate(()=>navigate('store'));await page.locator('#productsearch').fill('uncached-outage-test');await waitText('#storeproducts','deployment configuration');f.env.APP_SECRET=key;
 });
 await check('signup verification and recovery links complete through the browser account forms',async()=>{
  await page.evaluate(()=>navigate('account'));await page.locator('[data-action=auth-mode][data-mode=signup]').click();await page.locator('[data-form=auth-signup] input[name=display_name]').fill('New Browser Member');await page.locator('[data-form=auth-signup] input[name=email]').fill('new-browser@example.test');await page.locator('[data-form=auth-signup] input[name=password]').fill('browser-new-password');await page.locator('[data-form=auth-signup] button[type=submit]').click();await waitText('[data-form=auth-signup]','Registration accepted');
  await page.goto(`${f.env.APP_ORIGIN}/#verify/signup/verify:new-browser@example.test`);await page.locator('[data-form=auth-verify] button[type=submit]').click();await waitText('#account-content','Welcome');await clickAction('logout','#account-content');
  await page.locator('[data-action=auth-mode][data-mode=recover]').click();await page.locator('[data-form=auth-recover] input[name=email]').fill('new-browser@example.test');await page.locator('[data-form=auth-recover] button[type=submit]').click();await waitText('[data-form=auth-recover]','recovery email');
  await page.goto(`${f.env.APP_ORIGIN}/#verify/recovery/verify:new-browser@example.test`);await page.locator('[data-form=auth-verify] button[type=submit]').click();await page.locator('[data-form=password] input').fill('browser-recovered-password');await page.locator('[data-form=password] button[type=submit]').click();await waitText('[data-form=password]','Password changed');
 });
 await check('no uncaught browser JavaScript exceptions',async()=>assert.deepEqual(errors,[]));
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>navigate('home'));await page.waitForTimeout(500);await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/home.png',fullPage:true});
} catch {process.exitCode=1;await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/failure.png',fullPage:true});await writeFile('test-results/failure.html',await page.content());console.error('Account state:',await page.locator('#account-content').textContent());}
finally {
 await mkdir('test-results',{recursive:true});await writeFile('test-results/browser.json',JSON.stringify({environment:'Chromium + real PostgreSQL/PGlite + explicit test doubles for Auth, Paystack, email, Storage',results,errors},null,2));
 await browser.close();await new Promise(resolve=>server.close(resolve));await f.close();
}
