import { mkdir, rm, cp, writeFile, readFile } from 'node:fs/promises';
import { contentSecurityPolicy } from './security.mjs';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
// Never copy the checkout wholesale: credentials, tests and backend source are not static assets.
for (const f of ['index.html', 'bootstrap.js', 'stage1.css', 'stage1.js', 'stage2.css', 'stage2.js','stage3.js','stage3.css','admin','shared', 'assets']) await cp(f, `dist/${f}`, { recursive: true });
// Disable Pages' default SPA fallback for unknown/private-looking file paths.
// Clean application routes continue through the original source Functions.
await writeFile('dist/404.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page unavailable — 1751</title><link rel="stylesheet" href="/admin/admin.css"></head><body><main><h1>Page unavailable</h1><p>This address is unavailable. Return to the website to continue.</p><a href="/">Return to 1751</a></main></body></html>');
await writeFile('dist/_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: ${contentSecurityPolicy(await readFile('index.html','utf8'))}
/admin
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow
/admin/*
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow
/assets/*
  Cache-Control: public, max-age=86400
`);
await writeFile('dist/_routes.json',JSON.stringify({version:1,include:['/','/api/*','/store','/summit','/community','/about','/account','/products/*','/events/*','/stories','/stories/*','/community/discussion/*','/community/posts/*','/legal/*','/robots.txt','/sitemap.xml'],exclude:[]},null,2));
console.log('Built dist/ with allowlisted static files only.');
