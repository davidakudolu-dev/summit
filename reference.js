/* Small presentation components. Data, permissions and mutations remain in stage2. */
(() => {
 const $=s=>document.querySelector(s);
 document.querySelectorAll('[data-hero-index]').forEach(b=>b.addEventListener('click',()=>pickHero(Number(b.dataset.heroIndex))));
 $('.hero-prev').textContent='';$('.hero-next').textContent='';
 $('.hero-prev').setAttribute('aria-label','Previous hero image');$('.hero-next').setAttribute('aria-label','Next hero image');
 $('.hero-pause').id='hero-pause';$('.hero-pause').setAttribute('aria-label','Pause slideshow');
 document.querySelector('[data-ref-faq]')?.addEventListener('click',event=>{event.preventDefault();showInfo('Summit registration','Browse the published schedule, select a session, then sign in to register. Each session lists its time, price, availability and cancellation terms.');});
 const originalNavigate=window.navigate;
 window.navigate=function(route,...args){const result=originalNavigate(route,...args);const base=(route||'home').split('/')[0];document.body.dataset.currentPage=base;const cta=$('.header-cta');cta.textContent=base==='store'?'Browse Products':base==='summit'?'Register now':'Join the Summit';return result;};
 $('.header-cta').removeEventListener('click',$('.header-cta')._stage1Handlers?.click);
 $('.header-cta').addEventListener('click',()=>document.body.dataset.currentPage==='store'?navigate('store'):openRegister());
 const openStoriesOriginal=window.openStories;
 window.openStories=()=>{$('#stories').classList.add('searching');return openStoriesOriginal();};
 document.querySelectorAll('.ref-account-popover button').forEach(b=>b.addEventListener('click',()=>{$('.ref-account-menu').open=false;}));
 // The artwork supplies one quote. Additional controls select existing editorial
 // copy rather than inventing testimonials attributed to real customers.
 const quotes=[['“The best ideas don’t just happen, they’re built by people who keep showing up, learning and supporting each other.”','— 1751 Community'],['“You don’t have to build alone.”','— 1751 Community'],['“One organization. Many ways to build.”','— 1751']];let quote=0;
 document.querySelectorAll('[data-quote-step]').forEach(b=>b.addEventListener('click',()=>{quote=(quote+Number(b.dataset.quoteStep)+quotes.length)%quotes.length;$('.ref-quote blockquote').textContent=quotes[quote][0];$('.ref-quote cite').textContent=quotes[quote][1];$('.quote-controls span').textContent=quotes.map((_,i)=>i===quote?'●':'○').join(' ');}));
 let monthShift=0,monthKey='';
 window.renderReferenceMonth=(dates,events,eventDay)=>{
  const key=dates.join();if(key!==monthKey){monthKey=key;monthShift=0;}
  const first=new Date(dates[0]+'T12:00:00Z');first.setUTCDate(1);first.setUTCMonth(first.getUTCMonth()+monthShift);
  const year=first.getUTCFullYear(),month=first.getUTCMonth(),count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const label=new Intl.DateTimeFormat('en',{month:'long',timeZone:'UTC'}).format(first);
  let cells=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<span class="weekday">${d}</span>`).join('');
  cells+='<span></span>'.repeat(first.getUTCDay());
  for(let n=1;n<=count;n++){const date=`${year}-${String(month+1).padStart(2,'0')}-${String(n).padStart(2,'0')}`,index=dates.indexOf(date),sessions=events.filter(e=>eventDay(e)===date).length;cells+=`<button type="button" class="month-day${index>=0?' cal-day':''}" ${index>=0?`data-action="day" data-index="${index}"`:'disabled'} aria-label="${label} ${n}, ${year}${sessions?`, ${sessions} sessions`:''}">${n}${sessions?'<small>•<br>Event</small>':''}</button>`;}
  $('#events').innerHTML=`<div class="ref-month"><div class="month-toolbar"><button data-month="-1" aria-label="Previous month">‹</button><span>${label}　 ▾</span><span>${year}　 ▾</span><button data-month="1" aria-label="Next month">›</button></div><div class="month-grid">${cells}</div></div>`;
  $('#events').querySelectorAll('[data-month]').forEach(b=>b.addEventListener('click',()=>{monthShift+=Number(b.dataset.month);window.renderReferenceMonth(dates,events,eventDay);}));
 };
 window.renderReferenceDaily=(dates,list,index)=>{
  $('#daily-tabs').innerHTML=dates.slice(0,5).map((_,i)=>`<button data-action="day" data-index="${i}" class="${i===index?'active':''}">Day ${i+1}</button>`).join('');
  const root=$('.daily-description'),event=list[0];
  if(event){root.innerHTML=`<p>Day ${index+1} · ${esc(event.category||'Session')}</p><h3>${esc(event.title)}</h3><p>${esc(event.description||'Explore the programme for full details.')}</p><p>${esc(event.location||'Online')}</p><button class="btn" data-action="event" data-id="${esc(event.id)}">View session</button>`;}
  else{root.innerHTML='<h3>Explore the programme</h3><p>Select a published day to see the available sessions.</p>';}
 };
})();
