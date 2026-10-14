// Separate visual preview. Never modifies dist/, functions/ or application source.
import {cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
const target='static-preview';
await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
for(const file of ['index.html','bootstrap.js','stage1.css','stage1.js','stage2.css','stage2.js','stage3.css','stage3.js','admin','shared','assets'])await cp(file,`${target}/${file}`,{recursive:true});
const banner='<div class="platform-note" role="status">Static preview only · Sign-in, administration, purchases, registrations and submissions are unavailable.</div>';
for(const file of ['index.html','admin/index.html']){
 let html=await readFile(`${target}/${file}`,'utf8');
 html=html.replace('<head>','<head><meta name="robots" content="noindex,nofollow"><script src="/static-preview.js"></script>');
 html=html.replace('</header>','</header>'+banner);
 await writeFile(`${target}/${file}`,html);
}
await writeFile(`${target}/static-preview.js`,`/* Explicitly disable data-backed actions in this static-only artifact. */
const previewFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/'))return Promise.resolve(new Response(JSON.stringify({error:'static_preview_only'}),{status:503,headers:{'Content-Type':'application/json'}}));return previewFetch(input,init);};\n`);
let adapter=await readFile(`${target}/stage2.js`,'utf8');
adapter=adapter.replace('const errors = {','const errors = { static_preview_only: "Static preview: sign-in, purchases, registrations and submissions are unavailable.",');
await writeFile(`${target}/stage2.js`,adapter);
let headers=await readFile('dist/_headers','utf8');headers=headers.replace('/*\n','/*\n  X-Robots-Tag: noindex, nofollow\n',1);
await writeFile(`${target}/_headers`,headers);
await writeFile(`${target}/robots.txt`,'User-agent: *\nDisallow: /\n');
await writeFile(`${target}/_redirects`,['/store','/summit','/community','/about','/account','/stories','/stories/*','/products/*','/events/*','/community/discussion/*','/community/posts/*'].map(path=>`${path} /index.html 200`).join('\n')+'\n');
await writeFile(`${target}/404.html`,'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>1751 static preview</title></head><body><h1>Unavailable in this preview</h1><p>Account, checkout, registration, publishing and API services require the full Pages deployment.</p><a href="/">Return to 1751</a></body></html>');
console.log('Built static-preview/: explicitly labelled visual preview; full dist/ and source functions preserved.');
