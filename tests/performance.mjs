import lighthouse from 'lighthouse';import * as chromeLauncher from 'chrome-launcher';import {existsSync} from 'node:fs';import {mkdir,writeFile} from 'node:fs/promises';import {chromium} from 'playwright-core';
import {fixture} from './helpers.mjs';import {startTestServer} from './http.mjs';
const f=await fixture();f.env.PUBLIC_INDEXING_ENABLED='true';const server=await startTestServer(f),chrome=await chromeLauncher.launch({chromePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),chromeFlags:['--headless','--no-sandbox','--disable-gpu']});
const results=[];
try{
 await mkdir('test-results',{recursive:true});
 for(const formFactor of ['mobile','desktop']){
  const run=await lighthouse(f.env.APP_ORIGIN,{port:chrome.port,output:'html',logLevel:'error',onlyCategories:['performance','accessibility','best-practices','seo'],formFactor,screenEmulation:formFactor==='desktop'?{mobile:false,width:1350,height:940,deviceScaleFactor:1,disabled:false}:undefined,throttlingMethod:'simulate'});
  if(run.lhr.runtimeError)throw new Error(run.lhr.runtimeError.code);
  await writeFile(`test-results/lighthouse-${formFactor}.html`,run.report);await writeFile(`test-results/lighthouse-${formFactor}.json`,JSON.stringify(run.lhr,null,2));
  const entry={formFactor,scope:'Local test origin with fixture records and explicit external-provider doubles; lab simulation, not field Core Web Vitals',scores:Object.fromEntries(Object.entries(run.lhr.categories).map(([key,value])=>[key,Math.round(value.score*100)])),metrics:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','cumulative-layout-shift','total-blocking-time','speed-index'].map(key=>[key,run.lhr.audits[key].displayValue])),warnings:run.lhr.runWarnings};results.push(entry);console.log(JSON.stringify(entry));
 }
}catch(e){console.error('Performance measurement failed:',e.message);process.exitCode=1;}
finally{await writeFile('test-results/performance-summary.json',JSON.stringify(results,null,2));await chrome.kill();await new Promise(resolve=>server.close(resolve));await f.close();}
