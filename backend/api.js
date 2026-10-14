import { handleAdmin, createAdminDatabase, validatedClaims, isMfa } from './admin.js';
import { handleUpload } from './uploads.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-f0-9]{64}$/;
const encoder = new TextEncoder();
export class ApiError extends Error {
  constructor(code, status = 400, details) { super(code); this.code = code; this.status = status; this.details = details; }
}
const fail = (code, status) => { throw new ApiError(code, status); };
const requireConfig = (env, ...keys) => {
  if (keys.some(k => !env[k])) fail('service_not_configured', 503);
};
function text(value, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail('invalid_input');
  return value.trim();
}
const id = v => UUID.test(v || '') ? v : fail('invalid_id');
const email = v => {
  v = text(v, 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail('invalid_email');
  return v;
};
const option = (v, choices) => choices.includes(v) ? v : fail('invalid_input');
const consent = b => b.consent === true ? true : fail('consent_required');
const token = v => TOKEN.test(v || '') ? v : fail('invalid_token');
const hex = buffer => [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
export const hash = async v => hex(await crypto.subtle.digest('SHA-256', encoder.encode(v)));
export async function hmac(secret, value, algorithm = 'SHA-256') {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: algorithm }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
export function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function validateItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 50) fail('invalid_cart');
  const seen = new Set();
  return items.map(i => {
    const productId = id(i.id);
    if (seen.has(productId) || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99) fail('invalid_quantity');
    seen.add(productId);
    return { id: productId, quantity: i.quantity };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
function origin(env) {
  requireConfig(env, 'APP_ORIGIN');
  const u = new URL(env.APP_ORIGIN);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))) fail('invalid_server_configuration', 503);
  return u.origin;
}
function checkMutation(request, env) {
  if (request.headers.get('Origin') !== origin(env) || request.headers.get('X-1751-Request') !== '1') fail('csrf_rejected', 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail('json_required', 415);
}
async function readBody(request, limit = 20000) {
  if (Number(request.headers.get('Content-Length')) > limit) fail('request_too_large', 413);
  let size = 0;
  const chunks = [];
  if (!request.body) return '';
  const reader = request.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); fail('request_too_large', 413); }
    chunks.push(value);
  }
  const all = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(all);
}
function parseBody(raw) {
  try { const b = JSON.parse(raw); if (!b || typeof b !== 'object' || Array.isArray(b)) fail('invalid_json'); return b; }
  catch { fail('invalid_json'); }
}
async function fetchJson(fetcher, url, init, errorCode = 'upstream_unavailable') {
  let response;
  try { response = await fetcher(url, { ...init, signal: AbortSignal.timeout(15000) }); }
  catch { fail(errorCode, 502); }
  let data;
  try { data = await response.json(); } catch { fail(errorCode, 502); }
  return { response, data };
}
function supabase(env) {
  requireConfig(env, 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
  const u = new URL(env.SUPABASE_URL);
  if (u.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(u.hostname)) fail('invalid_server_configuration', 503);
  return u.origin;
}
const dbCodes = new Set(['forbidden', 'unauthorized', 'not_found', 'conflict', 'invalid_cart', 'unavailable_product', 'invalid_quantity', 'invalid_promotion', 'invalid_total', 'payment_mismatch', 'duplicate_payment', 'partial_refund_requires_review', 'registration_closed', 'capacity_full', 'cancellation_closed', 'paid_cancellation_requires_review', 'joining_closed', 'invalid_category', 'invalid_parent', 'invalid_or_expired', 'download_limit', 'physical_fulfillment_not_configured', 'unavailable_product_asset','mfa_required','session_revoked','account_suspended','maintenance_mode']);
export function createDatabase(env, fetcher) {
  return async (action, p = {}, actor = null) => {
    const { response, data } = await fetchJson(fetcher, `${supabase(env)}/rest/v1/rpc/platform`, {
      method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, p, actor })
    }, 'database_unavailable');
    if (!response.ok) {
      const code = dbCodes.has(data.message) ? data.message : 'database_error';
      fail(code, ['unauthorized','session_revoked'].includes(code) ? 401 : ['forbidden','mfa_required','account_suspended'].includes(code) ? 403 : code === 'not_found' ? 404 : ['database_error','maintenance_mode'].includes(code) ? 503 : 409);
    }
    return data;
  };
}
function cookies(request) {
  return Object.fromEntries((request.headers.get('Cookie') || '').split(';').map(c => c.trim().split('=')).filter(x => x.length === 2));
}
function sessionCookies(session, env) {
  const secure = origin(env).startsWith('https:') ? '; Secure' : '';
  const common = `; Path=/api; HttpOnly; SameSite=Lax${secure}`;
  return [
    `s1751_access=${session?.access_token || ''}${common}; Max-Age=${session ? Math.min(session.expires_in || 3600, 3600) : 0}`,
    `s1751_refresh=${session?.refresh_token || ''}${common}; Max-Age=${session ? 2592000 : 0}`
  ];
}
const safeUser = user => ({ id: user.id, email: user.email, verified: !!user.email_confirmed_at, display_name: user.user_metadata?.display_name || '', created_at: user.created_at });
async function authCall(env, fetcher, path, method, body, bearer) {
  requireConfig(env, 'SUPABASE_ANON_KEY');
  const { response, data } = await fetchJson(fetcher, `${supabase(env)}/auth/v1/${path}`, {
    method, headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  }, 'auth_unavailable');
  if (!response.ok) fail(response.status === 429 ? 'rate_limited' : 'auth_rejected', response.status === 429 ? 429 : 401);
  return data;
}
async function identity(request, env, fetcher) {
  const c = cookies(request);
  if (!c.s1751_access && !c.s1751_refresh) return { user: null, cookieHeaders: [] };
  if (c.s1751_access) {
    try { return { user: await authCall(env, fetcher, 'user', 'GET', null, c.s1751_access), bearer: c.s1751_access, cookieHeaders: [] }; }
    catch (e) { if (e.code !== 'auth_rejected') throw e; }
  }
  if (c.s1751_refresh) {
    try {
      const s = await authCall(env, fetcher, 'token?grant_type=refresh_token', 'POST', { refresh_token: c.s1751_refresh });
      return { user: s.user, bearer: s.access_token, cookieHeaders: sessionCookies(s, env) };
    } catch (e) { if (e.code !== 'auth_rejected') throw e; }
  }
  return { user: null, cookieHeaders: sessionCookies(null, env) };
}
function sandbox(env) {
  requireConfig(env, 'PAYSTACK_SECRET_KEY', 'APP_SECRET');
  if (!/^sk_test_[a-zA-Z0-9]+$/.test(env.PAYSTACK_SECRET_KEY) || env.APP_SECRET.length < 32) fail('sandbox_configuration_required', 503);
}
async function paystack(env, fetcher, path, body) {
  sandbox(env);
  const { response, data } = await fetchJson(fetcher, `https://api.paystack.co/${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  }, 'payment_provider_unavailable');
  if (!response.ok || data.status !== true) fail('payment_provider_rejected', 502);
  return data.data;
}
export async function verifyPayment(reference, env, fetcher, db) {
  const transaction = await paystack(env, fetcher, `transaction/verify/${encodeURIComponent(reference)}`);
  if (transaction.reference !== reference || transaction.domain !== 'test') fail('payment_mismatch', 409);
  if (transaction.status !== 'success') {
    if (['failed', 'abandoned'].includes(transaction.status)) await db('payment_state', { reference, status: transaction.status === 'failed' ? 'failed' : 'cancelled' });
    return { status: transaction.status === 'failed' ? 'failed' : transaction.status === 'abandoned' ? 'cancelled' : 'pending' };
  }
  if (!Number.isSafeInteger(transaction.amount) || transaction.currency !== 'NGN' || !transaction.id) fail('payment_mismatch', 409);
  return db('finalize_payment', { reference, amount: transaction.amount, currency: transaction.currency, provider_id: String(transaction.id), order_url: `${origin(env)}/#account` });
}
async function initializePayment(ord, env, fetcher, db) {
  if (ord.status === 'paid') return ord;
  if (ord.status === 'refunded') fail('order_refunded', 409);
  // Reuse the single provider reference, including after a lost initialization response.
  if (ord.checkout_url) return ord;
  const payment = await paystack(env, fetcher, 'transaction/initialize', { email: ord.email, amount: ord.total_minor, currency: 'NGN', reference: ord.reference, callback_url: `${origin(env)}/#payment` });
  const u = new URL(payment.authorization_url);
  if (u.protocol !== 'https:' || u.hostname !== 'checkout.paystack.com') fail('payment_provider_rejected', 502);
  await db('payment_url', { reference: ord.reference, url: u.href });
  return { ...ord, checkout_url: u.href };
}
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function renderEmail(template, d) {
  const link = (url, label) => `<p><a href="${escape(url)}">${escape(label)}</a></p>`;
  if (template === 'newsletter') return { subject: 'Confirm your 1751 newsletter subscription', html: `<p>Please confirm your subscription within 24 hours.</p>${link(d.confirm_url, 'Confirm subscription')}${link(d.unsubscribe_url, 'Unsubscribe')}` };
  if (template === 'order') return { subject: `1751 order ${d.reference}`, html: `<p>Payment verified for ${escape(d.reference)}. Total: NGN ${(d.total_minor / 100).toFixed(2)}.</p>${link(d.url, 'View your order and downloads')}` };
  if (template === 'registration') return { subject: `1751 registration ${d.reference}`, html: `<p>Registration ${escape(d.reference)}: ${escape(d.status || 'confirmed')}.</p><p>${escape(d.title || '')} ${escape(d.starts_at || '')} ${escape(d.timezone || '')}</p><p>Open your account dashboard for event information, calendar download and cancellation rules.</p>` };
  if (template === 'inquiry') return { subject: `1751 ${d.type} inquiry ${d.reference}`, html: `<p>${escape(d.name)} (${escape(d.email)}) — ${escape(d.organization)}</p><p>${escape(d.message)}</p><p>Preferred contact: ${escape(d.contact_method)} ${escape(d.phone)}. Budget: ${escape(d.budget)}</p>` };
  if (template === 'deletion') return { subject: '1751 account deletion request', html: `<p>Review deletion request for user ${escape(d.user_id)} in the private database.</p>` };
  if (template === 'schedule_update') return {subject:'1751 session schedule updated',html:`<p>${escape(d.title)} has a schedule update.</p><p>${escape(d.starts_at)} – ${escape(d.ends_at)} (${escape(d.timezone)}).</p><p>Your registration ${escape(d.reference)} is retained. Open your dashboard for current details.</p>`};
  if (template === 'session_cancelled') return {subject:'1751 session cancelled',html:`<p>${escape(d.title)} has been cancelled.</p><p>${escape(d.reason)}</p><p>Reference: ${escape(d.reference)}. ${d.paid_review?'Any payment requires the team refund workflow; this notice does not confirm a refund.':''}</p>`};
  if(template==='operations_alert')return {subject:'1751 operations require attention',html:`<p>Review these redacted system checks in the admin health dashboard:</p><ul>${(d.issues||[]).map(v=>`<li>${escape(v)}</li>`).join('')}</ul>`};
  fail('invalid_email_template', 503);
}
async function flushEmails(env, fetcher, db) {
  requireConfig(env, 'RESEND_API_KEY', 'EMAIL_FROM');
  const batch = await db('claim_emails'); let sent = 0;
  for (const job of batch) {
    try {
      const { subject, html } = renderEmail(job.template, job.data);
      const { response, data } = await fetchJson(fetcher, 'https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': job.id },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [job.recipient], subject, html })
      }, 'email_provider_unavailable');
      if (!response.ok || !data.id) fail('email_provider_rejected', 502);
      await db('email_result', { id: job.id, sent: true }); sent++;
    } catch { await db('email_result', { id: job.id, sent: false, error: 'email_delivery_failed' }); }
  }
  return { processed: batch.length, sent, failed: batch.length - sent };
}
export async function handleRequest(request, env, dependencies = {}) {
  const fetcher = dependencies.fetch || fetch;
  const db = dependencies.db || createDatabase(env, fetcher);
  const adminDb = dependencies.adminDb || createAdminDatabase(env,fetcher);
  const requestId=crypto.randomUUID();
  let verifiedActor=null;
  const publicRead=request.method==='GET'&&/^\/api\/(home|products|product|categories|summits|events|event|articles|article|search|settings|policy)$/.test(new URL(request.url).pathname);
  let cookieHeaders = [];
  const response = (data, status = 200) => {
    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer','X-Request-ID':requestId,'X-Robots-Tag':'noindex' });
    for (const cookie of cookieHeaders) headers.append('Set-Cookie', cookie);
    if(publicRead&&status===200)headers.set('Cache-Control','public, max-age=30');
    return new Response(JSON.stringify(data), { status, headers });
  };
  try {
    const u = new URL(request.url), route = u.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
    if (route === 'health' && request.method === 'GET') return response({ service: '1751', configured: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'APP_SECRET'].every(k => !!env[k]), payment_mode: 'sandbox' });
    if (route === 'payments/webhook') {
      if (request.method !== 'POST') fail('method_not_allowed', 405);
      sandbox(env);
      const raw = await readBody(request, 128000);
      if (!equal(request.headers.get('x-paystack-signature'), await hmac(env.PAYSTACK_SECRET_KEY, raw, 'SHA-512'))) fail('invalid_signature', 401);
      const event = parseBody(raw);
      if (event.event === 'charge.success') await verifyPayment(text(event.data?.reference, 1, 100), env, fetcher, db);
      else if (event.event === 'refund.processed') {
        const refund = await paystack(env, fetcher, `refund/${encodeURIComponent(text(String(event.data?.id || ''), 1, 100))}`);
        if (refund.status !== 'processed' || refund.transaction?.domain !== 'test' || !refund.transaction?.reference || !Number.isSafeInteger(refund.amount)) fail('payment_mismatch', 409);
        await db('refund', { reference: refund.transaction.reference, amount: refund.amount, provider_id: String(refund.id) });
      }
      return response({ received: true });
    }
    if (route.startsWith('jobs/')) {
      if (request.method !== 'POST') fail('method_not_allowed', 405);
      requireConfig(env, 'JOB_SECRET');
      if (env.JOB_SECRET.length < 32 || !equal(request.headers.get('Authorization'), `Bearer ${env.JOB_SECRET}`)) fail('unauthorized', 401);
      if (route === 'jobs/email') {const result=await flushEmails(env, fetcher, db);await db('operation_report',{kind:'email',status:result.failed?'failed':'ok',details:result});return response(result);}
      if (route === 'jobs/reconcile') {
        sandbox(env); const references = await db('pending_payments'); let verified = 0, failed = 0;
        for (const reference of references) { try { await verifyPayment(reference, env, fetcher, db); verified++; } catch { failed++; } }
        const result={checked:references.length,verified,failed};await db('operation_report',{kind:'reconcile',status:failed?'failed':'ok',details:result});return response(result);
      }
      if(route==='jobs/monitor'){const result=await db('monitor',{ops_inbox:env.OPS_INBOX?email(env.OPS_INBOX):null});await db('operation_report',{kind:'health',status:result.healthy?'ok':'failed',details:result});return response(result);}
      if(route==='jobs/report') {const b=parseBody(await readBody(request));const kind=option(b.kind,['backup','restore','health']);const details={artifact_sha256:b.artifact_sha256?token(b.artifact_sha256):null,encrypted:b.encrypted===true,verified:b.verified===true,error_code:b.error_code?text(b.error_code,1,100):null};await db('operation_report',{kind,status:option(b.status,['ok','failed']),details});return response({recorded:true});}
      fail('not_found', 404);
    }
    if (!['GET', 'POST'].includes(request.method)) fail('method_not_allowed', 405);
    if (request.method === 'POST') checkMutation(request, env);
    requireConfig(env, 'APP_SECRET');
    if (env.APP_SECRET.length < 32) fail('invalid_server_configuration', 503);
    const scope = request.method === 'POST' ? route : 'read';
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const rate = await db('rate', { bucket: await hmac(env.APP_SECRET, `${ip}:${scope}`), max: request.method === 'POST' && route.startsWith('auth/') ? 15 : request.method === 'POST' ? 30 : 180 });
    if (!rate.allowed) fail('rate_limited', 429);
    const deferredUpload=route==='admin/upload'&&request.method==='POST';
    let b = deferredUpload?{}:request.method === 'POST' ? parseBody(await readBody(request,route==='admin/save'?80000:20000)) : Object.fromEntries(u.searchParams);
    if (request.method === 'GET') {
      for (const k of ['limit', 'offset']) if (b[k] != null && (!/^\d{1,6}$/.test(b[k]) || Number(b[k]) > 10000)) fail('invalid_pagination');
      if (b.q != null) b.q = text(b.q, 0, 100);
      for (const k of ['id', 'community_id', 'summit_id', 'category_id']) if (b[k]) id(b[k]);
    }
    if (route.startsWith('auth/') && request.method === 'POST') {
      const action = route.slice(5);
      if (['signup', 'login', 'recover'].includes(action)) {
        const address = email(b.email);
        if (action === 'recover') {
          // Uniform response prevents account enumeration. Supabase's rate controls remain active.
          await authCall(env, fetcher, `recover?redirect_to=${encodeURIComponent(origin(env) + '/#account')}`, 'POST', { email: address });
          return response({ accepted: true });
        }
        const password = text(b.password, 12, 128);
        const s = await authCall(env, fetcher, action === 'signup' ? 'signup' : 'token?grant_type=password', 'POST', {
          email: address, password, ...(action === 'signup' ? { data: { display_name: text(b.display_name, 2, 100) } } : {})
        });
        if (action === 'signup') {
          // Require Supabase email confirmation; an automatically issued signup session is rejected.
          if (s.access_token) fail('email_verification_must_be_enabled', 503);
          return response({ verification_required: true });
        }
        if (!s.user?.email_confirmed_at) fail('email_verification_required', 403);
        cookieHeaders = sessionCookies(s, env); return response({ user: safeUser(s.user) });
      }
      if (action === 'verify') {
        const s = await authCall(env, fetcher, 'verify', 'POST', { token_hash: text(b.token_hash, 20, 200), type: option(b.type, ['signup', 'recovery', 'email_change']) });
        cookieHeaders = sessionCookies(s, env); return response({ user: safeUser(s.user), recovery: b.type === 'recovery' });
      }
    }
    const session = publicRead?{user:null,cookieHeaders:[]}:await identity(request, env, fetcher); cookieHeaders = session.cookieHeaders;
    const user = session.user, actor = user?.id || null;
    verifiedActor=actor;
    const claims=validatedClaims(session.bearer||'');
    const primaryTimes=(claims.amr||[]).filter(x=>x.method!=='totp').map(x=>Number(x.timestamp)).filter(Number.isFinite);
    const sessionId=claims.session_id||await hash(session.bearer||'anonymous');
    if(actor&&route!=='auth/logout')await db('account_access',{session_id:sessionId,issued_at:primaryTimes.length?Math.min(...primaryTimes):claims.iat||0},actor);
    const authenticated = () => { if (!user?.email_confirmed_at) fail('unauthorized', 401); return actor; };
    if (route === 'auth/session' && request.method === 'GET') return response({ user: user ? safeUser(user) : null });
    if (route === 'auth/logout' && request.method === 'POST') {
      let remoteRevoked=true;
      if(actor)await db('session_revoke',{session_id:sessionId},actor).catch(()=>{remoteRevoked=false;});
      if (session.bearer) await authCall(env, fetcher, 'logout', 'POST', null, session.bearer).catch(()=>{remoteRevoked=false;});
      cookieHeaders = sessionCookies(null, env); return response({ logged_out: true,remote_revoked:remoteRevoked });
    }
    if (route === 'auth/password' && request.method === 'POST') {
      authenticated(); await authCall(env, fetcher, 'user', 'PUT', { password: text(b.password, 12, 128) }, session.bearer);
      return response({ changed: true });
    }
    if(route.startsWith('admin/')) {
      if(deferredUpload){const c=await adminDb('context',{},actor,isMfa(claims));if(!isMfa(claims)||!c.permissions.some(v=>['products','content','events','settings'].includes(v)))fail('forbidden',403);b=parseBody(await readBody(request,12000000));}
      const context={route,b,request,env,fetcher,db,adminDb,session,cookieHeaders,requestId};
      const result=route==='admin/upload'||route==='admin/scan'?await handleUpload(context):await handleAdmin(context);
      return result instanceof Response?result:response(result);
    }
    if(route==='reports'&&request.method==='GET')return response((await adminDb('reports',{...b,request_id:requestId},actor,isMfa(claims))).rows);
    if(route==='moderation'&&request.method==='POST')return response(await adminDb('moderate',{id:id(b.id),decision:b.hide===true?'hide':'dismiss',note:'',request_id:requestId},actor,isMfa(claims)));
    if(route==='registrations/check-in'&&request.method==='POST')return response(await adminDb('registration_action',{reference:text(b.reference,5,100),operation:'check_in',request_id:requestId},actor,isMfa(claims)));
    if(route==='settings'&&request.method==='GET')return response(await db('public_settings'));
    if(route==='home'&&request.method==='GET')return response(await db('home_content'));
    if(route==='policy'&&request.method==='GET')return response(await db('public_policy',{slug:option(b.slug,['privacy','terms','cookies','refunds','digital-delivery','community-guidelines','event-terms'])}));
    const reads = { products: 'products', product: 'product', categories: 'categories', summits: 'summits', events: 'events', event: 'event', articles: 'articles', article: 'article', search: 'search', communities: 'communities', posts: 'posts', post: 'post', dashboard: 'dashboard', cart: 'cart', reports: 'reports' };
    if (reads[route] && request.method === 'GET') {
      if (['dashboard', 'cart', 'reports'].includes(route)) authenticated();
      return response(await db(reads[route], b, actor));
    }
    if (route === 'inquiries' && request.method === 'POST') {
      requireConfig(env, 'TEAM_INBOX'); consent(b); if (b.website) fail('invalid_input');
      return response(await db('inquiry', { key: id(b.key), name: text(b.name, 2, 100), email: email(b.email), organization: b.organization ? text(b.organization, 0, 150) : '', type: option(b.type, ['project', 'training', 'partnership', 'general']), message: text(b.message, 10, 5000), budget: b.budget ? text(b.budget, 0, 100) : '', contact_method: option(b.contact_method, ['email', 'phone']), phone: b.contact_method === 'phone' ? text(b.phone, 7, 30) : '', team_inbox: email(env.TEAM_INBOX) }));
    }
    if (route === 'newsletter/subscribe' && request.method === 'POST') {
      consent(b); if (b.website) fail('invalid_input');
      const confirm = hex(crypto.getRandomValues(new Uint8Array(32))), unsub = hex(crypto.getRandomValues(new Uint8Array(32)));
      await db('newsletter', { email: email(b.email), token_hash: await hash(confirm), unsubscribe_hash: await hash(unsub), confirm_url: `${origin(env)}/#newsletter/confirm/${confirm}`, unsubscribe_url: `${origin(env)}/#newsletter/unsubscribe/${unsub}` });
      return response({ accepted: true, message: 'If needed, a confirmation email has been queued. Your subscription becomes active only after confirmation.' });
    }
    if (['newsletter/confirm', 'newsletter/unsubscribe'].includes(route) && request.method === 'POST') return response(await db(route.endsWith('confirm') ? 'newsletter_confirm' : 'newsletter_unsubscribe', { token_hash: await hash(token(b.token)) }));
    if (route === 'checkout' && request.method === 'POST') {
      sandbox(env);
      const items = validateItems(b.items), key = id(b.key), address = user ? user.email.toLowerCase() : email(b.email);
      const promotion = b.promotion ? text(b.promotion, 1, 50).toUpperCase() : '';
      const accessToken = await hmac(env.APP_SECRET, `order:${address}:${key}`);
      const ord = await db('checkout', { key, items, email: address, name: text(b.name, 2, 100), promotion, access_hash: await hash(accessToken), fingerprint: await hash(JSON.stringify({ items, promotion })) }, actor);
      // The private receipt URL contains a capability scoped to this order only.
      await db('receipt_url', { reference: ord.reference, url: `${origin(env)}/#order/${ord.reference}/${accessToken}` });
      const full = await db('order', { reference: ord.reference, access_hash: await hash(accessToken) }, actor);
      let initialized;
      try { initialized = await initializePayment(full, env, fetcher, db); }
      catch (e) { throw new ApiError(e instanceof ApiError ? e.code : 'payment_provider_unavailable', e instanceof ApiError ? e.status : 502, { order: { reference: ord.reference, total_minor: ord.total_minor, access_token: accessToken } }); }
      return response({ reference: ord.reference, total_minor: ord.total_minor, checkout_url: initialized.checkout_url, status: initialized.status, access_token: accessToken });
    }
    if (route === 'orders' && request.method === 'POST') {
      const p = { reference: text(b.reference, 5, 100), ...(b.access_token ? { access_hash: await hash(token(b.access_token)) } : {}) };
      return response(await db('order', p, actor));
    }
    if (route === 'payments/verify' && request.method === 'POST') {
      const reference = text(b.reference, 5, 100);
      await db('order', { reference, ...(b.access_token ? { access_hash: await hash(token(b.access_token)) } : {}) }, actor);
      return response(await verifyPayment(reference, env, fetcher, db));
    }
    if (route === 'payments/retry' && request.method === 'POST') {
      const ord = await db('order', { reference: text(b.reference, 5, 100), ...(b.access_token ? { access_hash: await hash(token(b.access_token)) } : {}) }, actor);
      return response(await initializePayment(ord, env, fetcher, db));
    }
    if (route === 'downloads' && request.method === 'POST') {
      const asset = await db('download', { reference: text(b.reference, 5, 100), asset_id: id(b.asset_id), ...(b.access_token ? { access_hash: await hash(token(b.access_token)) } : {}) }, actor);
      try {
        if (asset.path.split('/').includes('..') || asset.path.startsWith('/')) fail('storage_unavailable', 502);
        const { response: upstream, data } = await fetchJson(fetcher, `${supabase(env)}/storage/v1/object/sign/digital-products/${asset.path.split('/').map(encodeURIComponent).join('/')}`, {
          method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 60 })
        }, 'storage_unavailable');
        if (!upstream.ok || !data.signedURL?.startsWith('/object/sign/digital-products/')) fail('storage_unavailable', 502);
        return response({ url: `${supabase(env)}/storage/v1${data.signedURL}`, expires_in: 60 });
      } catch (e) { await db('download_failed', { id: asset.reservation_id }); throw e; }
    }
    if (route === 'registrations' && request.method === 'POST') {
      authenticated(); const sessionId = id(b.session_id);
      const events = await db('event', { id: sessionId }, actor);
      if (!events.length) fail('not_found', 404);
      if (events[0].price_minor > 0) sandbox(env);
      const reg = await db('register', { session_id: sessionId, name: text(b.name, 2, 100), email: user.email.toLowerCase(), access_hash: await hash(crypto.randomUUID()) }, actor);
      if (reg.order_reference) {
        const ord = await db('order', { reference: reg.order_reference }, actor);
        return response({ ...reg, checkout_url: (await initializePayment(ord, env, fetcher, db)).checkout_url });
      }
      return response(reg);
    }
    const writes = {
      profile: ['profile', () => ({ display_name: text(b.display_name, 2, 100), avatar_url: b.avatar_url ? validImage(b.avatar_url) : '' })],
      'account/delete-request': ['delete_request', () => { requireConfig(env, 'TEAM_INBOX'); return { team_inbox: email(env.TEAM_INBOX) }; }],
      cart: ['cart_save', () => ({ items: Array.isArray(b.items) && b.items.length === 0 ? [] : validateItems(b.items) })],
      'registrations/cancel': ['registration_cancel', () => ({ id: id(b.id) })],
      memberships: ['membership', () => ({ community_id: id(b.community_id), join: typeof b.join === 'boolean' ? b.join : fail('invalid_input') })],
      'posts/create': ['post_create', () => ({ community_id: id(b.community_id), category_id: b.category_id ? id(b.category_id) : null, title: text(b.title, 3, 180), body: text(b.body, 3, 10000) })],
      'posts/update': ['post_update', () => ({ id: id(b.id), category_id: b.category_id ? id(b.category_id) : null, title: text(b.title, 3, 180), body: text(b.body, 3, 10000) })],
      'posts/delete': ['post_delete', () => ({ id: id(b.id) })],
      'comments/create': ['comment_create', () => ({ post_id: id(b.post_id), parent_id: b.parent_id ? id(b.parent_id) : null, body: text(b.body, 2, 5000) })],
      'comments/update': ['comment_update', () => ({ id: id(b.id), body: text(b.body, 2, 5000) })],
      'comments/delete': ['comment_delete', () => ({ id: id(b.id) })],
      reports: ['report', () => b.comment_id ? ({ comment_id: id(b.comment_id), reason: text(b.reason, 5, 1000) }) : ({ post_id: id(b.post_id), reason: text(b.reason, 5, 1000) })],
      moderation: ['moderate', () => ({ id: id(b.id), hide: typeof b.hide === 'boolean' ? b.hide : fail('invalid_input') })],
      'registrations/check-in': ['check_in', () => ({ reference: text(b.reference, 5, 100) })]
    };
    if (writes[route] && request.method === 'POST') {
      authenticated(); const [action, validate] = writes[route];
      return response(await db(action, validate(), actor));
    }
    fail('not_found', 404);
  } catch (e) {
    if(new URL(request.url).pathname.startsWith('/api/admin/')&&e instanceof ApiError&&[401,403].includes(e.status)){const event={request_id:requestId,code:e.code,route:'/api/admin'};await db('security_event',event,verifiedActor).catch(()=>{});}
    if((e instanceof ApiError?e.status:500)>=500){
      const incident={request_id:requestId,code:e instanceof ApiError?e.code:'internal_error',route:new URL(request.url).pathname};
      console.error(JSON.stringify({event:'request_failed',...incident}));
      const record=db('incident',incident).catch(()=>{});if(dependencies.waitUntil)dependencies.waitUntil(record);else await record;
    }
    return response({ error: e instanceof ApiError ? e.code : 'internal_error', ...(e instanceof ApiError && e.details ? e.details : {}) }, e instanceof ApiError ? e.status : 500);
  }
}
export {id,text,email,option,fetchJson,supabase,authCall,paystack,sessionCookies};
function validImage(value) {
  const v = text(value, 1, 1000);
  try { const u = new URL(v); if (u.protocol !== 'https:') fail('invalid_image_url'); return u.href; }
  catch { fail('invalid_image_url'); }
}
