/* Stage 1 progressive enhancements. Original app data and navigation structure preserved. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const pageIds = ['home','summit','store','community','about'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lastFocus=null;
  let slideIndex=0,slideTimer=null,slidePaused=false;
  const slides=$$('.hero-slide');
  const setLive = msg => { const node=$('#announcer'); if(node) node.textContent=msg; };
  function stopTimer(){ if(slideTimer!==null){clearInterval(slideTimer);slideTimer=null;} }
  function setSlide(index){if(!slides.length)return;slideIndex=(index+slides.length)%slides.length;
    slides.forEach((img,i)=>{img.classList.toggle('is-active',i===slideIndex);img.setAttribute('aria-hidden',i===slideIndex?'false':'true')});
    $$('.hero-dot').forEach((b,i)=>{b.classList.toggle('active',i===slideIndex);b.setAttribute('aria-current',i===slideIndex?'true':'false')});
    const cap=$('#hero-caption');if(cap)cap.textContent=slides[slideIndex].dataset.caption||'';
  }
  function startTimer(){stopTimer();if(slidePaused||reducedMotion.matches||document.hidden||slides.length<=1)return;slideTimer=setInterval(()=>setSlide(slideIndex+1),5300)}
  window.moveHero=function(n){setSlide(slideIndex+n);startTimer()};
  window.pickHero=function(i){setSlide(i);startTimer()};
  window.pauseHero=function(){slidePaused=!slidePaused;const b=$('#hero-pause');if(b){b.textContent=slidePaused?'▶':'Ⅱ';b.setAttribute('aria-label',slidePaused?'Play slideshow':'Pause slideshow');b.setAttribute('aria-pressed',String(slidePaused))};startTimer()};
  $('.hero-art')?.addEventListener('mouseenter',stopTimer);
  $('.hero-art')?.addEventListener('mouseleave',startTimer);
  document.addEventListener('visibilitychange',startTimer);
  reducedMotion.addEventListener?.('change',startTimer);
  setSlide(0);startTimer();

  // Never double-render navigation. Buttons are the same five controls at every size.
  window.navigate=function(page){
    if(!pageIds.includes(page)) page='home';
    if(location.hash!=='#'+page){location.hash=page;}
    $$('.page').forEach(p=>{const active=p.id==='page-'+page;p.classList.toggle('active',active);p.setAttribute('aria-hidden',String(!active))});
    $$('[data-page]').forEach(b=>{const yes=b.dataset.page===page;b.classList.toggle('active',yes);if(yes)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
    closeMenu();
    document.title=(page==='home'?'Digitizing Africa':page[0].toUpperCase()+page.slice(1))+' — 1751';
    window.scrollTo({top:0,behavior:'instant'});
    if(page==='store')window.renderStore();if(page==='summit')window.renderEvents();
  };
  window.toggleMenu=function(){let nav=$('#nav'),b=$('#menubtn');let open=nav.classList.toggle('open');b?.setAttribute('aria-expanded',String(open));b?.setAttribute('aria-label',open?'Close menu':'Open menu')};
  function closeMenu(){const nav=$('#nav'),b=$('#menubtn');nav?.classList.remove('open');b?.setAttribute('aria-expanded','false');b?.setAttribute('aria-label','Open menu')}
  document.addEventListener('click',e=>{if(!e.target.closest('.topin'))closeMenu()});
  window.addEventListener('resize',()=>{if(innerWidth>850)closeMenu()});

  function syncOverlay(){const isOpen=$('#modalbg')?.classList.contains('open')||$('#drawerbg')?.classList.contains('open');document.body.style.overflow=isOpen?'hidden':'';}
  function focusDialog(container){const target=container.querySelector('button, input, select, textarea, [tabindex="0"]');(target||container).focus();}
  window.modal=function(html){
    if(!$('#modalbg').classList.contains('open'))lastFocus=document.activeElement;
    $('#modalcontent').innerHTML=html;
    const heading=$('#modalcontent').querySelector('h2');if(heading)heading.id='dialog-title';
    $('#drawerbg').classList.remove('open');$('#modalbg').classList.add('open');
    $('#modalbg').setAttribute('aria-hidden','false');$('#drawerbg').setAttribute('aria-hidden','true');
    syncOverlay();focusDialog($('.modal'));
  };
  window.closeModal=function(){const open=$('#modalbg').classList.contains('open');$('#modalbg').classList.remove('open');$('#modalbg').setAttribute('aria-hidden','true');syncOverlay();if(open && lastFocus?.isConnected)lastFocus.focus()};
  window.openCart=function(){lastFocus=document.activeElement;$('#modalbg').classList.remove('open');$('#modalbg').setAttribute('aria-hidden','true');renderCart();$('#drawerbg').classList.add('open');$('#drawerbg').setAttribute('aria-hidden','false');syncOverlay();focusDialog($('.drawer'))};
  window.closeCart=function(){const open=$('#drawerbg').classList.contains('open');$('#drawerbg').classList.remove('open');$('#drawerbg').setAttribute('aria-hidden','true');syncOverlay();if(open&&lastFocus?.isConnected)lastFocus.focus()};
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if($('#modalbg').classList.contains('open'))closeModal();else if($('#drawerbg').classList.contains('open'))closeCart();else closeMenu();return;}
    if(e.key!=='Tab')return;
    const current=$('.modalbg.open .modal')||$('.drawerbg.open .drawer');if(!current)return;
    const focusable=$$(' .modalbg.open .modal a[href],.modalbg.open .modal button:not(:disabled),.modalbg.open .modal input:not(:disabled),.modalbg.open .modal select:not(:disabled),.modalbg.open .modal textarea:not(:disabled),.drawerbg.open .drawer a[href],.drawerbg.open .drawer button:not(:disabled)');
    if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  });

  window.showPrivacy=function(kind){showInfo(kind,`${kind} must be prepared and approved before public launch.`)};
  window.goToSection=function(page,id){navigate(page);requestAnimationFrame(()=>{document.getElementById(id)?.scrollIntoView({behavior:reducedMotion.matches?'auto':'smooth',block:'start'})})};
  window.goToStory=function(){goToSection('home','stories')};
  window.showServices=function(){goToSection('about','services')};
})();
