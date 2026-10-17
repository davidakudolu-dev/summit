import http from 'node:http';import {readFile} from 'node:fs/promises';
import {handleRequest} from '../backend/api.js';import {renderPublic,routeFromPath} from '../backend/render.js';import {contentSecurityPolicy} from '../scripts/security.mjs';
export async function startTestServer(f){
 const template=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,f.env.APP_ORIGIN);
   if(url.pathname.startsWith('/api/')){const r=await handleRequest(new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:req,duplex:'half'}:{})}),f.env,{db:f.db,adminDb:f.adminDb,fetch:f.provider});res.statusCode=r.status;for(const [k,v]of r.headers)if(k!=='set-cookie')res.setHeader(k,v);if(r.headers.getSetCookie().length)res.setHeader('set-cookie',r.headers.getSetCookie());return res.end(Buffer.from(await r.arrayBuffer()));}
   if(routeFromPath(url.pathname)||url.pathname.startsWith('/legal/')||['/robots.txt','/sitemap.xml'].includes(url.pathname)){const r=await renderPublic(new Request(url),f.env,{template,db:f.db});if(r){res.statusCode=r.status;for(const [k,v]of r.headers)res.setHeader(k,v);return res.end(await r.text());}}
   const path=['/admin','/admin/'].includes(url.pathname)?'admin/index.html':url.pathname.slice(1);
   if(!['index.html','reference.css','reference.js','bootstrap.js','stage1.js','stage1.css','stage2.js','stage2.css','stage3.js','stage3.css','admin/index.html','admin/admin.js','admin/admin.css','shared/admin-model.js','assets/favicon.svg','assets/icons.svg'].includes(path)&&!/^assets\/img\d+\.webp$/.test(path) && !/^assets\/fonts\/(dm-sans|manrope)-latin\.woff2$/.test(path)){res.statusCode=404;return res.end('Not found');}
   res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.webp')?'image/webp':path.endsWith('.woff2')?'font/woff2':path.endsWith('.svg')?'image/svg+xml':'text/html');res.setHeader('Content-Security-Policy',contentSecurityPolicy());res.setHeader('Cache-Control','no-store');if(path.startsWith('admin/'))res.setHeader('X-Robots-Tag','noindex');return res.end(await readFile(new URL('../'+path,import.meta.url)));
  }catch(e){res.statusCode=500;res.end('Test server failure');console.error('Test server error:',e.message);}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));f.env.APP_ORIGIN=`http://127.0.0.1:${server.address().port}`;return server;
}
