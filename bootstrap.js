
const products=[],days=[],schedule=[];
let activeDay=0,view='list',category='All',cart={};
const money=n=>'₦'+Number(n).toLocaleString('en-NG');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
function setView(next){view=next;renderEvents()}
window.onHashChanged=()=>navigate(location.hash.slice(1)||window.routeFromPath?.(location.pathname)||'home');
window.addEventListener('hashchange',window.onHashChanged);

// Static Stage 1 handlers are registered without inline script or runtime evaluation.
const stage1Handlers = {
"navigate('home')": function(event){navigate('home')},
"navigate('summit')": function(event){navigate('summit')},
"navigate('store')": function(event){navigate('store')},
"navigate('community')": function(event){navigate('community')},
"navigate('about')": function(event){navigate('about')},
"openSearch()": function(event){openSearch()},
"openCart()": function(event){openCart()},
"navigate('account')": function(event){navigate('account')},
"toggleMenu()": function(event){toggleMenu()},
"document.querySelector('#ecosystem').scrollIntoView({behavior:'smooth'})": function(event){document.querySelector('#ecosystem').scrollIntoView({behavior:'smooth'})},
"openContact()": function(event){openContact()},
"moveHero(-1)": function(event){moveHero(-1)},
"moveHero(1)": function(event){moveHero(1)},
"pickHero(0)": function(event){pickHero(0)},
"pickHero(1)": function(event){pickHero(1)},
"pickHero(2)": function(event){pickHero(2)},
"pauseHero()": function(event){pauseHero()},
"showInfo('Yolena','A growing initiative in the 1751 ecosystem. More information coming soon.')": function(event){showInfo('Yolena','A growing initiative in the 1751 ecosystem. More information coming soon.')},
"document.getElementById('stories').scrollIntoView({behavior:'smooth'})": function(event){document.getElementById('stories').scrollIntoView({behavior:'smooth'})},
"openContact('Share a student problem')": function(event){openContact('Share a student problem')},
"openStories()": function(event){openStories()},
"openContact('Request training')": function(event){openContact('Request training')},
"openContact('Partner With Us')": function(event){openContact('Partner With Us')},
"openRegister()": function(event){openRegister()},
"document.getElementById('schedule').scrollIntoView({behavior:'smooth'})": function(event){document.getElementById('schedule').scrollIntoView({behavior:'smooth'})},
"setView('list')": function(event){setView('list')},
"setView('calendar')": function(event){setView('calendar')},
"renderStore()": function(event){renderStore()},
"openRegister('Community')": function(event){openRegister('Community')},
"openCommunities()": function(event){openCommunities()},
"navigate('home');setTimeout(()=>document.getElementById('stories').scrollIntoView(),20)": function(event){navigate('home');setTimeout(()=>document.getElementById('stories').scrollIntoView(),20)},
"openContact('Start a Project')": function(event){openContact('Start a Project')},
"openContact('Digital Project')": function(event){openContact('Digital Project')},
"openContact('Request Training')": function(event){openContact('Request Training')},
"return previewNewsletter(event)": function(event){return previewNewsletter(event)},
"navigate('summit');return false;": function(event){navigate('summit');return false;},
"goToSection('summit','schedule');return false;": function(event){goToSection('summit','schedule');return false;},
"openRegister();return false;": function(event){openRegister();return false;},
"navigate('store');return false;": function(event){navigate('store');return false;},
"openRegister('Community');return false;": function(event){openRegister('Community');return false;},
"navigate('community');return false;": function(event){navigate('community');return false;},
"openCommunities();return false;": function(event){openCommunities();return false;},
"navigate('about');return false;": function(event){navigate('about');return false;},
"openContact('Partner With Us');return false;": function(event){openContact('Partner With Us');return false;},
"openContact('Contact 1751');return false;": function(event){openContact('Contact 1751');return false;},
"showPrivacy('Privacy Policy')": function(event){showPrivacy('Privacy Policy')},
"showPrivacy('Terms of Service')": function(event){showPrivacy('Terms of Service')},
"if(event.target===this)closeModal()": function(event){if(event.target===this)closeModal()},
"closeModal()": function(event){closeModal()},
"if(event.target===this)closeCart()": function(event){if(event.target===this)closeCart()},
"closeCart()": function(event){closeCart()},
"openCheckout()": function(event){openCheckout()}
};
for(const eventName of ['click','input','change','submit']){
 for(const element of document.querySelectorAll('[data-on'+eventName+']')){
  const handler=stage1Handlers[element.getAttribute('data-on'+eventName)];
  if(!handler)continue;
  const listener=function(event){if(handler.call(this,event)===false)event.preventDefault()};
  element.addEventListener(eventName,listener);
  element._stage1Handlers={...(element._stage1Handlers||{}),[eventName]:listener};
 }
}
