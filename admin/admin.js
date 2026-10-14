import {ENTITIES} from '/shared/admin-model.js';
const $=s=>document.querySelector(s),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(Number(n||0)/100);
const date=v=>v?new Intl.DateTimeFormat('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
const label=k=>({price_minor:'Price (NGN)',minimum_minor:'Minimum order (NGN)',total_minor:'Order total',max_uses:'Maximum uses',featured:'Featured rank',registration_closes_at:'Registration closes',body:'Content (plain text)',slug:'Public URL slug',starts_on:'First day',ends_on:'Last day',confirmed_payments_minor:'Gross verified payments',refunds_minor:'Processed refunds',new_users:'New users in period',orders:'Orders created in period',pending_orders:'Pending orders (all)',registrations:'Registrations created in period',memberships:'Current memberships',subscribers:'Confirmed subscribers',available_products:'Available published products',upcoming_sessions:'Upcoming published sessions',total_users:'Total users',published_stories:'Published stories',open_reports:'Unresolved reports',new_inquiries:'New inquiries'}[k]||k.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()));
const btn=(name,action,data={},cls='')=>`<button type="button" class="${cls}" data-action="${action}" ${Object.entries(data).map(([k,v])=>`data-${k}="${escape(v)}"`).join(' ')}>${escape(name)}</button>`;
const tabs=[['overview','Overview','overview'],['products','Products','products'],['orders','Orders & Payments','orders'],['events','Summit & Events','events'],['community','Community','community'],['content','Stories & Content','content'],['users','Users & Permissions','users'],['inquiries','Inquiries','inquiries'],['newsletter','Newsletter','newsletter'],['analytics','Analytics','analytics'],['settings','Website Settings','settings'],['security','Security & System Health','security']];
let permissions=[],roles=[],section='overview',entity='products',offset=0,rows=[],lastFocus,settings={},factorId=null,challengeId=null;
const errorMessages={mfa_required:'Verify your authenticator code to continue.',recent_mfa_required:'A recent authenticator check is required. Sign out and sign in, then verify your code.',forbidden:'Your role does not permit this action.',unauthorized:'Sign in with a verified staff account.',session_revoked:'This session was revoked. Sign in again.',account_suspended:'This account is suspended.',service_not_configured:'Administration needs backend configuration. Contact the environment owner.',scan_required:'A verified clean digital file is required before attaching it.',last_super_admin:'The last active super administrator cannot be removed or suspended.',edit_conflict:'Another administrator changed this record. Close and reload before editing.',capacity_below_reserved:'Capacity cannot be lower than the number of reserved seats.',schedule_outside_summit:'The session date must fall within its summit programme.',refund_requires_reconciliation:'The refund response is uncertain. Check the provider record before retrying.',retention_approval_required:'Deletion requires approved retention rules. These remain a launch blocker.',confirmation_required:'Enter the exact confirmation requested.',maintenance_mode:'The public transaction service is in maintenance mode.'};
const message=e=>errorMessages[e.code]||`The request was not accepted (${e.code||'network_error'}). Review the details and retry.`;
async function api(path,body){let r;try{r=await fetch('/api/'+path,{credentials:'same-origin',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-1751-Request':'1'},body:JSON.stringify(body)})});}catch{throw {code:'network_error'};}const data=await r.json();if(!r.ok)throw {code:data.error,status:r.status};return data;}
function feedback(node,text,bad=false){node.textContent=text;node.className=bad?'error':'success';node.setAttribute('role',bad?'alert':'status');}
function query(extra={}){const form=new FormData($('#filters'));return new URLSearchParams({...Object.fromEntries(form),limit:'25',offset:String(offset),...extra});}
function modal(html){lastFocus=document.activeElement;$('#editor-content').innerHTML=html;$('#editor').showModal();$('#editor-content input, #editor-content textarea, #editor-content button')?.focus();}
function close(){ $('#editor').close();lastFocus?.focus(); }
$('#editor').addEventListener('close',()=>lastFocus?.focus());$('#close-dialog').onclick=close;
function form(action,fields,attrs=''){return `<form class="form" data-form="${action}" ${attrs}>${fields}<p data-feedback aria-live="polite"></p><div class="actions"><button>Save</button>${btn('Close','close',{},'secondary')}</div></form>`;}
function input(name,type='text',value='',attrs='',help=''){return `<label>${escape(label(name))}<input name="${name}" type="${type}" value="${escape(value)}" ${attrs}>${help?`<small>${escape(help)}</small>`:''}</label>`;}
async function initialize(){
 try{
  const session=await api('auth/session');
  if(!session.user)return showLogin();
  const context=await api('admin/context');permissions=context.permissions;roles=context.roles;$('#logout').hidden=false;
  if(context.mfa_required)return showMfa();
  $('#auth-panel').innerHTML='';$('#admin-shell').hidden=false;
  $('#admin-nav').innerHTML=tabs.filter(t=>permissions.includes(t[2])).map(([key,title])=>btn(title,'section',{section:key})).join('');$('#roles').textContent=roles.map(label).join(' · ');
  section=tabs.some(t=>t[0]===location.hash.slice(1)&&permissions.includes(t[2]))?location.hash.slice(1):'overview';await render();
 }catch(e){$('#admin-shell').hidden=true;$('#auth-panel').innerHTML=`<h1>Administration access</h1><p class="error">${escape(message(e))}</p><a href="/#account">Account and password recovery</a>`;}
}
function showLogin(){ $('#admin-shell').hidden=true;$('#auth-panel').innerHTML=`<h1>Staff sign in</h1><p>Use your verified 1751 account. An authenticator check protects administrative access.</p>${form('login',input('email','email','','required autocomplete="email"')+input('password','password','','required minlength="12" autocomplete="current-password"'))}<a href="/#account">Password recovery / account verification</a>`; }
async function showMfa(){
 $('#admin-shell').hidden=true;const f=await api('admin/mfa/factors');factorId=f.factors.find(f=>f.status==='verified'&&f.factor_type==='totp')?.id||null;
 $('#auth-panel').innerHTML=`<h1>Authenticator verification</h1><p>Enter the current six-digit code from your authenticator app.</p>${factorId?'':btn('Set up authenticator','enroll')}<div id="enrollment"></div>${form('mfa',input('code','text','','required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"'))}`;
 if(factorId)challengeId=(await api('admin/mfa/challenge',{factor_id:factorId})).id;
}
function table(data,columns,actions){return `<div class="table-wrap" role="region" aria-label="${escape($('#page-title').textContent)} records" tabindex="0"><table><thead><tr>${columns.map(c=>`<th scope="col">${escape(label(c))}</th>`).join('')}<th scope="col">Actions</th></tr></thead><tbody>${data.map((row,i)=>`<tr>${columns.map(c=>`<td>${formatValue(c,row[c])}</td>`).join('')}<td>${actions(row,i)}</td></tr>`).join('')}</tbody></table></div>`;}
function formatValue(key,v){if(v===null||v===undefined)return '—';if(key.endsWith('_minor'))return money(v);if(key.endsWith('_at')&&v)return escape(date(v));if(typeof v==='boolean')return v?'Yes':'No';if(Array.isArray(v))return escape(v.join(', '));if(typeof v==='object')return escape(JSON.stringify(v));return escape(String(v).slice(0,180));}
function paginate(){return `<div class="pagination">${btn('Previous','previous',{},'secondary')}<span>Showing ${rows.length} records · page ${Math.floor(offset/25)+1}</span>${btn('Next','next',{},'secondary')}</div>`;}
const entityMenus={products:['products','categories','product_assets','promotions'],events:['summits','sessions','speakers','registrations'],community:['communities','community_categories','posts','memberships','reports'],content:['articles'],users:['users','deletions'],newsletter:['subscribers'],security:['health','audit','incidents']};
async function render(){
 $('#page-title').textContent=tabs.find(t=>t[0]===section)?.[1]||'Overview';$('#page-status').textContent='Loading…';$('#page-status').className='';
 $('#admin-nav').querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',b.dataset.section===section?'page':'false'));$('#admin-nav').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');
 try{
  const menus=entityMenus[section];if(menus&&!menus.includes(entity))entity=menus[0];
  if(section==='overview'){const data=await api('admin/overview?'+query());$('#content').innerHTML=cards(data)+`<p class="footer-note">Metrics show database records within the selected period, except values labelled current, total or all. Money is NGN; failed/pending orders do not count as verified payments.</p>`;}
  else if(section==='analytics'){const data=await api('admin/analytics?'+query());const summary=data.summary;const gross=summary.confirmed_payments_minor||0,refunds=summary.refunds_minor||0;$('#content').innerHTML=cards({...summary,net_payments_minor:gross-refunds})+`<p>${escape(data.measurement_note)}</p><div class="chart-grid">${chart('Verified payment totals by day',data.sales_daily,'day','gross_minor',true)}${chart('Registrations by day',data.registrations_daily,'day','registrations')}${chart('Best-selling products (units)',data.best_sellers,'title','units')}${chart('Community posts',data.community_activity,'name','posts')}</div><h2>Session capacity and attendance</h2>${table(data.capacity,['title','capacity','reserved','attended'],()=> '')}`;}
  else if(section==='settings'){settings=await api('admin/settings');$('#content').innerHTML=`<div class="panel"><h2>Controlled public content</h2><p>These fields change approved content while preserving the design. Credentials are managed in deployment settings.</p><div class="actions">${btn('Edit website content','settings-editor')}${btn('Policies and legal approval','policies')}${permissions.includes('roles')?btn('Maintenance / retention approvals','sensitive-settings',{},'secondary'):''}</div><dl class="detail-grid">${Object.entries(settings).map(([k,v])=>`<div><dt>${escape(label(k))}</dt><dd>${escape(typeof v==='object'?JSON.stringify(v):v)}</dd></div>`).join('')||'<p>No overrides saved; original content is preserved.</p>'}</dl></div>`;}
  else if(section==='security'&&entity==='health'){
   const h=await api('admin/health');$('#content').innerHTML=menu(menus)+`<div class="cards">${Object.entries(h.integrations).map(([k,v])=>`<div class="card"><strong>${v.configured?'Configured':'Missing'}</strong><span>${escape(k)} · ${escape(v.verification)}</span></div>`).join('')}<div class="card"><strong>${h.open_incidents}</strong><span>Open incidents</span></div><div class="card"><strong>${h.pending_orders}</strong><span>Pending orders older than one hour</span></div></div><h2>Latest operational evidence</h2>${table(h.runs,['kind','status','created_at','details'],()=> '')}<h2>Email outbox</h2>${table(h.outbox,['status','count','oldest'],()=> '')}<p class="security-note">No operational history means the integration is unverified. Legal/retention approval, encrypted backup and staging restore evidence remain release gates.</p>`;
  }else{
   const type=section==='orders'?'orders':section==='inquiries'?'inquiries':entity;const generic=!!ENTITIES[type];
   const path=generic?'list':type;const result=await api(`admin/${path}?`+query(generic?{entity:type}:{}));rows=result.rows||[];
   const controls=(menus?menu(menus):'')+`<div class="actions">${generic&&type!=='inquiries'?btn('Create '+label(type).replace(/s$/,''),'create'):''}${['orders','registrations','subscribers','users','inquiries'].includes(type)?btn('Export permitted CSV','export',{},'secondary'):''}${type==='product_assets'?btn('Upload / inspect media','media',{},'secondary'):''}</div>`;
   const columns=type==='products'?['title','price_minor','status','featured','archived']:type==='orders'?['reference','customer_name','total_minor','status','created_at']:type==='registrations'?['reference','name','session_title','status','checked_in_at']:type==='users'?['email','display_name','roles','suspended']:type==='inquiries'?['reference','name','inquiry_type','status','created_at']:type==='subscribers'?['email','status','consent_at','confirmed_at']:type==='reports'?['reason','status','post_body','comment_body']:type==='posts'?['title','hidden','featured','announcement']:type==='audit'?['action','entity','target','created_at']:type==='incidents'?['code','route','resolved','created_at']:type==='deletions'?['user_id','status','requested_at']:Object.keys(rows[0]||{}).filter(k=>!['body','description','meeting_url'].includes(k)).slice(0,5);
   $('#content').innerHTML=controls+(rows.length?table(rows,columns,(row,i)=>rowActions(type,row,i)): '<div class="empty">No matching records. Adjust the filters or create approved content.</div>')+paginate();
  }
  $('#page-status').textContent='';
 }catch(e){feedback($('#page-status'),message(e),true);$('#content').innerHTML='<p>No data was changed by this failed load.</p>';}
}
function menu(items){return `<div class="actions">${items.map(i=>btn(label(i),'entity',{entity:i},i===entity?'':'secondary')).join('')}</div>`;}
function cards(data){return `<div class="cards">${Object.entries(data).filter(([k,v])=>k!=='period'&&typeof v==='number').map(([k,v])=>`<div class="card"><strong>${k.endsWith('_minor')?money(v):v.toLocaleString('en-NG')}</strong><span>${escape(label(k))}</span></div>`).join('')}</div>`;}
function chart(title,data,key,value,currency=false){if(!data.length)return `<section class="panel"><h2>${escape(title)}</h2><p>No matching measured records.</p></section>`;const max=Math.max(...data.map(d=>Number(d[value])),1);const visible=data.slice(-20),height=visible.length*32+10;return `<section class="panel chart"><h2>${escape(title)}</h2><svg viewBox="0 0 560 ${height}" role="img" aria-label="${escape(title)}">${visible.map((d,i)=>`<text x="0" y="${i*32+20}">${escape(String(d[key]).slice(0,22))}</text><rect x="160" y="${i*32+6}" width="${Math.max(1,Number(d[value])/max*250)}" height="18" rx="3"/><text x="425" y="${i*32+20}">${escape(currency?money(d[value]):d[value])}</text>`).join('')}</svg><details><summary>View chart data</summary><ul>${data.map(d=>`<li>${escape(d[key])}: ${escape(currency?money(d[value]):d[value])}</li>`).join('')}</ul></details></section>`;}
function rowActions(type,row,i){
 if(ENTITIES[type])return btn('Edit','edit',{index:i})+(['products','articles','summits','communities'].includes(type)&&!row.archived?btn('Archive','archive',{index:i},'secondary'):'')+(type==='articles'?btn('Preview / revisions','preview',{index:i},'secondary'):'')+(type==='sessions'?btn('Cancel / speakers','session-tools',{index:i},'secondary'):'');
 if(type==='orders')return btn('Details / verify','order',{index:i});
 if(type==='users')return btn('Manage access','user',{index:i});
 if(type==='deletions')return btn('Review','deletion',{index:i});
 if(type==='reports')return btn('Moderate','report',{index:i});
 if(type==='posts')return btn('Moderate / feature','post-tools',{index:i});
 if(type==='memberships')return btn('Restrict member','restrict',{index:i});
 if(type==='registrations')return btn('Attendance / status','registration',{index:i});
 if(type==='subscribers')return row.status!=='unsubscribed'?btn('Unsubscribe','unsubscribe',{index:i},'secondary'):'';
 if(type==='incidents'&&!row.resolved)return btn('Resolve','resolve-incident',{index:i});
 if(type==='audit')return btn('Inspect change','audit-detail',{index:i},'secondary');return '';
}
const lookupEntity={category_id:'categories',product_id:'products',summit_id:'summits',community_id:'communities',assigned_to:'users'};
async function openEditor(record){
 const type=section==='inquiries'?'inquiries':entity,spec=ENTITIES[type];let fields='';
 for(const [key,fieldType] of Object.entries(spec.fields)){
  const value=record?.[key];
  if(Array.isArray(fieldType))fields+=`<label>${escape(label(key))}<select name="${key}">${fieldType.map(v=>`<option value="${v}" ${value===v?'selected':''}>${escape(label(v))}</option>`).join('')}</select></label>`;
  else if(fieldType==='boolean')fields+=`<label><input type="checkbox" name="${key}" ${value?'checked':''}>${escape(label(key))}</label>`;
  else if(lookupEntity[key]){const linked=lookupEntity[key],options=(await api(`admin/${linked==='users'?'users':'list'}?`+new URLSearchParams({entity:linked,limit:'100'}))).rows;fields+=`<label>${escape(label(key))}<select name="${key}" ${fieldType.endsWith('?')?'':'required'}><option value="">Choose ${escape(label(linked))}</option>${options.map(o=>`<option value="${o.id}" ${value===o.id?'selected':''}>${escape(o.title||o.name||o.display_name||o.email)}</option>`).join('')}</select></label>`;}
  else if(fieldType==='body')fields+=`<label class="wide">${escape(label(key))}<textarea name="${key}" maxlength="50000">${escape(value||'')}</textarea><small>Plain text is escaped on the public website.</small></label>`;
  else if(['price','positive','nonnegative','positive?','percent'].includes(fieldType))fields+=input(key,'number',value===null||value===undefined?'':key.endsWith('_minor')?value/100:value,`step="${key.endsWith('_minor')?'.01':'1'}" min="${fieldType.includes('nonnegative')?0:fieldType.startsWith('positive')&&!key.endsWith('_minor')?1:.01}" ${fieldType.endsWith('?')?'':'required'}`);
  else if(fieldType.startsWith('datetime')){const v=value?new Date(value).toISOString().slice(0,16):'';fields+=input(key,'datetime-local',v,fieldType.endsWith('?')?'':'required','Enter UTC time; event timezone controls display.');}
  else if(fieldType==='date')fields+=input(key,'date',value||'','required');
  else fields+=input(key,'text',value||'',`maxlength="1500" ${fieldType.endsWith('?')?'':'required'}`);
  if(['image_url','cover_image'].includes(key))fields+=`<div class="upload-control">${input('upload_'+key,'file','','accept="image/jpeg,image/png,image/webp"')}${btn('Optimize & upload image','upload',{field:key,kind:'image'})}</div>`;
  if(key==='storage_path')fields+=`<div class="upload-control">${input('upload_file','file','','accept="application/pdf,application/zip"')}${btn('Upload digital file','upload',{field:key,kind:'document'})}<small>New files must pass the configured scanner before attachment.</small></div>`;
 }
 if(type==='legal_policies')fields+=input('confirmation','text','','placeholder="APPROVE POLICY"','Approving requires business/legal review and a super-administrator.');
 modal(`<h3>${record?'Edit':'Create'} ${escape(label(type))}</h3>${form('record',fields,`data-entity="${type}" data-id="${escape(record?.id||record?.code||record?.slug||'')}" data-version="${escape(record?.updated_at||'')}"`)}`);
}
async function orderModal(row){const order=await api('admin/order_detail?'+new URLSearchParams({reference:row.reference}));modal(`<h3>${escape(order.reference)}</h3><dl class="detail-grid">${Object.entries(order).filter(([k,v])=>!['items','payments','events','refunds'].includes(k)).map(([k,v])=>`<div><dt>${escape(label(k))}</dt><dd>${formatValue(k,v)}</dd></div>`).join('')}</dl><h3>Historical purchase items</h3><div class="preformatted">${escape(JSON.stringify(order.items,null,2))}</div><h3>Provider records</h3><div class="preformatted">${escape(JSON.stringify({payments:order.payments,events:order.events,refunds:order.refunds},null,2))}</div><div class="actions">${btn('Verify provider status','reconcile',{reference:row.reference})}${order.fulfillment_hold?btn('Resolve reserved-seat fulfillment','fulfillment',{reference:row.reference}):''}${order.status==='paid'&&permissions.includes('refunds')?btn('Initiate approved sandbox refund','refund',{reference:row.reference},'danger'):''}</div><p id="operation-feedback" role="status"></p>`);}
async function upload(button){
 const form=button.closest('form'),key=button.dataset.field,kind=button.dataset.kind,file=form.elements[kind==='document'?'upload_file':'upload_'+key]?.files[0];if(!file)throw {code:'select_file'};
 let blob=file;
 if(kind==='image'){
  const image=await createImageBitmap(file);const ratio=Math.min(1,1600/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.85));image.close();
 }
 if(!blob||blob.size>(kind==='image'?4194304:8388608))throw {code:'invalid_file_size'};
 const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
 const r=await api('admin/upload',{kind,permission:kind==='document'?'products':ENTITIES[form.dataset.entity]?.permission||'content',base64:encoded});
 if(r.status==='clean'){form.elements[key].value=r.url||r.path;feedback(form.querySelector('[data-feedback]'),'Upload accepted. Save the record to attach this asset.');}
 else feedback(form.querySelector('[data-feedback]'),`File ${r.id} is quarantined (${r.status}). It cannot be sold or downloaded until scanner verification succeeds.`,true);
}
async function settingsEditor(sensitive=false){
 const fields=sensitive?['maintenance','retention_approved','retention_rules']:['site_name','logo_url','contact_email','contact_details','announcement','hero_title','hero_intro','hero_images','ecosystem_descriptions','summit_intro','service_intro','social_links','footer_links','featured_products','featured_stories'];
 let html='';
 for(const key of fields){const value=settings[key];
  if(['maintenance','retention_approved'].includes(key)){html+=`<label><input name="${key}" data-setting="${key}" type="checkbox" ${value?'checked':''}>${escape(label(key))}</label>`;continue;}
  if(key==='retention_rules'){html+=input('financial_days','number',value?.financial_days??'','min="1" max="3650"','Owner-approved days from the order date to retain customer billing identity.')+`<label><input type="checkbox" name="retain_purchase_access" ${value?.retain_purchase_access?'checked':''}>Preserve paid download access after account deletion</label><p>Enter only reviewed business/legal rules. Leaving these unset keeps deletion and launch blocked.</p>`;continue;}
  if(key==='hero_images'){html+=`<fieldset class="wide"><legend>Homepage slideshow images</legend>${Array.from({length:3},(_,i)=>input('hero_image_'+i,'text',value?.[i]||'','maxlength="1500"','HTTPS image URL, or leave blank to retain the supplied artwork.')).join('')}</fieldset>`;continue;}
  if(['social_links','footer_links'].includes(key)){html+=`<fieldset class="wide"><legend>${escape(label(key))}</legend>${Array.from({length:4},(_,i)=>`<div class="form">${input(key+'_label_'+i,'text',value?.[i]?.label||'','maxlength="60"')}${input(key+'_url_'+i,'text',value?.[i]?.url||'','maxlength="1500"','HTTPS destination')}</div>`).join('')}</fieldset>`;continue;}
  if(key==='ecosystem_descriptions'){html+=`<fieldset class="wide"><legend>Ecosystem descriptions</legend>${['Yolena','Store','Community','Compound Interest Summit','Services','Stories'].map((name,i)=>`<label>${escape(name)}<textarea name="ecosystem_${i}" maxlength="600">${escape(value?.[name]||'')}</textarea></label>`).join('')}</fieldset>`;continue;}
  if(['featured_products','featured_stories'].includes(key)){const tableName=key==='featured_products'?'products':'articles',available=(await api('admin/list?'+new URLSearchParams({entity:tableName,status:'published',limit:'100'}))).rows;html+=`<fieldset class="wide"><legend>${escape(label(key))}</legend><p>Choose up to 12 published records. An empty selection uses the standard listing.</p>${available.map(record=>`<label><input type="checkbox" name="${key}" value="${record.id}" ${value?.includes(record.id)?'checked':''}>${escape(record.title)}</label>`).join('')||'<p>Publish approved records first.</p>'}</fieldset>`;continue;}
  html+=`<label class="wide">${escape(label(key))}<textarea name="${key}" data-setting="${key}" maxlength="3000">${escape(value||'')}</textarea></label>`;
 }
 modal(`<h3>${sensitive?'High-impact settings':'Website content'}</h3>${form('settings',html+(sensitive?input('confirmation','text','','required placeholder="CHANGE SETTING"'):'')+'<p>Only changed fields are saved together. Clearing an override restores the original content.</p>',`data-sensitive="${sensitive}"`)}`);
}
function collectSettings(form){const data=new FormData(form),updates=[];const add=(key,value)=>{if(JSON.stringify(settings[key]??null)!==JSON.stringify(value))updates.push({key,value});};
 for(const field of form.querySelectorAll('[data-setting]'))add(field.dataset.setting,field.type==='checkbox'?field.checked:field.value.trim()||null);
 if(form.elements.financial_days){if(form.elements.financial_days.value)add('retention_rules',{financial_days:Number(form.elements.financial_days.value),retain_purchase_access:form.elements.retain_purchase_access.checked});}
 if(form.elements.hero_image_0)add('hero_images',Array.from({length:3},(_,i)=>form.elements['hero_image_'+i].value.trim()).filter(Boolean).length?Array.from({length:3},(_,i)=>form.elements['hero_image_'+i].value.trim()).filter(Boolean):null);
 for(const key of ['social_links','footer_links'])if(form.elements[key+'_label_0']){const links=[];for(let i=0;i<4;i++){const label=form.elements[key+'_label_'+i].value.trim(),url=form.elements[key+'_url_'+i].value.trim();if(label||url)links.push({label,url});}add(key,links.length?links:null);}
 if(form.elements.ecosystem_0){const descriptions={};['Yolena','Store','Community','Compound Interest Summit','Services','Stories'].forEach((name,i)=>{const value=form.elements['ecosystem_'+i].value.trim();if(value)descriptions[name]=value;});add('ecosystem_descriptions',Object.keys(descriptions).length?descriptions:null);}
 for(const key of ['featured_products','featured_stories'])if(form.querySelector(`[name=${key}]`)){const ids=data.getAll(key);add(key,ids.length?ids:null);}
 return updates;
}
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-action]');if(!b)return;const d=b.dataset,row=rows[Number(d.index)];b.disabled=true;
 try{
  switch(d.action){
   case 'close':close();break;
   case 'section':section=d.section;offset=0;location.hash=section;await render();break;
   case 'entity':entity=d.entity;offset=0;await render();break;
   case 'previous':offset=Math.max(0,offset-25);await render();break;
   case 'next':if(rows.length===25){offset+=25;await render();}break;
   case 'create':await openEditor();break;
   case 'edit':await openEditor(row);break;
   case 'archive':modal(`<h3>Archive ${escape(row.title||row.name)}</h3><p>Historical orders and registrations will be preserved. The record will be removed from public listings.</p>${form('archive',input('confirmation','text','','required placeholder="ARCHIVE"'),`data-id="${row.id}" data-entity="${entity}"`)}`);break;
   case 'enroll':{const f=await api('admin/mfa/enroll',{});factorId=f.id;$('#enrollment').innerHTML=`<p>Add this setup key to an authenticator app. Keep it private.</p><p class="key">${escape(f.secret)}</p>`;challengeId=(await api('admin/mfa/challenge',{factor_id:factorId})).id;break;}
   case 'order':await orderModal(row);break;
   case 'reconcile':{const r=await api('admin/order_reconcile',{reference:d.reference});feedback($('#operation-feedback'),`Verified provider result: ${r.status}`);break;}
   case 'fulfillment':modal(form('fulfillment',input('reason','text','','required minlength="5"'),`data-reference="${d.reference}"`));break;
   case 'refund':modal(`<h3>Request a provider refund</h3><p>This sends a full-refund request to Paystack test mode. The order remains paid until a processed refund is independently verified.</p>${form('refund',input('reason','text','','required minlength="5"')+input('confirmation','text','','required',`Type ${d.reference} to confirm.`),`data-reference="${d.reference}" data-key="${crypto.randomUUID()}"`)}`);break;
   case 'registration':modal(`<h3>Manage ${escape(row.reference)}</h3>${form('registration',`<label>Action<select name="operation"><option value="check_in">Record attendance</option><option value="promote">Promote a free waitlist seat</option><option value="cancel">Cancel (unpaid/free only)</option></select></label>`,`data-id="${row.id}"`)}`);break;
   case 'session-tools':{const speakers=(await api('admin/list?entity=speakers&limit=100')).rows;modal(`<h3>Manage ${escape(row.title)}</h3>${form('session-speakers',speakers.map(s=>`<label><input type="checkbox" name="speaker_ids" value="${s.id}" ${row.speaker_ids?.includes(s.id)?'checked':''}>${escape(s.name)}</label>`).join('')||'<p>Create approved speaker records first.</p>',`data-id="${row.id}"`)}<h3>Cancel session</h3>${form('session-cancel',input('reason','text','','required minlength="5"')+input('confirmation','text','','required placeholder="CANCEL SESSION"'),`data-id="${row.id}"`)}`);break;}
   case 'report':modal(`<h3>Report review</h3><p class="preformatted">${escape(row.reason)}\n${escape(row.post_body||row.comment_body)}</p>${form('report',`<label>Decision<select name="decision"><option value="hide">Hide content (preserve evidence)</option><option value="dismiss">Dismiss report</option></select></label><label>Internal moderation note<textarea name="note" maxlength="2000"></textarea></label>`,`data-id="${row.id}"`)}`);break;
   case 'post-tools':modal(form('post-tools',['hidden','featured','announcement'].map(k=>`<label><input type="checkbox" name="${k}" ${row[k]?'checked':''}>${escape(label(k))}</label>`).join(''),`data-id="${row.id}"`));break;
   case 'restrict':modal(form('restrict',input('reason','text','','required minlength="5"')+input('until','datetime-local','','','Optional UTC expiry; leave blank for an indefinite restriction.'),`data-user="${row.user_id}" data-community="${row.community_id}"`));break;
   case 'user':{const info=await api('admin/user_detail?id='+row.id);modal(`<h3>${escape(row.display_name||row.email)}</h3><p>${escape(row.email)}</p><details><summary>Permitted account relationships</summary><pre class="preformatted">${escape(JSON.stringify(info,null,2))}</pre></details>${form('user-control',`<label><input name="suspended" type="checkbox" ${row.suspended?'checked':''}>Suspend account</label>`+input('reason','text','','required minlength="5"','Saving also revokes existing sessions.'),`data-user="${row.id}"`)}${permissions.includes('roles')?'<h3>Access roles</h3>'+form('roles',['super_admin','admin','editor','event_manager','store_manager','moderator'].map(role=>`<label><input name="roles" type="checkbox" value="${role}" ${row.roles.includes(role)?'checked':''}>${escape(label(role))}</label>`).join('')+input('confirmation','text','','required placeholder="CHANGE ROLES"'),`data-user="${row.id}"`):''}`);break;}
   case 'deletion':modal(`<h3>Deletion review</h3><p>Legal and retention rules must be approved before completion. Historical financial and attendance records are preserved according to those rules.</p>${form('deletion',input('note','text','','required minlength="10"')+input('confirmation','text','','required placeholder="RETENTION REVIEWED"'),`data-user="${row.user_id}"`)}${permissions.includes('roles')?'<h3>Complete an approved identity deletion</h3>'+form('delete-account',input('note','text','','required minlength="10"')+input('confirmation','text','','required placeholder="DELETE ACCOUNT"'),`data-user="${row.user_id}" data-key="${crypto.randomUUID()}"`):''}`);break;
   case 'unsubscribe':await api('admin/unsubscribe',{id:row.id});await render();break;
   case 'preview':{const revisions=await api('admin/revisions?entity=articles&id='+row.id);modal(`<h3>${escape(row.title)} · ${escape(row.status)}</h3><p>${escape(row.author)} · ${escape(row.published_at||'Unscheduled draft')}</p><div class="preview">${escape(row.body)}</div><h3>Publishing/edit history</h3><ul>${revisions.map(r=>`<li>${escape(date(r.created_at))} · ${escape(r.data.status)}</li>`).join('')}</ul>`);break;}
   case 'media':{const media=(await api('admin/media?permission=products&limit=100')).rows;modal(`<h3>Product media</h3>${media.map(m=>`<div class="panel"><p>${escape(m.storage_path)} · ${escape(m.scan_status)}</p>${m.bucket==='quarantine'?btn('Run configured scanner','scan',{id:m.id}):''}</div>`).join('')||'<p>No uploaded media.</p>'}`);break;}
   case 'scan':{const r=await api('admin/scan',{id:d.id});feedback($('#page-status'),`Scan result: ${r.status}`);close();break;}
   case 'upload':await upload(b);break;
   case 'settings-editor':await settingsEditor();break;
   case 'sensitive-settings':await settingsEditor(true);break;
   case 'policies':{const result=await api('admin/list?entity=legal_policies');rows=result.rows;entity='legal_policies';modal(`<h3>Policy management</h3><p>Publish only business/legal-approved text. Generic drafts are not approved policy.</p>${btn('Create policy','create')}${rows.map((r,i)=>`<div class="panel"><b>${escape(r.title)}</b> · ${r.approved?'Approved':'Not approved'} ${btn('Edit','edit',{index:i})}</div>`).join('')}`);break;}
   case 'export':{const type=section==='orders'?'orders':section==='inquiries'?'inquiries':entity;const r=await fetch('/api/admin/export?'+query({entity:type}),{credentials:'same-origin'});if(!r.ok)throw {code:(await r.json()).error};const link=document.createElement('a');link.href=URL.createObjectURL(await r.blob());link.download=`1751-${type}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);break;}
   case 'resolve-incident':await api('admin/incident_resolve',{id:row.id});await render();break;
   case 'audit-detail':modal(`<h3>Audit change</h3><pre class="preformatted">${escape(JSON.stringify(row,null,2))}</pre>`);break;
  }
 }catch(e){const node=$('#editor-content [data-feedback]')||$('#operation-feedback')||$('#page-status');feedback(node,message(e),true);}finally{if(b.isConnected)b.disabled=false;}
});
document.addEventListener('submit',async event=>{
 const f=event.target;if(!f.dataset.form)return;event.preventDefault();if(!f.reportValidity())return;const d=Object.fromEntries(new FormData(f)),action=f.dataset.form,feedbackNode=f.querySelector('[data-feedback]');const submit=f.querySelector('button:not([type=button])');if(submit.disabled)return;submit.disabled=true;feedback(feedbackNode,'Saving…');
 try{
  let result;
  if(action==='login'){await api('auth/login',d);await initialize();return;}
  if(action==='mfa'){if(!factorId||!challengeId)throw {code:'enroll_authenticator_first'};await api('admin/mfa/verify',{factor_id:factorId,challenge_id:challengeId,code:d.code});await initialize();return;}
  if(action==='record'){
   const data={};for(const [key,type] of Object.entries(ENTITIES[f.dataset.entity].fields)){const value=d[key];if(type==='boolean')data[key]=f.elements[key].checked;else if(!Array.isArray(type)&&['price','positive','nonnegative','positive?','percent'].includes(type))data[key]=value===''?null:Math.round(Number(value)*(key.endsWith('_minor')?100:1));else data[key]=value===''&&!Array.isArray(type)&&type.endsWith('?')?null:value;}
   result=await api('admin/save',{entity:f.dataset.entity,id:f.dataset.id||null,data,expected_updated_at:f.dataset.version||null,confirmation:d.confirmation});
  }else if(action==='archive'){if(d.confirmation!=='ARCHIVE')throw {code:'confirmation_required'};result=await api('admin/archive',{entity:f.dataset.entity,id:f.dataset.id});}
  else if(action==='registration')result=await api('admin/registration_action',{id:f.dataset.id,operation:d.operation});
  else if(action==='session-cancel')result=await api('admin/session_cancel',{id:f.dataset.id,...d});
  else if(action==='session-speakers')result=await api('admin/session_speakers',{session_id:f.dataset.id,speaker_ids:new FormData(f).getAll('speaker_ids')});
  else if(action==='report')result=await api('admin/moderate',{id:f.dataset.id,...d});
  else if(action==='post-tools')result=await api('admin/post_moderate',{id:f.dataset.id,...Object.fromEntries(['hidden','featured','announcement'].map(k=>[k,f.elements[k].checked]))});
  else if(action==='restrict')result=await api('admin/restriction',{user_id:f.dataset.user,community_id:f.dataset.community,reason:d.reason,until:d.until?new Date(d.until+'Z').toISOString():null});
  else if(action==='user-control')result=await api('admin/user_control',{user_id:f.dataset.user,reason:d.reason,suspended:f.elements.suspended.checked});
  else if(action==='roles')result=await api('admin/roles',{user_id:f.dataset.user,roles:new FormData(f).getAll('roles'),confirmation:d.confirmation});
  else if(action==='deletion')result=await api('admin/deletion_review',{user_id:f.dataset.user,...d});
  else if(action==='delete-account')result=await api('admin/delete_account',{user_id:f.dataset.user,key:f.dataset.key,...d});
  else if(action==='refund')result=await api('admin/refund_prepare',{reference:f.dataset.reference,key:f.dataset.key,...d});
  else if(action==='fulfillment')result=await api('admin/order_resolve',{reference:f.dataset.reference,...d});
  else if(action==='settings'){result=await api('admin/settings_batch',{updates:collectSettings(f),confirmation:d.confirmation});}
  feedback(feedbackNode,action==='refund'?`Provider refund requested (${result.status}). Await independently verified processing.`:action==='deletion'?'Review recorded; external identity/retention completion remains required.':'Saved.');await render();
 }catch(e){feedback(feedbackNode,message(e),true);}finally{if(submit.isConnected)submit.disabled=false;}
});
$('#filters').onsubmit=e=>{e.preventDefault();offset=0;render();};$('#refresh').onclick=render;$('#menu-toggle').onclick=()=>{$('#admin-nav').classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',String($('#admin-nav').classList.contains('open')));};$('#logout').onclick=async()=>{await api('auth/logout',{});$('#logout').hidden=true;showLogin();};
const today=new Date(),ago=new Date(Date.now()-30*86400000);$('#filters').elements.from.value=ago.toISOString().slice(0,10);$('#filters').elements.to.value=today.toISOString().slice(0,10);initialize();
