import assert from 'node:assert/strict';import {readFile,readdir,stat} from 'node:fs/promises';
const config=await readFile('wrangler.toml','utf8');assert.match(config,/pages_build_output_dir\s*=\s*"dist"/);assert.ok(!/\[assets\]|^main\s*=/m.test(config),'Pages config must not be a Workers assets config');
const routes=JSON.parse(await readFile('dist/_routes.json','utf8'));assert.equal(routes.version,1);assert.ok(routes.include.length>0&&routes.include.length+routes.exclude.length<=100);
for(const route of ['/','/api/*','/store','/summit','/account','/products/*','/events/*','/stories/*','/robots.txt','/sitemap.xml','/legal/*'])assert.ok(routes.include.includes(route),route);
for(const path of ['functions/[[path]].js','functions/api/[[path]].js','backend/api.js','backend/admin.js','backend/uploads.js','backend/render.js'])assert.ok((await stat(path)).isFile(),path);
async function walk(root){let result=[];for(const item of await readdir(root,{withFileTypes:true}))result.push(...(item.isDirectory()?await walk(root+'/'+item.name):[root+'/'+item.name]));return result;}
const full=await walk('dist'),preview=await walk('static-preview');
const publicFiles=new Set(['index.html','404.html','reference.css','reference.js','bootstrap.js','stage1.css','stage1.js','stage2.css','stage2.js','stage3.css','stage3.js','static-preview.js','reference-fixtures.js','_headers','_redirects','robots.txt','admin/index.html','admin/admin.js','admin/admin.css','shared/admin-model.js']);
for(const path of preview){
 const relative=path.slice('static-preview/'.length);
 assert.ok(publicFiles.has(relative)||/^assets\/(?:img\d+\.webp|(?:favicon|icons)\.svg|fonts\/(?:dm-sans|manrope)-(?:latin\.woff2|LICENSE\.txt))$/.test(relative),'Unexpected dashboard asset: '+relative);
 assert.ok(!relative.split('/').some(part=>part.startsWith('.')),'Hidden configuration in dashboard preview');
 assert.ok(!/(?:wrangler\.(?:toml|json|jsonc)|package(?:-lock)?\.json|_routes\.json|_worker\.js)$/.test(relative),'Server/build configuration in dashboard preview');
}
for(const files of [full,preview])assert.ok(!files.some(p=>/\/(?:backend|supabase|functions|node_modules)\/|\/\.dev\.vars$|\/\.env$/.test(p)),'Private/server source in static output');
assert.ok(!full.includes('dist/_worker.js'),'Source-functions deployment must not contain an advanced-mode worker');
assert.ok(!preview.some(p=>p.endsWith('/_routes.json')||p.endsWith('/_worker.js')),'Static preview cannot include Pages Functions markers');
for(const file of ['index.html','admin/index.html','stage1.css','stage2.js','stage3.js'])assert.ok(preview.includes('static-preview/'+file));
assert.match(await readFile('static-preview/index.html','utf8'),/Static preview only/);
console.log(`Validated Pages source-functions mode (${full.length} static files), preserved backend routes, and static-only preview (${preview.length} files).`);
