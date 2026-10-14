begin;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 2 and 100),
 avatar_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles(user_id uuid references auth.users on delete cascade, role text check(role in ('admin','moderator')), primary key(user_id,role));
create table public.categories(id uuid primary key default gen_random_uuid(), name text not null unique);
create table public.products (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null default '',
 category_id uuid references public.categories, price_minor integer not null check(price_minor>0), currency text not null default 'NGN' check(currency='NGN'),
 product_type text not null default 'digital' check(product_type in ('digital','physical','course')),
 image_url text, status text not null default 'draft' check(status in ('draft','published','unavailable')), featured integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_assets(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products on delete cascade,storage_path text not null unique check(storage_path not like '/%' and storage_path !~ '(^|/)[.][.](/|$)'),download_limit integer check(download_limit>0));
create table public.carts(user_id uuid primary key references auth.users on delete cascade,updated_at timestamptz not null default now());
create table public.cart_items(user_id uuid references public.carts on delete cascade,product_id uuid references public.products,quantity integer not null check(quantity between 1 and 99),primary key(user_id,product_id));
create table public.promotions(code text primary key check(code=upper(code)),percent integer not null check(percent between 1 and 90),expires_at timestamptz not null,max_uses integer not null check(max_uses>0),active boolean not null default false,minimum_minor integer not null default 0 check(minimum_minor>=0));
create table public.orders (
 id uuid primary key default gen_random_uuid(),reference text not null unique default ('1751_'||replace(gen_random_uuid()::text,'-','')),
 user_id uuid references auth.users on delete set null,email text not null,customer_name text not null,
 client_key uuid not null,request_fingerprint text not null,access_hash text not null,
 total_minor integer not null check(total_minor>0),currency text not null default 'NGN' check(currency='NGN'),
 status text not null default 'pending' check(status in ('pending','paid','failed','cancelled','refunded')),
 promotion_code text references public.promotions,checkout_url text,receipt_url text,fulfillment_hold boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(email,client_key)
);
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders on delete cascade,product_id uuid references public.products,title text not null,quantity integer not null check(quantity between 1 and 99),unit_minor integer not null check(unit_minor>0));
create table public.payments(id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.orders,provider_id text not null unique,amount_minor integer not null,currency text not null,paid_at timestamptz not null default now());
create table public.payment_events(event_key text primary key,order_id uuid references public.orders,event_type text not null,created_at timestamptz not null default now());
create table public.entitlements(order_id uuid references public.orders,product_id uuid references public.products,created_at timestamptz not null default now(),revoked_at timestamptz,primary key(order_id,product_id));
create table public.downloads(id uuid primary key default gen_random_uuid(),order_id uuid references public.orders,asset_id uuid references public.product_assets,created_at timestamptz not null default now());
create table public.summits(id uuid primary key default gen_random_uuid(),title text not null,description text not null default '',starts_on date not null,ends_on date not null,timezone text not null default 'Africa/Lagos',published boolean not null default false,check(ends_on>=starts_on));
create table public.sessions(id uuid primary key default gen_random_uuid(),summit_id uuid not null references public.summits,title text not null,description text not null default '',starts_at timestamptz not null,ends_at timestamptz not null,category text not null default '',location text,meeting_url text,capacity integer check(capacity>0),waitlist_enabled boolean not null default false,registration_closes_at timestamptz not null,registration_open boolean not null default false,published boolean not null default false,price_minor integer not null default 0 check(price_minor>=0),cancellation_allowed boolean not null default true,check(ends_at>starts_at));
create table public.speakers(id uuid primary key default gen_random_uuid(),name text not null,bio text not null default '',image_url text);
create table public.session_speakers(session_id uuid references public.sessions,speaker_id uuid references public.speakers,primary key(session_id,speaker_id));
create table public.registrations(id uuid primary key default gen_random_uuid(),reference text not null unique default ('REG_'||replace(gen_random_uuid()::text,'-','')),session_id uuid not null references public.sessions,user_id uuid not null references auth.users on delete cascade,email text not null,name text not null,status text not null check(status in ('confirmed','pending','waitlisted','cancelled')),order_id uuid unique references public.orders,checked_in_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(session_id,user_id));
create table public.communities(id uuid primary key default gen_random_uuid(),name text not null,description text not null default '',visibility text not null default 'public' check(visibility in ('public','members')),join_open boolean not null default true,published boolean not null default false);
create table public.memberships(community_id uuid references public.communities,user_id uuid references auth.users on delete cascade,created_at timestamptz not null default now(),primary key(community_id,user_id));
create table public.community_categories(id uuid primary key default gen_random_uuid(),community_id uuid not null references public.communities,name text not null,unique(community_id,name));
create table public.posts(id uuid primary key default gen_random_uuid(),community_id uuid not null references public.communities,category_id uuid references public.community_categories,author_id uuid not null references auth.users on delete cascade,title text not null check(length(title) between 3 and 180),body text not null check(length(body) between 3 and 10000),hidden boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.comments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts on delete cascade,parent_id uuid references public.comments on delete cascade,author_id uuid not null references auth.users on delete cascade,body text not null check(length(body) between 2 and 5000),hidden boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.content_reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references auth.users on delete cascade,post_id uuid references public.posts on delete cascade,comment_id uuid references public.comments on delete cascade,reason text not null check(length(reason) between 5 and 1000),status text not null default 'open' check(status in ('open','dismissed','actioned')),reviewer_id uuid references auth.users,created_at timestamptz not null default now(),check(num_nonnulls(post_id,comment_id)=1));
create unique index report_post_once on public.content_reports(reporter_id,post_id) where post_id is not null;
create unique index report_comment_once on public.content_reports(reporter_id,comment_id) where comment_id is not null;
create table public.articles(id uuid primary key default gen_random_uuid(),slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),title text not null,category text not null,excerpt text not null default '',body text not null,cover_image text,author text not null,published_at timestamptz,reading_minutes integer not null check(reading_minutes>0),status text not null default 'draft' check(status in ('draft','published')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.inquiries(id uuid primary key default gen_random_uuid(),reference text not null unique default ('INQ_'||replace(gen_random_uuid()::text,'-','')),client_key uuid not null unique,name text not null,email text not null,organization text,inquiry_type text not null check(inquiry_type in ('project','training','partnership','general')),message text not null,budget text,contact_method text not null check(contact_method in ('email','phone')),phone text,consent_at timestamptz not null,created_at timestamptz not null default now());
create table public.newsletter_subscriptions(id uuid primary key default gen_random_uuid(),email text not null unique,status text not null check(status in ('pending','subscribed','unsubscribed')),consent_at timestamptz not null,confirmed_at timestamptz,token_hash text not null unique,token_expires_at timestamptz not null,unsubscribe_hash text not null unique,updated_at timestamptz not null default now());
create table public.deletion_requests(user_id uuid primary key references auth.users on delete cascade,requested_at timestamptz not null default now(),status text not null default 'requested' check(status in ('requested','completed')));
create table public.email_outbox(id uuid primary key default gen_random_uuid(),dedupe_key text not null unique,recipient text not null,template text not null,data jsonb not null,status text not null default 'pending' check(status in ('pending','sending','sent','failed')),attempts integer not null default 0,available_at timestamptz not null default now(),sent_at timestamptz,last_error text,created_at timestamptz not null default now());
create table public.rate_limits(bucket text primary key,hits integer not null,expires_at timestamptz not null);

create index products_catalog on public.products(status,category_id,price_minor);
create index orders_user on public.orders(user_id,created_at desc);
create index registration_capacity on public.registrations(session_id,status);
create index posts_feed on public.posts(community_id,created_at desc);
create index comments_thread on public.comments(post_id,created_at);
create index sessions_schedule on public.sessions(summit_id,starts_at);
create index outbox_pending on public.email_outbox(status,available_at);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = public, pg_temp as $$begin new.updated_at=now(); return new; end$$;
do $$declare t text;begin
 foreach t in array array['profiles','products','orders','registrations','posts','comments','articles','newsletter_subscriptions'] loop
 execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()',t,t);
 end loop;
 for t in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end$$;
-- Defense in depth: own-row policies; frontend access is still revoked and must use the API.
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
create policy own_orders on public.orders for select to authenticated using(user_id=auth.uid());
create policy own_registrations on public.registrations for select to authenticated using(user_id=auth.uid());
create policy own_cart on public.cart_items for select to authenticated using(user_id=auth.uid());
create policy own_memberships on public.memberships for select to authenticated using(user_id=auth.uid());

create function public.can_read_community(cid uuid,actor uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from communities c where c.id=cid and c.published and
 (c.visibility='public' or exists(select 1 from memberships m where m.community_id=cid and m.user_id=actor) or exists(select 1 from user_roles where user_id=actor)));
$$;
create function public.queue_email(k text,recipient text,template text,data jsonb) returns void language sql security definer set search_path=public,pg_temp as $$
 insert into email_outbox(dedupe_key,recipient,template,data) values(k,recipient,template,data) on conflict(dedupe_key) do nothing;
$$;

-- Only the trusted server can call this RPC. actor is obtained from Supabase Auth, never browser input.
create function public.platform(action text,p jsonb default '{}'::jsonb,actor uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; item jsonb; prod products; ord orders; sess sessions; reg registrations; sub newsletter_subscriptions;
 total bigint:=0; subtotal bigint:=0; count_items integer:=0; cap_count integer; quantity integer; promo promotions;
 rid uuid; cid uuid; pid uuid; aid uuid; owner uuid; lim integer:=least(50,greatest(1,coalesce((p->>'limit')::integer,20)));
 offst integer:=greatest(0,coalesce((p->>'offset')::integer,0)); query text:=left(coalesce(p->>'q',''),100); available boolean; rows_changed integer;
begin
 if action='rate' then
  insert into rate_limits(bucket,hits,expires_at) values(p->>'bucket',1,now()+interval '1 minute')
  on conflict(bucket) do update set hits=case when rate_limits.expires_at<now() then 1 else rate_limits.hits+1 end,
  expires_at=case when rate_limits.expires_at<now() then now()+interval '1 minute' else rate_limits.expires_at end returning hits<=(p->>'max')::integer into available;
  delete from rate_limits where expires_at<now()-interval '1 hour'; return jsonb_build_object('allowed',available);
 elsif action in ('products','product') then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
   select pr.id,pr.title,pr.description,pr.price_minor,pr.currency,pr.product_type,pr.image_url,pr.featured,c.name category
   from products pr left join categories c on c.id=pr.category_id where pr.status='published'
   and (action<>'product' or pr.id=(p->>'id')::uuid)
   and (query='' or pr.title ilike '%'||query||'%' or pr.description ilike '%'||query||'%')
   and (coalesce(p->>'category','All')='All' or c.name=p->>'category')
   order by case when p->>'sort'='low' then pr.price_minor end asc,
   case when p->>'sort'='high' then pr.price_minor end desc,
   case when p->>'sort'='alpha' then pr.title end,pr.featured,pr.id limit lim offset offst
  ) x; return result;
 elsif action='categories' then
  return coalesce((select jsonb_agg(name order by name) from categories),'[]');
 elsif action='summits' then
  return coalesce((select jsonb_agg(to_jsonb(s) order by starts_on desc) from summits s where published),'[]');
 elsif action in ('events','event') then
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
   select s.id,s.summit_id,s.title,s.description,s.starts_at,s.ends_at,s.category,s.location,s.capacity,s.registration_open,s.registration_closes_at,s.price_minor,s.waitlist_enabled,s.cancellation_allowed,sm.timezone,
    coalesce((select jsonb_agg(jsonb_build_object('name',sp.name,'bio',sp.bio,'image_url',sp.image_url)) from session_speakers ss join speakers sp on sp.id=ss.speaker_id where ss.session_id=s.id),'[]') speakers
   from sessions s join summits sm on sm.id=s.summit_id where s.published and sm.published
   and (action<>'event' or s.id=(p->>'id')::uuid) and (p->>'summit_id' is null or s.summit_id=(p->>'summit_id')::uuid)
   and (query='' or s.title ilike '%'||query||'%') order by s.starts_at,s.id limit lim offset offst
  )x),'[]');
 elsif action in ('articles','article') then
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
   select id,slug,title,category,excerpt,case when action='article' then body end body,cover_image,author,published_at,reading_minutes from articles
   where status='published' and published_at<=now() and (action<>'article' or slug=p->>'slug')
   and (query='' or title ilike '%'||query||'%' or excerpt ilike '%'||query||'%') and (p->>'category' is null or category=p->>'category')
   order by published_at desc,id limit lim offset offst
  )x),'[]');
 elsif action='search' then
  return jsonb_build_object('products',platform('products',p,null),'events',platform('events',p,null),'articles',platform('articles',p,null));
 elsif action='communities' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'visibility',c.visibility,'join_open',c.join_open,'member',exists(select 1 from memberships where community_id=c.id and user_id=actor),'categories',coalesce((select jsonb_agg(to_jsonb(cc)) from community_categories cc where cc.community_id=c.id),'[]'))) from communities c where c.published),'[]');
 elsif action in ('posts','post') then
  cid:=(p->>'community_id')::uuid;
  if action='post' then select community_id into cid from posts where id=(p->>'id')::uuid;end if;
  if not can_read_community(cid,actor) then raise exception 'forbidden';end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
   select po.id,po.community_id,po.category_id,po.title,po.body,po.created_at,po.updated_at,po.author_id,coalesce(pr.display_name,'Member') author,
    case when action='post' then coalesce((select jsonb_agg(jsonb_build_object('id',co.id,'body',co.body,'author_id',co.author_id,'parent_id',co.parent_id,'author',coalesce(cp.display_name,'Member'),'created_at',co.created_at) order by co.created_at) from comments co left join profiles cp on cp.id=co.author_id where co.post_id=po.id and not co.hidden),'[]') end comments
   from posts po left join profiles pr on pr.id=po.author_id where po.community_id=cid and not hidden and (action<>'post' or po.id=(p->>'id')::uuid)
   and (query='' or po.title ilike '%'||query||'%' or po.body ilike '%'||query||'%') and (p->>'category_id' is null or po.category_id=(p->>'category_id')::uuid)
   order by po.created_at desc,po.id limit lim offset offst
  )x),'[]');
 elsif action='inquiry' then
  insert into inquiries(client_key,name,email,organization,inquiry_type,message,budget,contact_method,phone,consent_at)
  values((p->>'key')::uuid,p->>'name',p->>'email',p->>'organization',p->>'type',p->>'message',p->>'budget',p->>'contact_method',p->>'phone',now())
  on conflict(client_key) do nothing returning id into rid;
  if rid is null then select id into rid from inquiries where client_key=(p->>'key')::uuid and email=p->>'email';end if;
  if rid is null then raise exception 'conflict';end if;
  select jsonb_build_object('reference',reference) into result from inquiries where id=rid;
  perform queue_email('inquiry:'||rid,p->>'team_inbox','inquiry',p||result);
  return result||jsonb_build_object('notification','queued');
 elsif action='newsletter' then
  perform pg_advisory_xact_lock(hashtextextended(p->>'email',1));
  select * into sub from newsletter_subscriptions where email=p->>'email' for update;
  if found and sub.status='subscribed' then return jsonb_build_object('accepted',true);end if;
  if found and sub.status='pending' and sub.token_expires_at>now() then return jsonb_build_object('accepted',true);end if;
  insert into newsletter_subscriptions(email,status,consent_at,token_hash,token_expires_at,unsubscribe_hash)
  values(p->>'email','pending',now(),p->>'token_hash',now()+interval '24 hours',p->>'unsubscribe_hash')
  on conflict(email) do update set status='pending',consent_at=now(),token_hash=excluded.token_hash,token_expires_at=excluded.token_expires_at,unsubscribe_hash=excluded.unsubscribe_hash;
  perform queue_email('newsletter:'||(p->>'token_hash'),p->>'email','newsletter',jsonb_build_object('confirm_url',p->>'confirm_url','unsubscribe_url',p->>'unsubscribe_url'));
  return jsonb_build_object('accepted',true);
 elsif action='newsletter_confirm' then
  update newsletter_subscriptions set status='subscribed',confirmed_at=coalesce(confirmed_at,now()) where token_hash=p->>'token_hash' and token_expires_at>now() and status in ('pending','subscribed');
  get diagnostics rows_changed=row_count;if rows_changed=0 then raise exception 'invalid_or_expired';end if;return jsonb_build_object('status','subscribed');
 elsif action='newsletter_unsubscribe' then
  update newsletter_subscriptions set status='unsubscribed' where unsubscribe_hash=p->>'token_hash';
  get diagnostics rows_changed=row_count;if rows_changed=0 then raise exception 'invalid_or_expired';end if;return jsonb_build_object('status','unsubscribed');
 elsif action='checkout' then
  perform pg_advisory_xact_lock(hashtextextended((p->>'email')||(p->>'key'),0));
  select * into ord from orders where email=p->>'email' and client_key=(p->>'key')::uuid;
  if found then
   if ord.user_id is distinct from actor or ord.request_fingerprint<>p->>'fingerprint' or ord.access_hash<>p->>'access_hash' then raise exception 'conflict';end if;
   return jsonb_build_object('id',ord.id,'reference',ord.reference,'total_minor',ord.total_minor,'status',ord.status,'checkout_url',ord.checkout_url);
  end if;
  if jsonb_array_length(p->'items') not between 1 and 50 then raise exception 'invalid_cart';end if;
  -- Stable product lock ordering prevents concurrent mixed baskets deadlocking.
  perform 1 from products where id in (select (x->>'id')::uuid from jsonb_array_elements(p->'items')x) order by id for share;
  for item in select * from jsonb_array_elements(p->'items') loop
   select * into prod from products where id=(item->>'id')::uuid and status='published';
   if not found then raise exception 'unavailable_product';end if;
   quantity:=(item->>'quantity')::integer;
   if quantity not between 1 and 99 or (prod.product_type<>'physical' and quantity<>1) then raise exception 'invalid_quantity';end if;
   if prod.product_type='physical' then raise exception 'physical_fulfillment_not_configured';end if;
   if not exists(select 1 from product_assets where product_id=prod.id) then raise exception 'unavailable_product_asset';end if;
   subtotal:=subtotal+prod.price_minor::bigint*quantity;count_items:=count_items+1;
  end loop;
  total:=subtotal;
  if nullif(p->>'promotion','') is not null then
   select * into promo from promotions where code=upper(p->>'promotion') for update;
   if not found or not promo.active or promo.expires_at<=now() or subtotal<promo.minimum_minor or (select count(*) from orders where promotion_code=promo.code and status in ('pending','paid'))>=promo.max_uses then raise exception 'invalid_promotion';end if;
   total:=subtotal-floor(subtotal*promo.percent/100.0);
  end if;
  if total>2000000000 then raise exception 'invalid_total';end if;
  insert into orders(user_id,email,customer_name,client_key,request_fingerprint,access_hash,total_minor,promotion_code,receipt_url)
  values(actor,p->>'email',p->>'name',(p->>'key')::uuid,p->>'fingerprint',p->>'access_hash',total,case when promo.code is not null then promo.code end,p->>'receipt_url') returning * into ord;
  for item in select * from jsonb_array_elements(p->'items') loop
   select * into prod from products where id=(item->>'id')::uuid;
   insert into order_items(order_id,product_id,title,quantity,unit_minor) values(ord.id,prod.id,prod.title,(item->>'quantity')::integer,prod.price_minor);
  end loop;
  return jsonb_build_object('id',ord.id,'reference',ord.reference,'total_minor',ord.total_minor,'status',ord.status);
 elsif action='order' then
  select * into ord from orders where reference=p->>'reference' and ((actor is not null and user_id=actor) or access_hash=p->>'access_hash');
  if not found then raise exception 'not_found';end if;
  return jsonb_build_object('id',ord.id,'reference',ord.reference,'status',ord.status,'email',ord.email,'total_minor',ord.total_minor,'checkout_url',ord.checkout_url,'fulfillment_hold',ord.fulfillment_hold,
   'items',coalesce((select jsonb_agg(jsonb_build_object('title',i.title,'quantity',i.quantity,'unit_minor',i.unit_minor,'product_id',i.product_id,'assets',case when ord.status='paid' then coalesce((select jsonb_agg(jsonb_build_object('id',a.id)) from product_assets a where a.product_id=i.product_id),'[]') else '[]'::jsonb end)) from order_items i where i.order_id=ord.id),'[]'));
 elsif action='download' then
  select * into ord from orders where reference=p->>'reference' and status='paid' and ((actor is not null and user_id=actor) or access_hash=p->>'access_hash') for update;
  if not found then raise exception 'forbidden';end if;
  select a.id,a.product_id into aid,pid from product_assets a join entitlements e on e.product_id=a.product_id and e.order_id=ord.id and e.revoked_at is null where a.id=(p->>'asset_id')::uuid;
  if not found then raise exception 'forbidden';end if;
  if exists(select 1 from product_assets where id=aid and download_limit is not null and download_limit<=(select count(*) from downloads where order_id=ord.id and asset_id=aid)) then raise exception 'download_limit';end if;
  insert into downloads(order_id,asset_id) values(ord.id,aid) returning id into rid;
  return (select jsonb_build_object('path',storage_path,'reservation_id',rid) from product_assets where id=aid);
 elsif action='download_failed' then
  delete from downloads where id=(p->>'id')::uuid;return '{}';
 elsif action='receipt_url' then
  update orders set receipt_url=p->>'url' where reference=p->>'reference';return '{}';
 elsif action='payment_url' then
  update orders set checkout_url=p->>'url' where reference=p->>'reference' and status='pending';return '{}';
 elsif action='payment_state' then
  update orders set status=p->>'status' where reference=p->>'reference' and status in ('pending','failed','cancelled');return '{}';
 elsif action='finalize_payment' then
  select * into ord from orders where reference=p->>'reference' for update;
  if not found then raise exception 'not_found';end if;
  if ord.total_minor<>(p->>'amount')::bigint or ord.currency<>p->>'currency' then raise exception 'payment_mismatch';end if;
  if ord.status='refunded' then return jsonb_build_object('status','refunded');end if;
  if ord.status='paid' then
   if not exists(select 1 from payments where order_id=ord.id and provider_id=p->>'provider_id') then raise exception 'duplicate_payment';end if;
   return jsonb_build_object('status','paid');
  end if;
  insert into payments(order_id,provider_id,amount_minor,currency) values(ord.id,p->>'provider_id',ord.total_minor,ord.currency);
  insert into payment_events(event_key,order_id,event_type) values('charge:'||(p->>'provider_id'),ord.id,'charge.success') on conflict do nothing;
  update orders set status='paid' where id=ord.id;
  insert into entitlements(order_id,product_id) select ord.id,product_id from order_items where order_id=ord.id and product_id is not null on conflict do nothing;
  -- Capacity stays reserved for pending paid registrations until payment is reconciled.
  select * into reg from registrations where order_id=ord.id;
  if found then
   if reg.status='cancelled' then update orders set fulfillment_hold=true where id=ord.id;
   else update registrations set status='confirmed' where id=reg.id;
    perform queue_email('registration:'||reg.id,reg.email,'registration',jsonb_build_object('reference',reg.reference,'session_id',reg.session_id));end if;
  end if;
  perform queue_email('order:'||ord.id,ord.email,'order',jsonb_build_object('reference',ord.reference,'total_minor',ord.total_minor,'url',coalesce(ord.receipt_url,p->>'order_url')));
  return jsonb_build_object('status','paid');
 elsif action='refund' then
  select * into ord from orders where reference=p->>'reference' for update;
  if not found then raise exception 'not_found';end if;
  if (p->>'amount')::bigint<>ord.total_minor then raise exception 'partial_refund_requires_review';end if;
  insert into payment_events(event_key,order_id,event_type) values('refund:'||(p->>'provider_id'),ord.id,'refund.processed') on conflict do nothing;
  update orders set status='refunded' where id=ord.id and status='paid';
  update entitlements set revoked_at=now() where order_id=ord.id;
  update registrations set status='cancelled' where order_id=ord.id;
  return jsonb_build_object('status','refunded');
 elsif action='claim_emails' then
  with batch as (select id from email_outbox where (status='pending' or (status='sending' and available_at<now())) and available_at<=now() and attempts<5 order by created_at for update skip locked limit 20),claimed as
   (update email_outbox set status='sending',attempts=attempts+1,available_at=now()+interval '5 minutes' where id in (select id from batch) returning *) select jsonb_agg(to_jsonb(claimed)) into result from claimed;
  return coalesce(result,'[]');
 elsif action='email_result' then
  update email_outbox set status=case when (p->>'sent')::boolean then 'sent' when attempts>=5 then 'failed' else 'pending' end,sent_at=case when (p->>'sent')::boolean then now() end,available_at=now()+interval '10 minutes',last_error=left(p->>'error',200) where id=(p->>'id')::uuid;return '{}';
 elsif action='pending_payments' then
  return coalesce((select jsonb_agg(reference) from (select reference from orders where status in ('pending','failed','cancelled') and created_at>now()-interval '30 days' order by created_at limit 50)x),'[]');
 end if;

 if actor is null then raise exception 'unauthorized';end if;
 if action='profile' then
  insert into profiles(id,display_name,avatar_url) values(actor,p->>'display_name',nullif(p->>'avatar_url','')) on conflict(id) do update set display_name=excluded.display_name,avatar_url=excluded.avatar_url;
  return jsonb_build_object('saved',true);
 elsif action='delete_request' then
  insert into deletion_requests(user_id) values(actor) on conflict do nothing;
  perform queue_email('delete:'||actor,p->>'team_inbox','deletion',jsonb_build_object('user_id',actor));return jsonb_build_object('requested',true);
 elsif action='dashboard' then
  return jsonb_build_object('profile',(select to_jsonb(pr) from profiles pr where id=actor),
   'orders',coalesce((select jsonb_agg(to_jsonb(x)) from (select reference,total_minor,status,created_at from orders where user_id=actor order by created_at desc limit 100)x),'[]'),
   'registrations',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'reference',r.reference,'status',r.status,'session_id',s.id,'title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at,'timezone',sm.timezone,'location',s.location,'meeting_url',case when r.status='confirmed' then s.meeting_url end,'cancellation_allowed',s.cancellation_allowed,'order_reference',o.reference)) from registrations r join sessions s on s.id=r.session_id join summits sm on sm.id=s.summit_id left join orders o on o.id=r.order_id where r.user_id=actor),'[]'),
   'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from memberships m join communities c on c.id=m.community_id where user_id=actor),'[]'),
   'posts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title)) from posts where author_id=actor and not hidden),'[]'),
   'roles',coalesce((select jsonb_agg(role) from user_roles where user_id=actor),'[]'),
   'deletion_requested',exists(select 1 from deletion_requests where user_id=actor));
 elsif action='cart' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',ci.product_id,'quantity',ci.quantity,'title',pr.title,'price_minor',pr.price_minor,'available',pr.status='published')) from cart_items ci join products pr on pr.id=ci.product_id where ci.user_id=actor),'[]');
 elsif action='cart_save' then
  insert into carts(user_id) values(actor) on conflict(user_id) do update set updated_at=now();
  perform 1 from carts where user_id=actor for update;
  delete from cart_items where user_id=actor;
  for item in select * from jsonb_array_elements(p->'items') loop
   insert into cart_items(user_id,product_id,quantity) values(actor,(item->>'id')::uuid,(item->>'quantity')::integer);
  end loop;return platform('cart','{}',actor);
 elsif action='register' then
  select * into sess from sessions where id=(p->>'session_id')::uuid and published for update;
  if not found or not exists(select 1 from summits where id=sess.summit_id and published) then raise exception 'not_found';end if;
  select * into reg from registrations where session_id=sess.id and user_id=actor;
  if found and reg.status<>'cancelled' then return jsonb_build_object('id',reg.id,'reference',reg.reference,'status',reg.status,'order_reference',(select reference from orders where id=reg.order_id));end if;
  if not sess.registration_open or sess.registration_closes_at<=now() then raise exception 'registration_closed';end if;
  cap_count:=(select count(*) from registrations where session_id=sess.id and status in ('confirmed','pending'));
  if sess.capacity is not null and cap_count>=sess.capacity then
   if not sess.waitlist_enabled then raise exception 'capacity_full';end if;
   available:=false;
  else available:=true;end if;
  if available and sess.price_minor>0 then
   insert into orders(user_id,email,customer_name,client_key,request_fingerprint,access_hash,total_minor) values(actor,p->>'email',p->>'name',gen_random_uuid(),sess.id::text,p->>'access_hash',sess.price_minor) returning * into ord;
   insert into order_items(order_id,title,quantity,unit_minor) values(ord.id,sess.title,1,sess.price_minor);
  end if;
  insert into registrations(session_id,user_id,email,name,status,order_id) values(sess.id,actor,p->>'email',p->>'name',case when not available then 'waitlisted' when sess.price_minor>0 then 'pending' else 'confirmed' end,ord.id)
  on conflict(session_id,user_id) do update set status=excluded.status,order_id=excluded.order_id,email=excluded.email,name=excluded.name returning * into reg;
  if reg.status in ('confirmed','waitlisted') then perform queue_email('registration:'||reg.id||':'||reg.status,reg.email,'registration',jsonb_build_object('reference',reg.reference,'title',sess.title,'starts_at',sess.starts_at,'timezone',(select timezone from summits where id=sess.summit_id),'status',reg.status));end if;
  return jsonb_build_object('id',reg.id,'reference',reg.reference,'status',reg.status,'order_reference',ord.reference);
 elsif action='registration_cancel' then
  select session_id into cid from registrations where id=(p->>'id')::uuid and user_id=actor;
  perform 1 from sessions where id=cid for update;
  select * into reg from registrations where id=(p->>'id')::uuid and user_id=actor for update;
  if not found then raise exception 'not_found';end if;
  if not exists(select 1 from sessions where id=reg.session_id and cancellation_allowed and starts_at>now()) then raise exception 'cancellation_closed';end if;
  if reg.status='pending' or exists(select 1 from orders where id=reg.order_id and status='paid') then raise exception 'paid_cancellation_requires_review';end if;
  available:=reg.status='confirmed';
  update registrations set status='cancelled' where id=reg.id;
  -- Promote only free waitlist seats automatically. Paid waitlist promotion requires reviewed invitation/payment.
  if available and exists(select 1 from sessions where id=reg.session_id and price_minor=0) then
   select * into reg from registrations where session_id=reg.session_id and status='waitlisted' order by created_at limit 1 for update;
   if found then update registrations set status='confirmed' where id=reg.id;perform queue_email('promoted:'||reg.id,reg.email,'registration',jsonb_build_object('reference',reg.reference,'status','confirmed'));end if;
  end if;return jsonb_build_object('cancelled',true);
 elsif action='membership' then
  cid:=(p->>'community_id')::uuid;
  if (p->>'join')::boolean then
   if not exists(select 1 from communities where id=cid and published and join_open) then raise exception 'joining_closed';end if;
   insert into memberships(community_id,user_id) values(cid,actor) on conflict do nothing;
  else delete from memberships where community_id=cid and user_id=actor;end if;
  return jsonb_build_object('member',(p->>'join')::boolean);
 elsif action in ('post_create','post_update','post_delete','comment_create','comment_update','comment_delete','report') then
  if action='post_create' then cid:=(p->>'community_id')::uuid;
  else
   if action in ('comment_update','comment_delete') or (action='report' and p->>'comment_id' is not null) then
    select post_id into pid from comments where id=coalesce(p->>'comment_id',p->>'id')::uuid;
   else pid:=coalesce(p->>'post_id',p->>'id')::uuid;end if;
   select community_id into cid from posts where id=pid and not hidden;
  end if;
  if not can_read_community(cid,actor) or not exists(select 1 from memberships where community_id=cid and user_id=actor) then raise exception 'forbidden';end if;
  if action in ('post_create','post_update') and p->>'category_id' is not null and not exists(select 1 from community_categories where id=(p->>'category_id')::uuid and community_id=cid) then raise exception 'invalid_category';end if;
  if action='post_create' then insert into posts(community_id,category_id,author_id,title,body) values(cid,(p->>'category_id')::uuid,actor,p->>'title',p->>'body') returning id into rid;
  elsif action='post_update' then update posts set title=p->>'title',body=p->>'body',category_id=(p->>'category_id')::uuid where id=pid and author_id=actor returning id into rid;
  elsif action='post_delete' then delete from posts where id=pid and author_id=actor returning id into rid;
  elsif action='comment_create' then
   if p->>'parent_id' is not null and not exists(select 1 from comments where id=(p->>'parent_id')::uuid and post_id=pid and not hidden) then raise exception 'invalid_parent';end if;
   insert into comments(post_id,parent_id,author_id,body) values(pid,(p->>'parent_id')::uuid,actor,p->>'body') returning id into rid;
  elsif action='comment_update' then update comments set body=p->>'body' where id=(p->>'id')::uuid and author_id=actor returning id into rid;
  elsif action='comment_delete' then delete from comments where id=(p->>'id')::uuid and author_id=actor returning id into rid;
  else
   insert into content_reports(reporter_id,post_id,comment_id,reason) values(actor,case when p->>'comment_id' is null then pid end,(p->>'comment_id')::uuid,p->>'reason') on conflict do nothing;return jsonb_build_object('reported',true);
  end if;
  if rid is null then raise exception 'forbidden';end if;return jsonb_build_object('id',rid);
 elsif action in ('reports','moderate','check_in') then
  if not exists(select 1 from user_roles where user_id=actor and role in ('moderator','admin')) then raise exception 'forbidden';end if;
  if action='reports' then return coalesce((select jsonb_agg(to_jsonb(x)) from (select * from content_reports where status='open' order by created_at limit lim)x),'[]');end if;
  if action='check_in' then
   update registrations set checked_in_at=now() where reference=p->>'reference' and status='confirmed' returning id into rid;
   if rid is null then raise exception 'not_found';end if;return jsonb_build_object('checked_in',true);
  end if;
  if (p->>'hide')::boolean then
   update posts set hidden=true where id=(select post_id from content_reports where id=(p->>'id')::uuid);
   update comments set hidden=true where id=(select comment_id from content_reports where id=(p->>'id')::uuid);
  end if;
  update content_reports set status=case when (p->>'hide')::boolean then 'actioned' else 'dismissed' end,reviewer_id=actor where id=(p->>'id')::uuid;
  return jsonb_build_object('reviewed',true);
 end if;
 raise exception 'unknown_action';
end$$;

revoke all on function public.platform(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.can_read_community(uuid,uuid) from public,anon,authenticated;
revoke all on function public.queue_email(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.platform(text,jsonb,uuid) to service_role;
commit;
