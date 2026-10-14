import { createDatabase } from './api.js';
import { contentSecurityPolicy } from '../scripts/security.mjs';
export const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jsonLd=value=>JSON.stringify(value).replace(/</g,'\\u003c');
const minor=n=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(n/100);
const image=value=>/^https:\/\//.test(value||'')||/^assets\/img\d+\.webp$/.test(value||'')?value:null;
export const slugify=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'details';
const publicPath=(kind,r)=>`/${kind}/${r.id}/${slugify(r.title)}`;
export function routeFromPath(path){if(path==='/')return 'home';if(['/store','/summit','/community','/about','/account'].includes(path))return path.slice(1);if(path==='/stories')return 'home';if(path.startsWith('/stories/'))return 'story/'+path.slice(9);if(path.startsWith('/products/'))return 'product/'+path.split('/')[2];if(path.startsWith('/events/'))return 'event/'+path.split('/')[2];if(path.startsWith('/community/discussion/'))return 'discussion/'+path.split('/')[3];if(path.startsWith('/community/posts/'))return 'post/'+path.split('/')[3];return null;}
function card(p){return `<article class="product"><div class="product-image">${image(p.image_url)?`<img loading="lazy" src="${escape(p.image_url)}" alt="${escape(p.title)}">`:'<div class="fake-cover">1751</div>'}</div><div class="product-body"><small>${escape(p.category||'Resources')}</small><h3><a href="${publicPath('products',p)}">${escape(p.title)}</a></h3><p>${escape(p.description)}</p><div class="price">${minor(p.price_minor)}</div><a class="btn sm" href="${publicPath('products',p)}">Details</a></div></article>`;}
export async function renderPublic(request,env,{template,db=createDatabase(env,fetch)}={}){
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/';
 const privatePage=path==='/account'||path.startsWith('/community/discussion/')||path.startsWith('/community/posts/');
 const indexed=env.PUBLIC_INDEXING_ENABLED==='true'&&!privatePage;
 const headers=new Headers({'Content-Type':'text/html; charset=utf-8','Cache-Control':privatePage?'no-store':'public, max-age=30','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':contentSecurityPolicy(),'Permissions-Policy':'camera=(), microphone=(), geolocation=()'});
 if(!indexed)headers.set('X-Robots-Tag','noindex, nofollow');
 if(env.HTTPS_VERIFIED==='true'&&url.protocol==='https:')headers.set('Strict-Transport-Security','max-age=31536000');
 const origin=new URL(env.APP_ORIGIN||url.origin).origin;
 if(path==='/robots.txt')return new Response(indexed?`User-agent: *\nDisallow: /admin\nDisallow: /account\nDisallow: /api\nDisallow: /community/discussion\nDisallow: /community/posts\nSitemap: ${origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain','Cache-Control':'public, max-age=60'}});
 try{
  if(path==='/sitemap.xml'){
   if(!indexed)return new Response('Indexing is disabled for this environment.',{status:404,headers:{'X-Robots-Tag':'noindex'}});
   const routes=['/','/store','/summit','/community','/about','/stories'];
   for(const action of ['products','events','articles'])for(let offset=0;offset<=10000;offset+=50){const list=await db(action,{limit:50,offset});if(offset===10000&&list.length)throw new Error('sitemap_limit');for(const r of list)routes.push(action==='articles'?'/stories/'+r.slug:publicPath(action,r));if(list.length<50)break;}
   for(const slug of ['privacy','terms','cookies','refunds','digital-delivery','community-guidelines','event-terms'])if(await db('public_policy',{slug}))routes.push('/legal/'+slug);
   return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(r=>`<url><loc>${escape(origin+r)}</loc></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml','Cache-Control':'public, max-age=60'}});
  }
  if(path.startsWith('/legal/')){
   const slug=path.slice(7);if(!['privacy','terms','cookies','refunds','digital-delivery','community-guidelines','event-terms'].includes(slug))return new Response('Not found',{status:404});
   const policy=await db('public_policy',{slug});if(!policy){headers.set('X-Robots-Tag','noindex');headers.set('Cache-Control','no-store');return new Response(simple('Policy pending approval','This policy has not been approved by the responsible business/legal personnel. Contact the site owner for availability.'),{status:503,headers});}
   return new Response(simple(policy.title,policy.body,origin+path,indexed),{headers});
  }
  const route=routeFromPath(path);if(!route)return null;
  let title='1751 — Digitizing Africa',description='1751 connects technology, creativity, knowledge and opportunity.',canonical=origin+path,structured=null,detail=null,page=route.split('/')[0],cover=origin+'/assets/img7.webp';
  if(route.startsWith('product/')){
   const p=(await db('product',{id:route.slice(8)}))[0];if(!p)return new Response('Product unavailable',{status:404,headers:{'X-Robots-Tag':'noindex'}});
   const target=publicPath('products',p);if(path!==target)return Response.redirect(origin+target,301);
   page='story';title=p.title+' — 1751 Store';description=p.description.slice(0,160);cover=image(p.image_url)?new URL(p.image_url,origin).href:cover;
   detail=`<article class="article-layout"><a href="/store">← Store</a><h1>${escape(p.title)}</h1>${image(p.image_url)?`<img class="article-cover" src="${escape(p.image_url)}" alt="${escape(p.title)}">`:''}<p class="article-body">${escape(p.description)}</p><p class="price">${minor(p.price_minor)}</p><button class="btn" data-action="add" data-id="${p.id}">Add to cart</button></article>`;
   structured={'@context':'https://schema.org','@type':'Product',name:p.title,description:p.description,image:cover,offers:{'@type':'Offer',priceCurrency:'NGN',price:p.price_minor/100,url:canonical}};
  }else if(route.startsWith('story/')){
   const a=(await db('article',{slug:route.slice(6)}))[0];if(!a)return new Response('Story unavailable',{status:404,headers:{'X-Robots-Tag':'noindex'}});
   page='story';title=a.title+' — 1751';description=a.excerpt||a.body.slice(0,160);cover=image(a.cover_image)?new URL(a.cover_image,origin).href:cover;
   detail=`<article class="article-layout"><a href="/stories">← Stories</a><h1>${escape(a.title)}</h1><p>${escape(a.author)} · ${escape(a.published_at)} · ${a.reading_minutes} min read</p>${image(a.cover_image)?`<img class="article-cover" src="${escape(a.cover_image)}" alt="${escape(a.title)}">`:''}<div class="article-body">${escape(a.body)}</div></article>`;
   structured={'@context':'https://schema.org','@type':'Article',headline:a.title,datePublished:a.published_at,author:{'@type':'Person',name:a.author},image:cover,mainEntityOfPage:canonical};
  }else if(route.startsWith('event/')){
   const e=(await db('event',{id:route.slice(6)}))[0];if(!e)return new Response('Event unavailable',{status:404,headers:{'X-Robots-Tag':'noindex'}});
   const target=publicPath('events',e);if(path!==target)return Response.redirect(origin+target,301);
   page='story';title=e.title+' — 1751 Summit';description=e.description.slice(0,160);
   detail=`<article class="article-layout"><a href="/summit">← Summit</a><h1>${escape(e.title)}</h1><p class="article-body">${escape(e.description)}</p><p>${escape(e.starts_at)} – ${escape(e.ends_at)} · ${escape(e.timezone)}</p><p>${escape(e.location||'Location released on confirmation')} · ${e.price_minor?minor(e.price_minor):'Free'}</p><button class="btn" data-action="register-event" data-id="${e.id}">View registration availability</button></article>`;
   structured={'@context':'https://schema.org','@type':'Event',name:e.title,startDate:e.starts_at,endDate:e.ends_at,url:canonical,description:e.description};
  }else if(!privatePage){
   title=({store:'1751 Store — Products and resources',summit:'1751 Summit — Programmes and events',community:'1751 Community — Learn, share, build',about:'About 1751 — Services and collaboration'}[page]||title);
  }
  let html=template;if(!html)throw new Error('template_missing');
  html=html.replace(/<title>.*?<\/title>/s,`<title>${escape(title)}</title>`).replace(/<meta[^>]*name="description"[^>]*>/,`<meta name="description" content="${escape(description)}">`);
  html=html.replace('</head>',`<meta name="1751-route" content="${escape(route)}"><meta name="robots" content="${indexed?'index,follow':'noindex,nofollow'}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:image" content="${escape(cover)}"><meta property="og:type" content="${structured?.['@type']==='Article'?'article':'website'}"><meta name="twitter:card" content="summary_large_image">${structured?`<script type="application/ld+json">${jsonLd(structured)}</script>`:''}</head>`);
  html=html.replace(`class="page" id="page-${page}"`,`class="page active" id="page-${page}"`);
  if(detail)html=html.replace('<div class="container" id="article-content"></div>',`<div class="container" id="article-content">${detail}</div>`);
  if(!detail&&!privatePage){
   if(page==='home'||page==='store'){const products=await db('products',{limit:page==='store'?20:4});html=html.replace(`<div class="products" id="${page==='store'?'storeproducts':'homeproducts'}"></div>`,`<div class="products" id="${page==='store'?'storeproducts':'homeproducts'}">${products.map(card).join('')||'<p>No approved products are published yet.</p>'}</div>`);}
   if(page==='home'){const articles=await db('articles',{limit:12});html=html.replace('<div class="story-grid" id="stories-list"></div>',`<div class="story-grid" id="stories-list">${articles.map(a=>`<article class="story"><div><span class="eyebrow">${escape(a.category)}</span><h3><a href="/stories/${escape(a.slug)}">${escape(a.title)}</a></h3><p>${escape(a.excerpt)}</p></div></article>`).join('')||'<p>No approved stories are published yet.</p>'}</div>`);}
   if(page==='summit'){const events=await db('events',{limit:50});html=html.replace('<div id="events"></div>',`<div id="events"><div class="event-list">${events.map(e=>`<article class="event"><div><h3><a href="${publicPath('events',e)}">${escape(e.title)}</a></h3><p>${escape(e.starts_at)} · ${escape(e.timezone)}</p></div></article>`).join('')||'<p>No published sessions are available yet.</p>'}</div></div>`);}
  }
  // Root-relative assets are necessary on public detail routes.
  html=html.replace(/(src|href)="(assets\/|bootstrap.js|stage[123]\.(?:css|js))/g,'$1="/$2');
  return new Response(html,{headers});
 }catch{
  headers.set('X-Robots-Tag','noindex');headers.set('Cache-Control','no-store');return new Response(simple('1751 is temporarily unavailable','The content service could not be reached. Please retry shortly.'),{status:503,headers});
 }
}
function simple(title,body,canonical='',indexed=false){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${indexed?'index,follow':'noindex'}"><title>${escape(title)} — 1751</title>${canonical?`<link rel="canonical" href="${escape(canonical)}">`:''}<link rel="stylesheet" href="/admin/admin.css"></head><body><header><a class="brand" href="/">1751</a></header><main><h1>${escape(title)}</h1><div class="preformatted">${escape(body)}</div></main></body></html>`;}
