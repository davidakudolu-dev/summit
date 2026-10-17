import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { handleRequest } from '../backend/api.js';
import { contentSecurityPolicy } from './security.mjs';
import { renderPublic,routeFromPath } from '../backend/render.js';
const policy = contentSecurityPolicy(await readFile(new URL('../index.html',import.meta.url),'utf8'));
const port = Number(process.env.PORT || 8788);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml' };
http.createServer(async (req, res) => {
  const host = `http://localhost:${port}`;
  const url = new URL(req.url, host);
  try {
    if (url.pathname.startsWith('/api/')) {
      const request = new Request(url, { method: req.method, headers: req.headers, ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: req, duplex: 'half' } : {}) });
      const response = await handleRequest(request, { ...process.env, APP_ORIGIN: process.env.APP_ORIGIN || host });
      res.statusCode = response.status;
      for (const [k, v] of response.headers) if (k !== 'set-cookie') res.setHeader(k, v);
      if (response.headers.getSetCookie().length) res.setHeader('set-cookie', response.headers.getSetCookie());
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    const env={...process.env,APP_ORIGIN:process.env.APP_ORIGIN||host};
    if(env.SUPABASE_URL&&(routeFromPath(url.pathname)||url.pathname.startsWith('/legal/')||['/robots.txt','/sitemap.xml'].includes(url.pathname))){const rendered=await renderPublic(new Request(url),env,{template:await readFile(new URL('../index.html',import.meta.url),'utf8')});if(rendered){res.statusCode=rendered.status;for(const [k,v]of rendered.headers)res.setHeader(k,v);return res.end(await rendered.text());}}
    const path = routeFromPath(url.pathname)?'index.html':['/admin','/admin/'].includes(url.pathname)?'admin/index.html':url.pathname.slice(1);
    if (!['index.html', 'reference.css','reference.js','bootstrap.js', 'stage1.js', 'stage1.css', 'stage2.js', 'stage2.css','stage3.js','stage3.css','admin/index.html','admin/admin.js','admin/admin.css','shared/admin-model.js','assets/favicon.svg','assets/icons.svg'].includes(path) && !/^assets\/img\d+\.webp$/.test(path) && !/^assets\/fonts\/(dm-sans|manrope)-latin\.woff2$/.test(path)) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', types[path.slice(path.lastIndexOf('.'))] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy',policy);
    if(path.startsWith('admin/')){res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex');}
    return res.end(await readFile(new URL(`../${path}`, import.meta.url)));
  } catch { res.statusCode = 503; res.end('Service unavailable'); }
}).listen(port, '127.0.0.1', () => console.log(`1751 development server listening on port ${port}`));
