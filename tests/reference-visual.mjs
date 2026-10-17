import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const types={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',webp:'image/webp',woff2:'font/woff2'};
const server=http.createServer(async(req,res)=>{let path=new URL(req.url,'http://preview.test').pathname;if(['/','/store','/summit','/community','/about','/account'].includes(path))path='/index.html';try{const bytes=await readFile('static-preview'+path);res.setHeader('Content-Type',types[path.split('.').pop()]||'text/plain');res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
await mkdir('test-results/reference',{recursive:true});
try{
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#homeproducts .product').first().waitFor();
 // Comparison captures omit the fixed preview notice, which remains visible in
 // the delivered preview. No content or navigation is hidden for comparison.
 await page.addStyleTag({content:'.platform-note{visibility:hidden!important}'});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>{img.loading='eager';return img.decode().catch(()=>{});}));});
 for(const width of [1440,768,375]){
  await page.setViewportSize({width,height:1000});
  for(const route of ['home','store','summit']){
   await page.evaluate(r=>navigate(r),route);await page.locator('#page-'+route+'.active').waitFor();await page.waitForTimeout(250);
   await page.screenshot({path:`test-results/reference/${route}-${width}.png`,fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${route} overflow at ${width}`);
   const geometry=await page.evaluate(()=>[...document.querySelector('.page.active').children].map(n=>({class:n.className,id:n.id,y:Math.round(n.getBoundingClientRect().top+scrollY),height:Math.round(n.getBoundingClientRect().height)})));
   await page.screenshot({path:`test-results/reference/${route}-${width}.png`,fullPage:true});results.push({route,width,height:await page.evaluate(()=>document.documentElement.scrollHeight),geometry});
  }
 }
 await page.setViewportSize({width:375,height:900});await page.locator('#menubtn').click();await page.locator('#nav [data-page=home]').click();await page.locator('#page-home.active').waitFor();
 await page.locator('.hero-next').click();assert.equal(await page.locator('.hero-slide.is-active').getAttribute('src'),'/assets/img77.webp');
 await page.evaluate(()=>navigate('summit'));const initial=await page.locator('.month-toolbar').innerText();await page.locator('[data-month="1"]').click();assert.notEqual(await page.locator('.month-toolbar').innerText(),initial);await page.locator('[data-month="-1"]').click();await page.locator('.cal-day').first().click();await page.locator('.event-list').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS reference screenshots: all three routes at 1440/768/375, no page overflow/errors, mobile navigation, slideshow and month/day controls.');
}finally{await writeFile('test-results/reference/report.json',JSON.stringify({results,errors},null,2));await browser.close();await new Promise(r=>server.close(r));}
