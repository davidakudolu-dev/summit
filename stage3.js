/* Additive routing/content adapter. Existing Stage 1/2 UI and business functions remain in use. */
(() => {
 const $=s=>document.querySelector(s),escape=esc,cash=n=>money(n/100);
 const imageUrl=value=>value?.startsWith('assets/')?'/'+value:value;
 const safe=value=>/^https:\/\//.test(value||'')||/^assets\/img\d+\.webp$/.test(value||'');
 const routeFromPath=path=>path==='/'?'home':['/store','/summit','/community','/about','/account'].includes(path)?path.slice(1):path.startsWith('/stories/')?'story/'+path.slice(9):path.startsWith('/products/')?'product/'+path.split('/')[2]:path.startsWith('/events/')?'event/'+path.split('/')[2]:path.startsWith('/community/discussion/')?'discussion/'+path.split('/')[3]:path.startsWith('/community/posts/')?'post/'+path.split('/')[3]:'home';
 window.routeFromPath=routeFromPath;
 const pathFor=route=>({home:'/',store:'/store',summit:'/summit',community:'/community',about:'/about',account:'/account'}[route]||(route.startsWith('story/')?'/stories/'+route.slice(6):route.startsWith('product/')?'/products/'+route.slice(8):route.startsWith('event/')?'/events/'+route.slice(6):route.startsWith('discussion/')?'/community/discussion/'+route.slice(11):route.startsWith('post/')?'/community/posts/'+route.slice(5):null));
 let current=null;
 const originalNavigate=window.navigate;
 window.navigate=function(route,pop=false){
  route=route||routeFromPath(location.pathname);const target=pathFor(route);current=route;
  if(target){if(!pop&&location.pathname!==target)history.pushState(null,'',target);history.replaceState(null,'',location.pathname+'#'+route);}
  originalNavigate(route);
  if(route.startsWith('verify/')){current='account';history.replaceState(null,'','/account');}
  if(target){history.replaceState(null,'',target);const canonical=$('link[rel=canonical]');if(canonical)canonical.href=location.origin+target;}
 };
 window.removeEventListener('hashchange',window.onHashChanged);
 window.addEventListener('hashchange',()=>{const route=location.hash.slice(1)||routeFromPath(location.pathname);if(route!==current)navigate(route);});
 window.addEventListener('popstate',()=>navigate(location.hash.slice(1)||routeFromPath(location.pathname),true));
 async function api(path){const r=await fetch('/api/'+path);const data=await r.json();if(!r.ok)throw new Error(data.error||'service_unavailable');return data;}
 function failure(error){$('#article-content').innerHTML=`<h1>Content unavailable</h1><p role="alert">${escape(error.message)}. Please retry.</p>`;}
 window.loadProductPage=async productId=>{try{const p=(await api('product?id='+encodeURIComponent(productId)))[0];if(!p)throw new Error('Product unavailable');$('#article-content').innerHTML=`<article class="article-layout"><a href="/store">← Store</a><h1>${escape(p.title)}</h1>${safe(p.image_url)?`<img class="article-cover" src="${escape(imageUrl(p.image_url))}" alt="${escape(p.title)}">`:''}<p class="article-body">${escape(p.description)}</p><p class="price">${cash(p.price_minor)}</p><button class="btn" data-action="add" data-id="${p.id}">Add to cart</button></article>`;document.title=p.title+' — 1751 Store';}catch(e){failure(e);}};
 window.loadEventPage=async eventId=>{try{const e=(await api('event?id='+encodeURIComponent(eventId)))[0];if(!e)throw new Error('Event unavailable');$('#article-content').innerHTML=`<article class="article-layout"><a href="/summit">← Summit</a><h1>${escape(e.title)}</h1><p class="article-body">${escape(e.description)}</p><p>${escape(e.starts_at)} – ${escape(e.ends_at)} · ${escape(e.timezone)}</p><p>${e.price_minor?cash(e.price_minor):'Free'}</p><button class="btn" data-action="register-event" data-id="${e.id}">Register</button></article>`;document.title=e.title+' — 1751 Summit';}catch(e){failure(e);}};
 function apply(settings){
  if(settings.site_name){$('.brand').lastChild.textContent=settings.site_name;}
  if(settings.hero_title)$('.hero h1').textContent=settings.hero_title;
  if(settings.hero_intro)$('.hero .lead').textContent=settings.hero_intro;
  if(settings.summit_intro)$('.summit-hero .muted').textContent=settings.summit_intro;
  if(settings.service_intro)$('.darkpanel p').textContent=settings.service_intro;
  if(settings.logo_url&&safe(settings.logo_url)){const logo=$('.brandlogo');logo.textContent='';const image=document.createElement('img');image.src=imageUrl(settings.logo_url);image.alt=settings.site_name||'1751';image.width=27;image.height=27;logo.append(image);}
  if(settings.hero_images)settings.hero_images.forEach((src,i)=>{const img=document.querySelectorAll('.hero-slide')[i];if(img&&safe(src))img.src=imageUrl(src);});
  if(settings.ecosystem_descriptions)for(const card of document.querySelectorAll('#ecosystem .eco-card')){const desc=settings.ecosystem_descriptions[card.querySelector('h3').textContent];if(desc)card.querySelector('p').textContent=desc;}
  if(settings.announcement){const node=document.createElement('p');node.className='platform-note';node.textContent=settings.announcement;document.querySelector('header').after(node);}
  if(settings.contact_email||settings.contact_details||settings.social_links||settings.footer_links){const root=$('.footer-actions');root.replaceChildren();if(settings.contact_details){const p=document.createElement('p');p.textContent=settings.contact_details;root.append(p);}if(settings.contact_email){const a=document.createElement('a');a.href='mailto:'+settings.contact_email;a.textContent=settings.contact_email;root.append(a);}for(const link of [...settings.social_links||[],...settings.footer_links||[]]){if(safe(link.url)){const a=document.createElement('a');a.href=link.url;a.textContent=link.label;a.rel='noopener noreferrer';root.append(a);}}}
  if(settings.maintenance){const node=document.createElement('p');node.className='platform-note error';node.textContent='Registration, checkout and inquiries are temporarily paused for maintenance. Existing account records remain available.';document.querySelector('header').after(node);}
 }
 window.showPrivacy=kind=>{const slug=({'Privacy Policy':'privacy','Terms of Service':'terms'}[kind]||'privacy');location.assign('/legal/'+slug);};
 api('settings').then(apply).catch(()=>{});
 const observer=new MutationObserver(()=>{for(const a of document.querySelectorAll('a[href^="#story/"]'))a.href='/stories/'+a.getAttribute('href').slice(7);});observer.observe($('#stories-list'),{childList:true,subtree:true});
})();
