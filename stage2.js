/* Stage 2 adapter: preserves Stage 1 layout/navigation/dialog behavior. No privileged keys or auth tokens. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const escape = esc;
  const cash = minor => money(minor / 100);
  const uuid = /^[a-f0-9-]{36}$/i;
  const safeImage = value => /^https:\/\//.test(value || '') || /^assets\/img\d+\.webp$/.test(value || '') ? escape(value.startsWith('assets/')?'/'+value:value) : '';
  const button = (label, action, data = {}, cls = 'btn sm') => `<button class="${cls}" data-action="${action}" ${Object.entries(data).map(([k, v]) => `data-${k}="${escape(v)}"`).join(' ')}>${escape(label)}</button>`;
  let user = null, dashboard = null, categories = [], communities = [], summits = [], events = [], selectedSummit = null;
  let catalogOffset = 0, storeGeneration = 0, storyOffset = 0, storyQuery = '', currentCommunity = null, currentPost = null, postOffset = 0;
  let cartRows = [], cartSaveTimer, cartSaveChain = Promise.resolve(), checkoutKey = null, checkoutFingerprint = null;
  let homePromise=null,homeRequested=0,allStories=false;
  function homeContent(){if(!homePromise||Date.now()-homeRequested>30000){homeRequested=Date.now();homePromise=api('home').catch(e=>{homePromise=null;throw e;});}return homePromise;}
  const errors = { service_not_configured: 'This service needs deployment configuration. Please try again after the site owner connects the backend.', sandbox_configuration_required: 'Paystack test credentials must be configured before checkout is available.', auth_rejected: 'Authentication was not accepted. Check your credentials or use password recovery.', unauthorized: 'Please sign in with a verified account to continue.', unavailable_product: 'A cart item is no longer available. Review your cart.', unavailable_product_asset: 'A product file is not ready for delivery. Contact 1751 before purchasing.', physical_fulfillment_not_configured: 'Shipping is not available yet. Please contact 1751 about this item.', invalid_promotion: 'This discount code is unavailable or your order is not eligible.', capacity_full: 'This session is full.', registration_closed: 'Registration has closed for this session.', rate_limited: 'Too many requests. Please wait a minute before retrying.', paid_cancellation_requires_review: 'Paid or pending registrations require team review. Please send a general inquiry with your registration reference.', invalid_or_expired: 'This link is invalid or has expired. Request a new confirmation or recovery email.', network_error: 'Unable to reach the server. Check your connection and retry.', conflict: 'This request has changed. Review the details and try again.', payment_provider_unavailable: 'The payment provider is unavailable. Your pending order is saved; you can retry from your order details.', storage_unavailable: 'The download service is unavailable. Your purchase remains saved; please retry.' };
  const errorMessage = e => errors[e.code] || `Request failed (${e.code || 'server_error'}). Please retry or contact 1751.`;
  async function api(path, body) {
    let r;
    try { r = await fetch(`/api/${path}`, { credentials: 'same-origin', ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-1751-Request': '1' }, body: JSON.stringify(body) } : {}) }); }
    catch { throw { code: 'network_error' }; }
    let result;
    try { result = await r.json(); } catch { throw { code: 'server_error' }; }
    if (!r.ok) {
      if (r.status === 401 && user) { user = null; $('#account-button').textContent = 'Sign in'; }
      throw { code: result.error, status: r.status, order: result.order };
    }
    return result;
  }
  function status(node, message, bad = false) { if (node) { node.textContent = message; node.className = bad ? 'form-error' : 'status-message'; node.setAttribute('role', bad ? 'alert' : 'status'); } }
  function empty(message, retry) { return `<div class="empty"><p>${escape(message)}</p>${retry ? button('Retry', retry) : ''}</div>`; }
  const loading = '<p class="loading" role="status">Loading…</p>';
  function notice(message, bad = false) {
    let el = $('#platform-note');
    if (!el) { el = document.createElement('div'); el.id = 'platform-note'; document.querySelector('header').after(el); }
    el.className = `platform-note${bad ? ' error' : ''}`; el.setAttribute('role', bad ? 'alert' : 'status'); el.textContent = message;
  }
  function dates(value, timezone = 'Africa/Lagos', time = true) {
    try { return new Intl.DateTimeFormat('en-NG', { timeZone: timezone, dateStyle: 'medium', ...(time ? { timeStyle: 'short' } : {}) }).format(new Date(value)); }
    catch { return 'Date unavailable'; }
  }
  function actionForm(action, title, fields, label = 'Continue', extra = '') {
    return `<h2>${escape(title)}</h2><form class="formgrid account-form" data-form="${action}" ${extra}>${fields}<p data-feedback aria-live="polite"></p><button type="submit" class="btn">${escape(label)}</button></form>`;
  }
  const field = (label, name, type = 'text', value = '', attrs = '') => `<label>${escape(label)}<input name="${name}" type="${type}" value="${escape(value)}" ${attrs}></label>`;
  const consentField = '<label class="consent"><input name="consent" type="checkbox" required> I consent to 1751 processing this information for this request.</label>';
  const honeypot = '<label class="honeypot" aria-hidden="true">Leave empty<input name="website" tabindex="-1" autocomplete="off"></label>';
  async function refreshSession() {
    const session = await api('auth/session'); user = session.user;
    $('#account-button').textContent = user ? 'My account' : 'Sign in';
    return user;
  }
  const originalNavigate = window.navigate;
  window.navigate = function (route = 'home') {
    route = route || 'home';
    const base = route.split('/')[0];
    if (['home', 'store', 'summit', 'community', 'about'].includes(base)) {
      originalNavigate(base);
      if (base === 'community') loadCommunities();
      return;
    }
    const page = ['story','product','event'].includes(base) ? 'story' : ['discussion', 'post'].includes(base) ? 'discussion' : 'account';
    if (location.hash !== '#' + route) location.hash = route;
    document.querySelectorAll('.page').forEach(p => { const active = p.id === 'page-' + page; p.classList.toggle('active', active); p.setAttribute('aria-hidden', String(!active)); });
    document.querySelectorAll('[data-page]').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
    $('#nav').classList.remove('open'); $('#menubtn').setAttribute('aria-expanded', 'false');
    window.scrollTo(0, 0); document.title = `1751 · ${page === 'account' ? 'Your account' : 'Stories & community'}`;
    if (base === 'story') loadArticle(route.slice(6));
    else if(base==='product')window.loadProductPage?.(route.slice(8));
    else if(base==='event')window.loadEventPage?.(route.slice(6));
    else if (base === 'discussion') loadPosts(route.split('/')[1]);
    else if (base === 'post') loadPost(route.split('/')[1]);
    else if (base === 'newsletter') renderNewsletterAction(route);
    else if (base === 'verify') renderAuthVerification(route);
    else if (base === 'order') showOrder(route.split('/')[1], route.split('/')[2], true);
    else if (base === 'payment') paymentReturn();
    else renderAccount();
  };
  function mapProduct(p) { return { ...p, name: p.title, price: p.price_minor / 100, image: p.image_url, category: p.category || 'Resources' }; }
  window.prodCard = function(p) {
    const image = safeImage(p.image_url);
    return `<article class="product"><div class="product-image">${image ? `<img loading="lazy" src="${image}" alt="${escape(p.title)}">` : `<div class="fake-cover">1751<br>${escape(p.title)}</div>`}<span class="product-meta">${escape(p.category || 'Resources')}</span></div><div class="product-body"><h3>${escape(p.title)}</h3><p class="product-desc">${escape(p.description)}</p><div class="price">${cash(p.price_minor)}</div><div class="product-actions">${button('View Product →', 'product', { id: p.id }, 'btn ghost sm')}${button('Add +', 'add', { id: p.id })}</div></div></article>`;
  };
  window.renderStore = async function (append = false) {
    if (!append) catalogOffset = 0;
    const generation = ++storeGeneration;
    $('#filters').innerHTML = ['All', ...categories].map(c => button(c, 'category', { value: c }, `tab ${c === category ? 'selected' : ''}`)).join('');
    if (!append) $('#storeproducts').innerHTML = loading;
    const q = new URLSearchParams({ q: $('#productsearch').value.trim(), category, sort: $('#sort').value, limit: '20', offset: String(catalogOffset) });
    try {
      const list = await api(`products?${q}`); if (generation !== storeGeneration) return;
      for (const p of list) { const i = products.findIndex(x => x.id === p.id); if (i < 0) products.push(mapProduct(p)); else products[i] = mapProduct(p); }
      if (!append) $('#storeproducts').innerHTML = '';
      $('#storeproducts').querySelector('.load-more')?.remove();
      $('#storeproducts').insertAdjacentHTML('beforeend', list.map(prodCard).join(''));
      catalogOffset += list.length;
      if (!catalogOffset) $('#storeproducts').innerHTML = empty('No published resources match your search.');
      if (list.length === 20) $('#storeproducts').insertAdjacentHTML('beforeend', button('Load more', 'more-products', {}, 'btn outline load-more'));
      $('#product-count').textContent = `${catalogOffset} published resources shown`;
    } catch (e) { if (generation === storeGeneration) { $('#storeproducts').innerHTML = empty(errorMessage(e), 'store'); $('#product-count').textContent = 'Catalog unavailable'; } }
  };
  window.clearStoreFilters = function () { category = 'All'; $('#productsearch').value = ''; $('#sort').value = 'featured'; renderStore(); };
  async function loadHomeProducts() {
    try {
      const list = (await homeContent()).products; $('#homeproducts').innerHTML = list.length ? list.map(prodCard).join('') : empty('Resources will appear here when published.');
      if (list.length) {
        $('#featured-title').textContent = list[0].title;
        $('#featured-price').textContent = cash(list[0].price_minor);
        const b = $('#featured-buy'); b.textContent = 'Buy Now'; if (b._stage1Handlers?.click) b.removeEventListener('click', b._stage1Handlers.click); b.dataset.action = 'add'; b.dataset.id = list[0].id;
        if (safeImage(list[0].image_url)) $('.store-banner img').src = list[0].image_url;
        $('.store-banner .copy p').textContent = list[0].description;
      }
    } catch (e) { $('#homeproducts').innerHTML = empty(errorMessage(e), 'home-products'); }
  }
  window.showProductDetail = async function (productId) {
    modal(`<h2 id="dialog-title">Product details</h2>${loading}`);
    try {
      const list = await api(`product?id=${encodeURIComponent(productId)}`), p = list[0];
      if (!p) { modal(`<h2 id="dialog-title">Product unavailable</h2>${empty('This product is no longer available.')}`); return; }
      const image = safeImage(p.image_url);
      const related = await api(`products?category=${encodeURIComponent(p.category || 'All')}&limit=4`);
      modal(`<span class="eyebrow">1751 Store · ${escape(p.category || 'Resources')}</span><div class="detail-layout"><div class="detail-visual">${image ? `<img src="${image}" alt="${escape(p.title)}">` : '1751'}</div><div><h2 id="dialog-title">${escape(p.title)}</h2><p class="article-body">${escape(p.description)}</p><p class="price">${cash(p.price_minor)}</p><p class="muted">${escape(p.product_type)} · NGN</p>${button('Add to cart', 'add', { id: p.id })}</div></div>${related.some(r => r.id !== p.id) ? `<h3>Related resources</h3>${related.filter(r => r.id !== p.id).map(r => button(r.title, 'product', { id: r.id }, 'btn ghost sm')).join(' ')}` : ''}`);
    } catch (e) { modal(`<h2 id="dialog-title">Product details unavailable</h2>${empty(errorMessage(e))}`); }
  };
  // Guest storage contains IDs and quantities only. Every price and entitlement is enforced on the server.
  try { const saved = JSON.parse(localStorage.getItem('1751-stage2-cart') || '{}'); cart = Object.fromEntries(Object.entries(saved).filter(([k, v]) => uuid.test(k) && Number.isInteger(v) && v >= 1 && v <= 99)); } catch { cart = {}; }
  function persistCart() {
    try { if (user) localStorage.removeItem('1751-stage2-cart'); else localStorage.setItem('1751-stage2-cart', JSON.stringify(cart)); } catch { notice('Cart changes are available for this session only.'); }
    $('#cartnum').textContent = Object.values(cart).reduce((s, n) => s + n, 0);
    if (user) {
      clearTimeout(cartSaveTimer);
      cartSaveTimer = setTimeout(() => {
        const items = Object.entries(cart).map(([id, quantity]) => ({ id, quantity }));
        cartSaveChain = cartSaveChain.then(() => api('cart', { items })).catch(e => notice(`Your account cart was not saved. ${errorMessage(e)}`, true));
      }, 250);
    }
  }
  async function mergeAccountCart() {
    if (!user) return;
    const saved = await api('cart');
    for (const r of saved) cart[r.id] = Math.max(cart[r.id] || 0, r.quantity);
    persistCart();
  }
  window.saveCart = persistCart;
  window.addToCart = async function (productId) {
    try {
      const p = (await api(`product?id=${encodeURIComponent(productId)}`))[0];
      if (!p) throw { code: 'unavailable_product' };
      cart[p.id] = p.product_type === 'physical' ? Math.min(99, (cart[p.id] || 0) + 1) : 1;
      persistCart(); toast(`${p.title} added to cart`); if ($('#drawerbg').classList.contains('open')) renderCart();
    } catch (e) { notice(errorMessage(e), true); }
  };
  window.adjustCart = function (id, delta) { cart[id] = Math.max(0, Math.min(99, (cart[id] || 0) + delta)); if (!cart[id]) delete cart[id]; persistCart(); renderCart(); };
  window.renderCart = async function () {
    $('#cartitems').innerHTML = loading; $('#cartcheckout').disabled = true;
    try {
      cartRows = await Promise.all(Object.keys(cart).map(async id => { const p = (await api(`product?id=${id}`))[0]; return p || { id, title: 'Unavailable item', available: false, price_minor: 0 }; }));
      $('#cartitems').innerHTML = cartRows.length ? cartRows.map(p => `<div class="cartrow"><div><b>${escape(p.title)}</b><br><small>${p.available === false ? 'Remove this unavailable item before checkout.' : `${cash(p.price_minor)} each · Line total ${cash(p.price_minor * cart[p.id])}`}</small></div><div class="cartactions">${button('Remove', 'remove', { id: p.id }, 'textlink')}${p.product_type === 'physical' ? button('−', 'quantity', { id: p.id, delta: -1 }, 'textlink') + escape(cart[p.id]) + button('+', 'quantity', { id: p.id, delta: 1 }, 'textlink') : ''}</div></div>`).join('') : empty('Your cart is empty.');
      $('#carttotal').textContent = cash(cartRows.reduce((s, p) => s + p.price_minor * cart[p.id], 0));
      $('#cartcheckout').disabled = !cartRows.length || cartRows.some(p => p.available === false);
    } catch (e) { $('#cartitems').innerHTML = empty(errorMessage(e), 'cart'); }
  };
  window.openCheckout = function () {
    closeCart();
    if (!Object.keys(cart).length) { toast('Your cart is empty.'); return; }
    const fingerprint = JSON.stringify(cart);
    if (checkoutFingerprint !== fingerprint) { checkoutKey = crypto.randomUUID(); checkoutFingerprint = fingerprint; }
    modal(actionForm('checkout', 'Review & checkout', `<p>Paystack hosted checkout · NGN · Test mode</p><div>${cartRows.map(p => `<p>${escape(p.title)} × ${cart[p.id]} · ${cash(p.price_minor * cart[p.id])}</p>`).join('')}</div><p>The server checks the current prices and availability before creating your order.</p>${field('Full name', 'name', 'text', user?.display_name || '', 'required minlength="2" maxlength="100" autocomplete="name"')}${field('Email', 'email', 'email', user?.email || '', `required maxlength="254" autocomplete="email" ${user ? 'readonly' : ''}`)}${field('Discount code (optional)', 'promotion', 'text', '', 'maxlength="50"')}`, 'Create order & pay'));
  };
  function rememberOrder(data) { try { sessionStorage.setItem('1751-current-order', JSON.stringify({ reference: data.reference, access_token: data.access_token })); } catch { /* Link remains available in the confirmation UI. */ } }
  async function showOrder(reference, accessToken, inPage = false) {
    const target = () => inPage ? $('#account-content') : $('#modalcontent');
    if (!inPage) modal(`<h2 id="dialog-title">Order details</h2>${loading}`); else target().innerHTML = loading;
    try {
      const o = await api('orders', { reference, ...(accessToken ? { access_token: accessToken } : {}) });
      const data = { reference, ...(accessToken ? { token: accessToken } : {}) };
      target().innerHTML = `<h2 id="dialog-title">Order ${escape(o.reference)}</h2><p class="status-pill">${escape(o.status)}</p><p>Total ${cash(o.total_minor)}</p>${o.fulfillment_hold ? '<p class="form-error">Your payment needs team review before the event registration can be fulfilled. Contact 1751 with this reference.</p>' : ''}${o.items.map(i => `<div class="mini-row"><b>${escape(i.title)}</b><p>${i.quantity} × ${cash(i.unit_minor)}</p>${i.assets.map(a => button('Download (link valid for 60 seconds)', 'download', { ...data, asset: a.id })).join(' ')}</div>`).join('')}<div class="inline-actions">${!['paid', 'refunded'].includes(o.status) ? button('Check payment status', 'verify-payment', data) + (o.checkout_url ? `<a class="btn outline sm" href="${escape(o.checkout_url)}" rel="noreferrer">Continue hosted checkout</a>` : button('Retry payment setup', 'retry-payment', data)) : ''}${button('Account dashboard', 'account', {}, 'btn ghost sm')}</div><p data-order-feedback role="status"></p>`;
    } catch (e) { target().innerHTML = `<h2 id="dialog-title">Order unavailable</h2>${empty(errorMessage(e))}`; }
  }
  async function paymentReturn() {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem('1751-current-order') || 'null'); } catch { saved = null; }
    const url = new URL(location.href), reference = url.searchParams.get('reference') || url.searchParams.get('trxref') || saved?.reference;
    history.replaceState(null, '', '/#payment');
    if (!reference) { $('#account-content').innerHTML = empty('Open your order from your dashboard or the receipt link to check payment.'); return; }
    try { const r = await api('payments/verify', { reference, ...(saved?.reference === reference && saved.access_token ? { access_token: saved.access_token } : {}) }); if (r.status === 'paid') { cart = {}; checkoutFingerprint = null; persistCart(); } } catch (e) { notice(errorMessage(e), true); }
    showOrder(reference, saved?.reference === reference ? saved.access_token : null, true);
  }
  async function loadSummits() {
    try {
      summits = await api('summits');
      selectedSummit = summits.find(s => s.id === selectedSummit?.id) || summits.find(s => s.ends_on >= new Date().toISOString().slice(0, 10)) || summits[0];
      let selector = $('#summit-selector');
      if (!selector) { selector = document.createElement('div'); selector.id = 'summit-selector'; selector.className = 'session-control'; $('#daytabs').before(selector); }
      selector.innerHTML = summits.length ? `<label>Programme <select class="field" data-select="summit">${summits.map(s => `<option value="${s.id}" ${selectedSummit.id === s.id ? 'selected' : ''}>${escape(s.title)}</option>`).join('')}</select></label>` : '';
      events = []; days.splice(0);
      if (selectedSummit) {
        const start = new Date(selectedSummit.starts_on + 'T12:00:00Z'), end = new Date(selectedSummit.ends_on + 'T12:00:00Z');
        for (let d = start; d <= end && days.length < 366; d = new Date(d.getTime() + 86400000)) days.push(d.toISOString().slice(0, 10));
        for (let offset = 0; offset < 10000; offset += 50) { const batch = await api(`events?summit_id=${selectedSummit.id}&limit=50&offset=${offset}`); events.push(...batch); if (batch.length < 50) break; }
      }
      activeDay = 0; $('#summit-days').textContent = days.length || '—'; $('#summit-count').textContent = events.length; renderEvents();
    } catch (e) { $('#events').innerHTML = empty(errorMessage(e), 'summits'); }
  }
  const eventDay = e => new Intl.DateTimeFormat('en-CA', { timeZone: selectedSummit?.timezone || e.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(e.starts_at));
  window.renderEvents = function () {
    if (!selectedSummit) { window.renderReferenceDaily?.([],[],0); $('#daytabs').innerHTML = ''; $('#events').innerHTML = empty('No published programme is available yet.'); return; }
    $('#daytabs').innerHTML = days.map((d, i) => button(`Day ${i + 1} · ${dates(d + 'T12:00:00Z', 'UTC', false)}`, 'day', { index: i }, `tab ${i === activeDay ? 'selected' : ''}`)).join('');
    $('#listbtn').classList.toggle('selected', view === 'list'); $('#calbtn').classList.toggle('selected', view === 'calendar');
    $('#listbtn').setAttribute('aria-pressed', String(view === 'list')); $('#calbtn').setAttribute('aria-pressed', String(view === 'calendar'));
    const list = events.filter(e => eventDay(e) === days[activeDay]);
    $('#events').removeAttribute('aria-labelledby');
    window.renderReferenceDaily?.(days,list,activeDay);
    if (view === 'calendar' && window.renderReferenceMonth) {window.renderReferenceMonth(days,events,eventDay);return;}
    $('#events').innerHTML = `<p class="muted">${escape(selectedSummit.title)} · ${escape(selectedSummit.timezone)}</p>` + (list.length ? `<div class="event-list">${list.map(e => `<article class="event"><div class="datebox"><b>${dates(e.starts_at, e.timezone, false)}</b></div><div><span class="eyebrow">${escape(e.category)}</span><h3>${escape(e.title)}</h3><p>${dates(e.starts_at, e.timezone)} – ${dates(e.ends_at, e.timezone)} · ${escape(e.location || 'Venue details on confirmation')}</p></div>${button('View details ↗', 'event', { id: e.id }, 'btn outline sm')}</article>`).join('')}</div>` : empty('No published sessions for this day.'));
  };
  window.selectDay = i => { if (i >= 0 && i < days.length) { activeDay = i; view = 'list'; renderEvents(); } };
  window.showEvent = async function (eventId) {
    modal(`<h2 id="dialog-title">Session details</h2>${loading}`);
    try {
      const e = (await api(`event?id=${eventId}`))[0]; if (!e) throw { code: 'not_found' };
      modal(`<span class="eyebrow">1751 Summit</span><h2 id="dialog-title">${escape(e.title)}</h2><p class="article-body">${escape(e.description)}</p><div class="event-details"><div><b>Date/time</b><span>${dates(e.starts_at, e.timezone)} – ${dates(e.ends_at, e.timezone)} (${escape(e.timezone)})</span></div><div><b>Your local time</b><span>${dates(e.starts_at, Intl.DateTimeFormat().resolvedOptions().timeZone)}</span></div><div><b>Speakers</b><span>${e.speakers.map(s => escape(s.name)).join(', ') || 'Not announced'}</span></div><div><b>Registration</b><span>${e.price_minor ? cash(e.price_minor) : 'Free'} · ${e.registration_open ? 'Open until ' + dates(e.registration_closes_at, e.timezone) : 'Closed'}</span></div></div><p>${e.cancellation_allowed ? 'Free registrations can be cancelled before the event. Paid cancellations require team review.' : 'Cancellation is not enabled for this session.'}</p>${e.registration_open ? button('Register for this session', 'register-event', { id: e.id }) : ''}`);
    } catch (e) { modal(`<h2 id="dialog-title">Session unavailable</h2>${empty(errorMessage(e))}`); }
  };
  window.openRegister = function (kind = 'Summit', sessionId) {
    if (kind === 'Community') { openCommunities(); return; }
    if (!sessionId) { navigate('summit'); $('#schedule').scrollIntoView({ behavior: 'smooth' }); toast('Select a published session to register.'); return; }
    if (!user) { closeModal(); navigate('account'); notice('Sign in to register and keep the event in your dashboard.'); return; }
    modal(actionForm('registration', 'Register for this session', `${field('Full name', 'name', 'text', user.display_name, 'required minlength="2" maxlength="100"')}${field('Account email', 'email', 'email', user.email, 'readonly')}<p>Availability is checked when you submit. A paid session stays pending until verified payment.</p>`, 'Submit registration', `data-session="${escape(sessionId)}"`));
  };
  window.openContact = function (subject = 'Start a project') {
    const type = /training/i.test(subject) ? 'training' : /partner/i.test(subject) ? 'partnership' : /contact|student problem/i.test(subject) ? 'general' : 'project';
    modal(actionForm('inquiry', subject, `${field('Full name', 'name', 'text', user?.display_name || '', 'required minlength="2" maxlength="100"')}${field('Email', 'email', 'email', user?.email || '', 'required maxlength="254"')}${field('Organization (optional)', 'organization', 'text', '', 'maxlength="150"')}<label>Inquiry type<select name="type">${['project', 'training', 'partnership', 'general'].map(t => `<option ${t === type ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label>Description<textarea name="message" required minlength="10" maxlength="5000"></textarea></label>${field('Budget range (optional)', 'budget', 'text', '', 'maxlength="100"')}<label>Preferred contact<select name="contact_method"><option value="email">Email</option><option value="phone">Phone</option></select></label>${field('Phone (required for phone contact)', 'phone', 'tel', '', 'maxlength="30"')}${consentField}${honeypot}`, 'Send inquiry', `data-key="${crypto.randomUUID()}"`));
  };
  window.previewNewsletter = function (event) { event.preventDefault(); submitForm(event.currentTarget, 'newsletter'); return false; };
  async function loadStories(append = false) {
    if (!append) { storyOffset = 0; $('#stories-list').innerHTML = loading; }
    try {
      const categoryValue = $('#story-category')?.value || '';
      const list = !allStories&&!storyQuery&&!categoryValue&&!append?(await homeContent()).articles:await api(`articles?${new URLSearchParams({ q: storyQuery, ...(categoryValue ? { category: categoryValue } : {}), offset: String(storyOffset), limit: '12' })}`);
      if (!append) $('#stories-list').innerHTML = '';
      $('#stories-list').querySelector('.load-more')?.remove();
      $('#stories-list').insertAdjacentHTML('beforeend', list.map(a => `<article class="story">${safeImage(a.cover_image) ? `<img loading="lazy" src="${safeImage(a.cover_image)}" alt="${escape(a.title)}">` : ''}<div><span class="eyebrow">${escape(a.category)}</span><h3>${escape(a.title)}</h3><p>${escape(a.excerpt)}</p><p class="content-meta">${escape(a.author)} · ${dates(a.published_at, 'Africa/Lagos', false)} · ${a.reading_minutes} min</p><a class="story-action" href="#story/${escape(a.slug)}">Read story →</a></div></article>`).join(''));
      storyOffset += list.length;
      if (!storyOffset) $('#stories-list').innerHTML = empty('No published stories match this search.');
      if (list.length === 12) $('#stories-list').insertAdjacentHTML('beforeend', button('More stories', 'more-stories', {}, 'btn outline load-more'));
    } catch (e) { $('#stories-list').innerHTML = empty(errorMessage(e), 'stories'); }
  }
  window.openStories = () => { allStories=true;loadStories();navigate('home'); $('#stories').scrollIntoView({ behavior: 'smooth' }); };
  window.goToStory = window.openStories;
  async function loadArticle(slug) {
    $('#article-content').innerHTML = loading;
    try {
      const a = (await api(`article?slug=${encodeURIComponent(slug)}`))[0]; if (!a) throw { code: 'not_found' };
      document.title = `${a.title} — 1751`;
      const related = await api(`articles?category=${encodeURIComponent(a.category)}&limit=4`);
      $('#article-content').innerHTML = `<article class="article-layout"><a href="#home">← All stories</a><span class="eyebrow">${escape(a.category)}</span><h1>${escape(a.title)}</h1><p class="content-meta">${escape(a.author)} · ${dates(a.published_at, 'Africa/Lagos', false)} · ${a.reading_minutes} min read</p>${safeImage(a.cover_image) ? `<img class="article-cover" src="${safeImage(a.cover_image)}" alt="${escape(a.title)}">` : ''}<p class="lead">${escape(a.excerpt)}</p><div class="article-body">${escape(a.body)}</div><div class="inline-actions">${button('Share story', 'share')}<a class="btn outline sm" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent(a.title + ' ' + location.href)}">Share on WhatsApp</a></div>${related.filter(r => r.id !== a.id).length ? '<h2>Related stories</h2>' + related.filter(r => r.id !== a.id).map(r => `<p><a href="#story/${escape(r.slug)}">${escape(r.title)}</a></p>`).join('') : ''}</article>`;
    } catch (e) { $('#article-content').innerHTML = empty(errorMessage(e)); }
  }
  async function loadCommunities() {
    $('#communities-list').innerHTML = loading;
    try {
      communities = await api('communities');
      $('#communities-list').innerHTML = communities.length ? communities.map(c => `<article class="eco-card"><span class="glyph">◎</span><h3>${escape(c.name)}</h3><p>${escape(c.description)}</p><p class="community-count">${escape(c.visibility)} space · ${c.member ? 'You are a member' : 'Not a member'}</p><div class="inline-actions">${button('Discussions', 'discussion', { id: c.id }, 'btn outline sm')}${c.member || c.join_open ? button(c.member ? 'Leave' : 'Join', 'membership', { id: c.id, join: !c.member }) : ''}</div></article>`).join('') : empty('No communities have been published yet.');
    } catch (e) { $('#communities-list').innerHTML = empty(errorMessage(e), 'communities'); }
  }
  window.openCommunities = () => { navigate('community'); $('#communities-list').scrollIntoView({ behavior: 'smooth' }); };
  async function loadPosts(communityId, append = false) {
    const el = $('#discussion-content');
    if (!append) { postOffset = 0; el.innerHTML = loading; }
    try {
      if (!append) {
        communities = await api('communities'); currentCommunity = communities.find(c => c.id === communityId); if (!currentCommunity) throw { code: 'not_found' };
        el.innerHTML = `<a href="#community">← Communities</a><h1>${escape(currentCommunity.name)}</h1><p>${escape(currentCommunity.description)}</p><div class="inline-actions">${currentCommunity.member ? button('New post', 'new-post') : button('Join to participate', 'membership', { id: communityId, join: true })}</div><form class="forum-search" data-form="post-search"><input name="q" class="field" placeholder="Search discussions" maxlength="100"><select name="category_id" class="field"><option value="">All categories</option>${currentCommunity.categories.map(c => `<option value="${c.id}">${escape(c.name)}</option>`).join('')}</select><button class="btn">Search</button></form><div id="posts-list"></div>`;
      }
      const form = $('.forum-search'), q = form?.elements.q.value || '', cat = form?.elements.category_id.value || '';
      const list = await api(`posts?${new URLSearchParams({ community_id: communityId, q, ...(cat ? { category_id: cat } : {}), limit: '20', offset: String(postOffset) })}`);
      const target = $('#posts-list'); if (!append) target.innerHTML = ''; target.querySelector('.load-more')?.remove();
      target.insertAdjacentHTML('beforeend', list.map(p => `<article class="discussion-card"><h2 class="post-title"><a href="#post/${p.id}">${escape(p.title)}</a></h2><p class="content-meta">${escape(p.author)} · ${dates(p.created_at)}</p><p>${escape(p.body.slice(0, 220))}</p></article>`).join(''));
      postOffset += list.length; if (!postOffset) target.innerHTML = empty('No discussions found.');
      if (list.length === 20) target.insertAdjacentHTML('beforeend', button('More discussions', 'more-posts', {}, 'btn outline load-more'));
    } catch (e) { el.innerHTML = empty(errorMessage(e)); }
  }
  async function loadPost(postId) {
    $('#discussion-content').innerHTML = loading;
    try {
      const p = (await api(`post?id=${postId}`))[0]; if (!p) throw { code: 'not_found' }; currentPost = p;
      communities = await api('communities'); currentCommunity = communities.find(c => c.id === p.community_id);
      const mine = user?.id === p.author_id, member = currentCommunity?.member;
      $('#discussion-content').innerHTML = `<a href="#discussion/${p.community_id}">← Discussions</a><article class="discussion-card"><h1>${escape(p.title)}</h1><p class="content-meta">${escape(p.author)} · ${dates(p.created_at)}</p><div class="post-body">${escape(p.body)}</div><div class="inline-actions">${mine ? button('Edit', 'edit-post') + button('Delete', 'delete-post', { id: p.id }) : ''}${member ? button('Report', 'report', { post: p.id }) : ''}</div><h2>Replies</h2>${p.comments.map(c => `<div class="comment"><b>${escape(c.author)}</b><span class="content-meta"> · ${dates(c.created_at)}</span>${c.parent_id ? '<p class="content-meta">Reply to a comment</p>' : ''}<div class="post-body">${escape(c.body)}</div><div class="inline-actions">${member ? button('Reply', 'reply', { id: c.id }) + button('Report', 'report', { comment: c.id }) : ''}${user?.id === c.author_id ? button('Edit', 'edit-comment', { id: c.id }) + button('Delete', 'delete-comment', { id: c.id }) : ''}</div></div>`).join('')}${member ? actionForm('comment', 'Add a reply', '<label>Your reply<textarea name="body" required minlength="2" maxlength="5000"></textarea></label>', 'Post reply') : '<p>Join this community to reply.</p>'}</article>`;
    } catch (e) { $('#discussion-content').innerHTML = empty(errorMessage(e)); }
  }
  function postForm(edit = false) {
    if (!user) return navigate('account');
    modal(actionForm(edit ? 'edit-post' : 'new-post', edit ? 'Edit your post' : 'New discussion', `${field('Title', 'title', 'text', edit ? currentPost.title : '', 'required minlength="3" maxlength="180"')}<label>Category<select name="category_id"><option value="">Uncategorized</option>${currentCommunity.categories.map(c => `<option value="${c.id}" ${edit && currentPost.category_id === c.id ? 'selected' : ''}>${escape(c.name)}</option>`).join('')}</select></label><label>Post<textarea name="body" required minlength="3" maxlength="10000">${edit ? escape(currentPost.body) : ''}</textarea></label>`, 'Save post'));
  }
  function renderSignIn(mode = 'login') {
    const container = $('#account-content');
    const fields = mode === 'signup' ? field('Display name', 'display_name', 'text', '', 'required minlength="2" maxlength="100" autocomplete="nickname"') : '';
    container.innerHTML = `<div class="inline-actions">${button('Sign in', 'auth-mode', { mode: 'login' })}${button('Create account', 'auth-mode', { mode: 'signup' }, 'btn outline sm')}${button('Password recovery', 'auth-mode', { mode: 'recover' }, 'btn ghost sm')}</div>` + actionForm(`auth-${mode}`, mode === 'signup' ? 'Create your account' : mode === 'recover' ? 'Recover your account' : 'Sign in', fields + field('Email', 'email', 'email', '', 'required maxlength="254" autocomplete="email"') + (mode !== 'recover' ? field('Password (at least 12 characters)', 'password', 'password', '', `required minlength="12" maxlength="128" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"`) : ''), mode === 'signup' ? 'Send verification email' : mode === 'recover' ? 'Send recovery email' : 'Sign in');
  }
  async function renderAccount() {
    $('#account-content').innerHTML = loading;
    try {
      await refreshSession();
      if (!user) return renderSignIn();
      dashboard = await api('dashboard');
      $('#account-content').innerHTML = `<p>Welcome, ${escape(dashboard.profile?.display_name || user.display_name || user.email)}.</p><div class="inline-actions">${button('Refresh dashboard', 'account')}${button('Sign out', 'logout', {}, 'btn outline sm')}</div><div class="dashboard-grid"><section class="dashboard-card"><h2>Profile</h2>${actionForm('profile', 'Edit profile', `${field('Display name', 'display_name', 'text', dashboard.profile?.display_name || user.display_name || '', 'required minlength="2" maxlength="100"')}${field('Profile image URL (optional)', 'avatar_url', 'url', dashboard.profile?.avatar_url || '', 'maxlength="1000"')}`, 'Save profile')}<p class="content-meta">${escape(user.email)} · Joined ${dates(user.created_at, 'Africa/Lagos', false)}</p></section><section class="dashboard-card"><h2>Registered events</h2>${dashboard.registrations.length ? dashboard.registrations.map(r => `<div class="mini-row"><b>${escape(r.title)}</b><p>${dates(r.starts_at, r.timezone)} · ${escape(r.status)}</p><small>${escape(r.reference)}</small>${r.meeting_url && /^https:\/\//.test(r.meeting_url) ? `<p><a href="${escape(r.meeting_url)}" rel="noreferrer">Join meeting</a></p>` : ''}<div class="inline-actions">${r.status === 'confirmed' ? button('Calendar invite', 'calendar', { id: r.id }) : ''}${r.status !== 'cancelled' && r.cancellation_allowed ? button('Cancel / request review', 'cancel-registration', { id: r.id }, 'btn outline sm') : ''}${r.order_reference ? button('Payment details', 'order', { reference: r.order_reference }) : ''}</div></div>`).join('') : '<p>No registrations yet.</p>'}</section><section class="dashboard-card"><h2>Orders & downloads</h2>${dashboard.orders.length ? dashboard.orders.map(o => `<div class="mini-row"><b>${escape(o.reference)}</b><p>${cash(o.total_minor)} · ${escape(o.status)} · ${dates(o.created_at)}</p>${button('Details & downloads', 'order', { reference: o.reference })}</div>`).join('') : '<p>No orders yet. Guest purchases remain accessible using their private receipt link.</p>'}</section><section class="dashboard-card"><h2>Community activity</h2>${dashboard.memberships.map(c => `<p><a href="#discussion/${c.id}">${escape(c.name)}</a></p>`).join('') || '<p>No memberships yet.</p>'}${dashboard.posts.map(p => `<p><a href="#post/${p.id}">${escape(p.title)}</a></p>`).join('')}</section><section class="dashboard-card"><h2>Account settings</h2>${actionForm('password', 'Change password', field('New password', 'password', 'password', '', 'required minlength="12" maxlength="128" autocomplete="new-password"'), 'Change password')}<p>Account deletion is reviewed by the team to handle purchases and required financial retention.</p>${dashboard.deletion_requested ? '<p>Deletion request recorded.</p>' : button('Request account deletion', 'delete-account', {}, 'btn outline sm')}</section>${dashboard.roles.length ? `<section class="dashboard-card"><h2>Moderation</h2>${button('Review reports', 'moderation')} ${actionForm('check-in', 'Record event attendance', field('Registration reference', 'reference', 'text', '', 'required maxlength="100"'), 'Check in')}</section>` : ''}</div>`;
    } catch (e) { $('#account-content').innerHTML = empty(errorMessage(e), 'account'); }
  }
  function renderNewsletterAction(route) {
    const [, action, t] = route.split('/');
    if (!['confirm', 'unsubscribe'].includes(action) || !/^[a-f0-9]{64}$/.test(t || '')) { $('#account-content').innerHTML = empty('Invalid newsletter link.'); return; }
    $('#account-content').innerHTML = actionForm('newsletter-action', action === 'confirm' ? 'Confirm subscription' : 'Unsubscribe', `<p>${action === 'confirm' ? 'Confirm you want to receive 1751 updates.' : 'Stop receiving 1751 newsletter emails.'}</p>`, action === 'confirm' ? 'Confirm subscription' : 'Unsubscribe', `data-type="${action}" data-token="${t}"`);
  }
  function renderAuthVerification(route) {
    const [, type, t] = route.split('/');
    $('#account-content').innerHTML = actionForm('auth-verify', type === 'recovery' ? 'Recover your account' : 'Verify your email', '<p>Continue to securely verify this email link.</p>', 'Verify email link', `data-type="${escape(type)}" data-token="${escape(t || '')}"`);
    // Remove link capability from history after keeping it in the form.
    history.replaceState(null, '', '/#account');
  }
  window.openSearch = function () {
    modal('<span class="eyebrow">Discover 1751</span><h2 id="dialog-title">Search</h2><form data-form="search" class="site-search"><label for="site-search-input">Public products, events, stories and pages</label><input id="site-search-input" name="q" class="field" maxlength="100" type="search"><button class="btn sm" type="submit">Search</button></form><div id="site-search-results" class="site-search-results" role="region" aria-live="polite" aria-label="Search results"></div>'); $('#site-search-input').focus();
  };
  async function searchSite(query) {
    $('#site-search-results').innerHTML = loading;
    try {
      const r = await api(`search?q=${encodeURIComponent(query)}&limit=8`);
      const pages = [{ title: 'Home', route: 'home' }, { title: 'Summit', route: 'summit' }, { title: 'Store', route: 'store' }, { title: 'Community', route: 'community' }, { title: 'About & services', route: 'about' }].filter(p => p.title.toLowerCase().includes(query.toLowerCase()));
      const html = pages.map(p => button(`Page · ${p.title}`, 'route', { route: p.route }, 'site-search-result')).join('') + r.products.map(p => button(`Product · ${p.title} · ${cash(p.price_minor)}`, 'product', { id: p.id }, 'site-search-result')).join('') + r.events.map(e => button(`Session · ${e.title}`, 'event', { id: e.id }, 'site-search-result')).join('') + r.articles.map(a => `<a class="site-search-result" data-action="route" data-route="story/${escape(a.slug)}" href="#story/${escape(a.slug)}">Story · ${escape(a.title)}</a>`).join('');
      $('#site-search-results').innerHTML = html || empty('No public results found.');
    } catch (e) { $('#site-search-results').innerHTML = empty(errorMessage(e)); }
  }
  async function submitForm(form, action = form.dataset.form) {
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form)); data.consent = form.elements.consent?.checked || false;
    let feedback = form.querySelector('[data-feedback]');
    if (!feedback && action === 'newsletter') feedback = $('#newsletter-status');
    if (!feedback) { feedback = document.createElement('p'); feedback.dataset.feedback = ''; feedback.setAttribute('aria-live', 'polite'); form.append(feedback); }
    const submit = form.querySelector('button[type=submit]'); if (submit?.disabled) return;
    if (submit) submit.disabled = true; status(feedback, 'Submitting…');
    try {
      if (action.startsWith('auth-') && action !== 'auth-verify') {
        const mode = action.slice(5); await api(`auth/${mode}`, data);
        if (mode === 'login') { await refreshSession(); await mergeAccountCart(); renderAccount(); }
        else status(feedback, mode === 'signup' ? 'Registration accepted. Check your email to verify your account before signing in.' : 'If this address has an account, a recovery email will be sent.');
      } else if (action === 'auth-verify') {
        const r = await api('auth/verify', { token_hash: form.dataset.token, type: form.dataset.type });
        user = r.user; if (r.recovery) $('#account-content').innerHTML = actionForm('password', 'Set a new password', field('New password', 'password', 'password', '', 'required minlength="12" maxlength="128"'), 'Set password'); else { await mergeAccountCart(); renderAccount(); }
      } else if (action === 'profile') { await api('profile', data); status(feedback, 'Profile saved.'); }
      else if (action === 'password') { await api('auth/password', data); form.elements.password.value = ''; status(feedback, 'Password changed.'); }
      else if (action === 'inquiry') { const r = await api('inquiries', { ...data, key: form.dataset.key }); form.innerHTML = `<h3>Inquiry received</h3><p>Your reference: ${escape(r.reference)}</p><p>Saved securely. The team notification is queued for delivery.</p>`; }
      else if (action === 'newsletter') { const r = await api('newsletter/subscribe', { email: form.querySelector('input[type=email]').value, consent: data.consent }); status(feedback, r.message); }
      else if (action === 'newsletter-action') { const r = await api(`newsletter/${form.dataset.type}`, { token: form.dataset.token }); form.innerHTML = `<p role="status">You are ${escape(r.status)}.</p>`; history.replaceState(null, '', '/#account'); }
      else if (action === 'checkout') {
        const r = await api('checkout', { ...data, key: checkoutKey, items: Object.entries(cart).map(([id, quantity]) => ({ id, quantity })) }); rememberOrder(r);
        if (r.status === 'paid') { cart = {}; checkoutFingerprint = null; persistCart(); return showOrder(r.reference, r.access_token); }
        modal(`<h2 id="dialog-title">Order created</h2><p>Reference ${escape(r.reference)}</p><p>Server total: ${cash(r.total_minor)}. Review this total before paying.</p><p>Digital access follows independently verified payment.</p><a class="btn" href="${escape(r.checkout_url)}" rel="noreferrer">Continue to Paystack test checkout</a><p><a href="#order/${r.reference}/${r.access_token}" data-action="route" data-route="order/${r.reference}/${r.access_token}">View saved order</a></p>`);
      } else if (action === 'registration') {
        const r = await api('registrations', { session_id: form.dataset.session, name: data.name });
        modal(`<h2 id="dialog-title">Registration ${escape(r.status)}</h2><div class="registration-result"><p>Reference: ${escape(r.reference)}</p><p>${r.status === 'pending' ? 'Payment is required before confirmation.' : r.status === 'waitlisted' ? 'Your place on the waitlist is saved. This is not a confirmed seat.' : 'Your registration is confirmed. Your confirmation email is queued.'}</p>${r.checkout_url ? `<a class="btn" href="${escape(r.checkout_url)}">Pay with Paystack (test)</a>` : ''}${button('View dashboard', 'account')}</div>`);
      } else if (['new-post', 'edit-post'].includes(action)) {
        const r = await api(action === 'new-post' ? 'posts/create' : 'posts/update', { ...data, category_id: data.category_id || null, ...(action === 'new-post' ? { community_id: currentCommunity.id } : { id: currentPost.id }) }); closeModal(); navigate(`post/${r.id}`);
      } else if (['comment', 'reply', 'edit-comment'].includes(action)) {
        await api(action === 'edit-comment' ? 'comments/update' : 'comments/create', { body: data.body, ...(action === 'edit-comment' ? { id: form.dataset.id } : { post_id: currentPost.id, parent_id: form.dataset.parent || null }) }); closeModal(); loadPost(currentPost.id);
      } else if (action === 'report') { await api('reports', { reason: data.reason, ...(form.dataset.comment ? { comment_id: form.dataset.comment } : { post_id: form.dataset.post }) }); form.innerHTML = '<p role="status">Report saved for moderator review.</p>'; }
      else if (action === 'post-search') { postOffset = 0; $('#posts-list').innerHTML = ''; loadPosts(currentCommunity.id, true); }
      else if (action === 'search') await searchSite(data.q.trim());
      else if (action === 'story-search') { allStories=true;storyQuery = data.q.trim(); await loadStories(); }
      else if (action === 'check-in') { await api('registrations/check-in', data); status(feedback, 'Attendance recorded.'); }
      else if (action === 'delete-confirm') { await api('account/delete-request', {}); closeModal(); renderAccount(); }
      else if (action === 'delete-post-confirm') { await api('posts/delete', { id: form.dataset.id }); closeModal(); navigate(`discussion/${currentCommunity.id}`); }
      if (['search', 'post-search', 'story-search'].includes(action)) status(feedback, '');
    } catch (e) { if (action === 'checkout' && e.order) { rememberOrder(e.order); await showOrder(e.order.reference, e.order.access_token); notice(`Your pending order is saved. ${errorMessage(e)}`, true); } else status(feedback, errorMessage(e), true); }
    finally { if (submit?.isConnected) submit.disabled = false; }
  }
  document.addEventListener('submit', e => { if (e.target.dataset.form) { e.preventDefault(); submitForm(e.target); } });
  document.addEventListener('change', async e => {
    if (e.target.dataset.select === 'summit') { selectedSummit = summits.find(s => s.id === e.target.value); await loadSummits(); }
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-action]'); if (!b) return; e.preventDefault(); const d = b.dataset;
    try {
      switch (d.action) {
        case 'route': closeModal(); navigate(d.route); break;
        case 'account': closeModal(); navigate('account'); break;
        case 'auth-mode': renderSignIn(d.mode); break;
        case 'logout': await api('auth/logout', {}); user = null; dashboard = null; cart = {}; persistCart(); renderAccount(); break;
        case 'delete-account': modal(actionForm('delete-confirm', 'Request account deletion', '<p>This records a request for the team to review and complete. Existing financial records may need retention.</p>', 'Record deletion request')); break;
        case 'product': showProductDetail(d.id); break;
        case 'add': await addToCart(d.id); break;
        case 'remove': delete cart[d.id]; persistCart(); renderCart(); break;
        case 'quantity': adjustCart(d.id, Number(d.delta)); break;
        case 'category': category = d.value; renderStore(); break;
        case 'store': renderStore(); break;
        case 'more-products': renderStore(true); break;
        case 'home-products': loadHomeProducts(); break;
        case 'cart': renderCart(); break;
        case 'order': showOrder(d.reference, d.token); break;
        case 'verify-payment': { const r = await api('payments/verify', { reference: d.reference, ...(d.token ? { access_token: d.token } : {}) }); status(document.querySelector('[data-order-feedback]'), `Payment status: ${r.status}`); await showOrder(d.reference, d.token, location.hash.startsWith('#order') || location.hash === '#payment'); if (r.status === 'paid') { cart = {}; persistCart(); } break; }
        case 'retry-payment': { await api('payments/retry', { reference: d.reference, ...(d.token ? { access_token: d.token } : {}) }); showOrder(d.reference, d.token, location.hash.startsWith('#order')); break; }
        case 'download': { const r = await api('downloads', { reference: d.reference, asset_id: d.asset, ...(d.token ? { access_token: d.token } : {}) }); location.assign(r.url); break; }
        case 'summits': await loadSummits(); break;
        case 'day': selectDay(Number(d.index)); break;
        case 'event': showEvent(d.id); break;
        case 'register-event': openRegister('Summit', d.id); break;
        case 'cancel-registration': await api('registrations/cancel', { id: d.id }); renderAccount(); break;
        case 'calendar': saveCalendar(d.id); break;
        case 'stories': await loadStories(); break;
        case 'more-stories': await loadStories(true); break;
        case 'communities': await loadCommunities(); break;
        case 'discussion': navigate(`discussion/${d.id}`); break;
        case 'membership': if (!user) { closeModal(); navigate('account'); } else { await api('memberships', { community_id: d.id, join: d.join === 'true' }); if (location.hash.startsWith('#discussion')) loadPosts(d.id); else loadCommunities(); } break;
        case 'new-post': postForm(); break;
        case 'edit-post': postForm(true); break;
        case 'more-posts': loadPosts(currentCommunity.id, true); break;
        case 'delete-post': modal(actionForm('delete-post-confirm', 'Delete your post?', '<p>This also removes its replies.</p>', 'Delete post', `data-id="${d.id}"`)); break;
        case 'reply': modal(actionForm('reply', 'Reply to comment', '<label>Your reply<textarea name="body" required minlength="2" maxlength="5000"></textarea></label>', 'Post reply', `data-parent="${d.id}"`)); break;
        case 'edit-comment': { const c = currentPost.comments.find(c => c.id === d.id); modal(actionForm('edit-comment', 'Edit reply', `<label>Reply<textarea name="body" required minlength="2" maxlength="5000">${escape(c.body)}</textarea></label>`, 'Save reply', `data-id="${d.id}"`)); break; }
        case 'delete-comment': await api('comments/delete', { id: d.id }); loadPost(currentPost.id); break;
        case 'report': modal(actionForm('report', 'Report content', '<label>Reason<textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>', 'Submit report', d.comment ? `data-comment="${d.comment}"` : `data-post="${d.post}"`)); break;
        case 'moderation': { const reports = await api('reports'); modal(`<h2 id="dialog-title">Moderator review</h2>${reports.map(r => `<div class="mini-row"><p>${escape(r.reason)}</p><small>Post: ${escape(r.post_id || '')} · Comment: ${escape(r.comment_id || '')}</small><div class="inline-actions">${button('Hide reported content', 'moderate', { id: r.id, hide: true })}${button('Dismiss', 'moderate', { id: r.id, hide: false })}</div></div>`).join('') || empty('No open reports.')}`); break; }
        case 'moderate': await api('moderation', { id: d.id, hide: d.hide === 'true' }); b.closest('.mini-row').remove(); break;
        case 'share': if (navigator.share) await navigator.share({ title: document.title, url: location.href }); else { await navigator.clipboard.writeText(location.href); toast('Story link copied.'); } break;
      }
    } catch (e) { notice(errorMessage(e), true); }
  });
  function saveCalendar(registrationId) {
    const r = dashboard.registrations.find(r => r.id === registrationId);
    const stamp = v => new Date(v).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const value = v => String(v || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&');
    const content = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//1751//Events//EN\r\nBEGIN:VEVENT\r\nUID:${r.reference}@1751\r\nDTSTAMP:${stamp(new Date())}\r\nDTSTART:${stamp(r.starts_at)}\r\nDTEND:${stamp(r.ends_at)}\r\nSUMMARY:${value(r.title)}\r\nLOCATION:${value(r.meeting_url || r.location)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: 'text/calendar' })); link.download = `${r.reference}.ics`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  const searchForm = document.createElement('form'); searchForm.className = 'story-search'; searchForm.dataset.form = 'story-search'; searchForm.innerHTML = '<input class="field" name="q" placeholder="Search stories" maxlength="100"><input class="field" name="category" id="story-category" placeholder="Category (optional)" maxlength="100"><button class="btn sm" type="submit">Search stories</button>';
  $('#stories-list').before(searchForm);
  // Replace preview-only dialogs while retaining truthful legal-content notices.
  window.showInfo = function (title, desc) { modal(`<span class="eyebrow">1751</span><h2 id="dialog-title">${escape(title)}</h2><p class="muted">${escape(desc)}</p>${button('Close', 'close')}`); $('#modalcontent [data-action=close]').onclick = closeModal; };
  persistCart();
  (async () => {
    const results = await Promise.allSettled([refreshSession(), api('categories')]);
    if (results[1].status === 'fulfilled') categories = results[1].value;
    if (results[0].status === 'rejected') notice(errorMessage(results[0].reason), true);
    else notice('Paystack test mode · Purchases and registrations use published records.');
    if (user) { try { await mergeAccountCart(); } catch (e) { notice(errorMessage(e), true); } }
    await Promise.allSettled([loadHomeProducts(), loadStories(), loadSummits(), loadCommunities()]);
    if (!document.querySelector('[data-form=auth-verify]')) navigate(location.hash.slice(1) || document.querySelector('meta[name="1751-route"]')?.content || window.routeFromPath?.(location.pathname) || 'home');
  })();
})();
