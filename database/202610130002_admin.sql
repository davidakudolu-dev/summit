begin;
alter table user_roles drop constraint user_roles_role_check;
alter table user_roles add constraint user_roles_role_check check(role in ('super_admin','admin','editor','event_manager','store_manager','moderator'));
create table role_permissions(role text not null,permission text not null,primary key(role,permission));
insert into role_permissions select 'super_admin',unnest(array['overview','products','orders','refunds','events','community','content','users','roles','inquiries','newsletter','analytics','settings','security']);
insert into role_permissions select 'admin',unnest(array['overview','products','orders','events','community','content','users','inquiries','newsletter','analytics','settings','security']);
insert into role_permissions values('editor','overview'),('editor','content'),('event_manager','overview'),('event_manager','events'),('store_manager','overview'),('store_manager','products'),('store_manager','orders'),('moderator','overview'),('moderator','community');
create table user_controls(user_id uuid primary key references auth.users on delete cascade,suspended boolean not null default false,reason text,updated_at timestamptz not null default now());
create table revoked_sessions(session_id text primary key,user_id uuid not null references auth.users on delete cascade,created_at timestamptz not null default now());
create table user_revocations(user_id uuid primary key references auth.users on delete cascade,revoked_before timestamptz not null);
create table community_restrictions(community_id uuid references communities,user_id uuid references auth.users on delete cascade,reason text not null,restricted_until timestamptz,created_at timestamptz not null default now(),primary key(community_id,user_id));
create table admin_audit(id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users on delete set null,action text not null,entity text,target text,before_data jsonb,after_data jsonb,request_id uuid not null,created_at timestamptz not null default now());
create table content_revisions(id uuid primary key default gen_random_uuid(),entity text not null,record_id text not null,data jsonb not null,editor_id uuid references auth.users on delete set null,created_at timestamptz not null default now());
create table media_assets(id uuid primary key default gen_random_uuid(),bucket text not null check(bucket in ('site-media','digital-products','quarantine')),storage_path text not null unique,kind text not null check(kind in ('image','document')),content_type text not null,size_bytes integer not null check(size_bytes>0),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),scan_status text not null check(scan_status in ('pending','clean','rejected')),uploaded_by uuid references auth.users,created_at timestamptz not null default now());
create table website_settings(key text primary key,value jsonb not null,updated_by uuid references auth.users,updated_at timestamptz not null default now());
create table legal_policies(slug text primary key check(slug in ('privacy','terms','cookies','refunds','digital-delivery','community-guidelines','event-terms')),title text not null,body text not null,approved boolean not null default false,approved_by uuid references auth.users,approved_at timestamptz,updated_at timestamptz not null default now());
create table operations_runs(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('email','reconcile','backup','restore','health')),status text not null check(status in ('ok','failed')),details jsonb not null default '{}',created_at timestamptz not null default now());
create table system_incidents(id uuid primary key default gen_random_uuid(),request_id uuid not null,code text not null,route text not null,resolved boolean not null default false,created_at timestamptz not null default now());
create table security_events(id uuid primary key default gen_random_uuid(),request_id uuid not null,actor_id uuid references auth.users on delete set null,code text not null,route text not null,created_at timestamptz not null default now());
create table refund_requests(id uuid primary key default gen_random_uuid(),order_id uuid not null references orders,client_key uuid not null unique,actor_id uuid references auth.users,provider_id text unique,status text not null default 'requested' check(status in ('requested','submitted','processed','failed','uncertain')),reason text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create unique index one_active_refund_per_order on refund_requests(order_id) where status in ('requested','submitted','uncertain','processed');
create table refund_records(provider_id text primary key,order_id uuid not null references orders,amount_minor integer not null check(amount_minor>0),processed_at timestamptz not null default now());
create table deletion_operations(id uuid primary key default gen_random_uuid(),target_user uuid not null,client_key uuid not null unique,actor_id uuid references auth.users on delete set null,status text not null default 'prepared' check(status in ('prepared','uncertain','completed')),registration_ids uuid[] not null default '{}',order_ids uuid[] not null default '{}',created_at timestamptz not null default now());
insert into refund_records(provider_id,order_id,amount_minor,processed_at) select substring(e.event_key from 8),o.id,o.total_minor,e.created_at from payment_events e join orders o on o.id=e.order_id where e.event_type='refund.processed' and o.status='refunded' on conflict do nothing;
alter table products add column archived boolean not null default false;
alter table articles add column archived boolean not null default false;
alter table summits add column archived boolean not null default false;
alter table communities add column archived boolean not null default false;
alter table sessions add column cancelled boolean not null default false;
alter table sessions add column updated_at timestamptz not null default now();
alter table sessions add column cancellation_reason text;
alter table posts add column featured boolean not null default false;
alter table posts add column announcement boolean not null default false;
alter table content_reports add column moderation_note text;
alter table inquiries add column status text not null default 'new' check(status in ('new','in_review','contacted','resolved'));
alter table inquiries add column internal_notes text not null default '';
alter table inquiries add column assigned_to uuid references auth.users;
alter table inquiries add column follow_up_at timestamptz;
alter table inquiries add column updated_at timestamptz not null default now();
alter table registrations drop constraint registrations_user_id_fkey;
alter table registrations alter column user_id drop not null;
alter table registrations add constraint registrations_user_id_fkey foreign key(user_id) references auth.users on delete set null;
alter table posts drop constraint posts_author_id_fkey;
alter table posts alter column author_id drop not null;
alter table posts add constraint posts_author_id_fkey foreign key(author_id) references auth.users on delete set null;
alter table comments drop constraint comments_author_id_fkey;
alter table comments alter column author_id drop not null;
alter table comments add constraint comments_author_id_fkey foreign key(author_id) references auth.users on delete set null;
alter table content_reports drop constraint content_reports_reporter_id_fkey;
alter table content_reports alter column reporter_id drop not null;
alter table content_reports add constraint content_reports_reporter_id_fkey foreign key(reporter_id) references auth.users on delete set null;
create trigger touch_sessions before update on sessions for each row execute function touch_updated_at();
create trigger touch_inquiries before update on inquiries for each row execute function touch_updated_at();
create index audit_recent on admin_audit(created_at desc);
create index audit_target on admin_audit(entity,target,created_at desc);
create index inquiries_workflow on inquiries(status,created_at desc);
create index payments_date on payments(paid_at);
create index incidents_open on system_incidents(resolved,created_at desc);
create index operations_recent on operations_runs(kind,created_at desc);
create index articles_publication on articles(status,published_at desc);
create index registrations_user on registrations(user_id,created_at desc);
create index orders_created on orders(created_at desc);
create index registrations_created on registrations(created_at desc);

do $$declare t text;begin
 foreach t in array array['role_permissions','user_controls','revoked_sessions','user_revocations','community_restrictions','admin_audit','content_revisions','media_assets','website_settings','legal_policies','operations_runs','system_incidents','security_events','refund_requests','refund_records','deletion_operations'] loop
 execute format('alter table %I enable row level security',t);execute format('revoke all on %I from anon,authenticated',t);
 end loop;
end$$;
create function immutable_admin_log() returns trigger language plpgsql set search_path=public,pg_temp as $$begin
 if tg_op='UPDATE' and pg_trigger_depth()>1 and to_jsonb(old)-ARRAY['actor_id','editor_id']=to_jsonb(new)-ARRAY['actor_id','editor_id'] then return new;end if;
 raise exception 'immutable_audit';end$$;
create trigger audit_immutable before update or delete on admin_audit for each row execute function immutable_admin_log();
create trigger revisions_immutable before update or delete on content_revisions for each row execute function immutable_admin_log();
create trigger operations_immutable before update or delete on operations_runs for each row execute function immutable_admin_log();
create trigger security_immutable before update or delete on security_events for each row execute function immutable_admin_log();
create function admin_permissions(actor uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(distinct permission),'[]') from role_permissions p join user_roles r on r.role=p.role where r.user_id=actor;
$$;
create function admin_check(actor uuid,permission text,mfa boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin
 if actor is null then raise exception 'unauthorized';end if;
 if exists(select 1 from user_controls where user_id=actor and suspended) then raise exception 'account_suspended';end if;
 if not exists(select 1 from user_roles r join role_permissions p on p.role=r.role where r.user_id=actor and p.permission=admin_check.permission) then raise exception 'forbidden';end if;
 if not coalesce(mfa,false) then raise exception 'mfa_required';end if;
end$$;
create function admin_log(actor uuid,action text,entity text,target text,before_data jsonb,after_data jsonb,request_id uuid) returns void language sql security definer set search_path=public,pg_temp as $$
 insert into admin_audit(actor_id,action,entity,target,before_data,after_data,request_id) values(actor,action,entity,target,
 case when jsonb_typeof(before_data)='object' then before_data-ARRAY['email','access_hash','receipt_url','token_hash','unsubscribe_hash','internal_notes'] else jsonb_build_object('value',before_data) end,
 case when jsonb_typeof(after_data)='object' then after_data-ARRAY['email','access_hash','receipt_url','token_hash','unsubscribe_hash','internal_notes'] else jsonb_build_object('value',after_data) end,request_id);
$$;
create function admin_entity(entity text) returns jsonb language sql immutable set search_path=public,pg_temp as $$
 select case entity
 when 'products' then '{"permission":"products","key":"id","fields":["title","description","category_id","price_minor","product_type","image_url","status","featured"]}'::jsonb
 when 'categories' then '{"permission":"products","key":"id","fields":["name"]}'::jsonb
 when 'promotions' then '{"permission":"products","key":"code","fields":["code","percent","expires_at","max_uses","active","minimum_minor"]}'::jsonb
 when 'product_assets' then '{"permission":"products","key":"id","fields":["product_id","storage_path","download_limit"]}'::jsonb
 when 'summits' then '{"permission":"events","key":"id","fields":["title","description","starts_on","ends_on","timezone","published"]}'::jsonb
 when 'sessions' then '{"permission":"events","key":"id","fields":["summit_id","title","description","starts_at","ends_at","category","location","meeting_url","capacity","waitlist_enabled","registration_closes_at","registration_open","published","price_minor","cancellation_allowed"]}'::jsonb
 when 'speakers' then '{"permission":"events","key":"id","fields":["name","bio","image_url"]}'::jsonb
 when 'communities' then '{"permission":"community","key":"id","fields":["name","description","visibility","join_open","published"]}'::jsonb
 when 'community_categories' then '{"permission":"community","key":"id","fields":["community_id","name"]}'::jsonb
 when 'articles' then '{"permission":"content","key":"id","fields":["slug","title","category","excerpt","body","cover_image","author","published_at","reading_minutes","status"]}'::jsonb
 when 'legal_policies' then '{"permission":"settings","key":"slug","fields":["slug","title","body","approved"]}'::jsonb
 when 'inquiries' then '{"permission":"inquiries","key":"id","fields":["status","internal_notes","assigned_to","follow_up_at"]}'::jsonb
 else null end;
$$;

create function platform_admin(action text,p jsonb,actor uuid,mfa boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare entity text:=p->>'entity'; spec jsonb; permission text; pk text; allowed text[]; col text; cols text; vals text;
 before_row jsonb; after_row jsonb; data jsonb:=coalesce(p->'data','{}'); result jsonb; total bigint; target text:=p->>'id';
 req uuid:=coalesce((p->>'request_id')::uuid,gen_random_uuid()); rid uuid; ord orders; reg registrations; sess sessions; existing uuid;
 lim integer:=least(100,greatest(1,coalesce((p->>'limit')::int,25))); offs integer:=greatest(0,coalesce((p->>'offset')::int,0));
 start_at timestamptz:=coalesce((p->>'from')::date,current_date-30)::timestamp at time zone 'Africa/Lagos';
 end_at timestamptz:=(coalesce((p->>'to')::date,current_date)+1)::timestamp at time zone 'Africa/Lagos';
 query text:=left(coalesce(p->>'q',''),100); staff boolean; changed boolean;
begin
 if end_at<=start_at or end_at-start_at>interval '367 days' then raise exception 'invalid_date_range';end if;
 if action='context' then
  if actor is null then raise exception 'unauthorized';end if;
  result:=admin_permissions(actor);
  if jsonb_array_length(result)=0 then raise exception 'forbidden';end if;
  if exists(select 1 from user_controls where user_id=actor and suspended) then raise exception 'account_suspended';end if;
  return jsonb_build_object('permissions',result,'roles',coalesce((select jsonb_agg(role) from user_roles where user_id=actor),'[]'),'mfa_required',not mfa);
 end if;
 spec:=admin_entity(entity);
 permission:=case when action in ('overview','analytics','access_log') then case when action='analytics' then 'analytics' else 'overview' end
 when action in ('settings','setting_save','settings_batch','policies') then 'settings'
 when action in ('users','user_detail','user_control','deletions','deletion_review') then 'users'
 when action='roles' then 'roles'
 when action in ('delete_prepare','delete_complete') then 'roles'
 when action in ('orders','order_detail','order_reconcile','order_resolve') then 'orders'
 when action in ('refund_prepare','refund_result') then 'refunds'
 when action in ('registrations','registration_action','session_speakers','session_cancel') then 'events'
 when action in ('reports','moderate','restriction','posts','post_moderate','memberships') then 'community'
 when action in ('subscribers','unsubscribe') then 'newsletter'
 when action in ('health','audit','incidents','incident_resolve','outbox_retry') then 'security'
 when action in ('media','media_record','media_detail','media_scan') then p->>'permission'
 else spec->>'permission' end;
 if permission is null then raise exception 'unknown_action';end if;
 perform admin_check(actor,permission,mfa);
 if action='access_log' then perform admin_log(actor,'admin_session_verified','sessions',null,null,'{}',req);return '{}';
 elsif action='overview' then
  -- Restrict even summary PII/finance to the role's own operational area.
  result:=jsonb_build_object('period',jsonb_build_object('from',start_at,'to_exclusive',end_at,'timezone','Africa/Lagos'));
  if admin_permissions(actor) ? 'users' then result:=result||jsonb_build_object('total_users',(select count(*) from auth.users),'new_users',(select count(*) from auth.users where created_at>=start_at and created_at<end_at));end if;
  if admin_permissions(actor) ? 'orders' then result:=result||jsonb_build_object('orders',(select count(*) from orders where created_at>=start_at and created_at<end_at),'pending_orders',(select count(*) from orders where status='pending'),'confirmed_payments_minor',coalesce((select sum(amount_minor) from payments where paid_at>=start_at and paid_at<end_at),0),'refunds_minor',coalesce((select sum(amount_minor) from refund_records where processed_at>=start_at and processed_at<end_at),0));end if;
  if admin_permissions(actor) ? 'products' then result:=result||jsonb_build_object('available_products',(select count(*) from products where status='published' and not archived));end if;
  if admin_permissions(actor) ? 'events' then result:=result||jsonb_build_object('registrations',(select count(*) from registrations where created_at>=start_at and created_at<end_at),'upcoming_sessions',(select count(*) from sessions where published and not cancelled and starts_at>now()));end if;
  if admin_permissions(actor) ? 'community' then result:=result||jsonb_build_object('memberships',(select count(*) from memberships),'open_reports',(select count(*) from content_reports where status='open'));end if;
  if admin_permissions(actor) ? 'content' then result:=result||jsonb_build_object('published_stories',(select count(*) from articles where status='published' and published_at<=now() and not archived));end if;
  if admin_permissions(actor) ? 'inquiries' then result:=result||jsonb_build_object('new_inquiries',(select count(*) from inquiries where status='new'));end if;
  if admin_permissions(actor) ? 'newsletter' then result:=result||jsonb_build_object('subscribers',(select count(*) from newsletter_subscriptions where status='subscribed'));end if;
  return result;
 elsif action='analytics' then
  return jsonb_build_object('summary',platform_admin('overview',p,actor,mfa),
  'sales_daily',coalesce((select jsonb_agg(to_jsonb(x)) from (select (paid_at at time zone 'Africa/Lagos')::date as "day",count(*) orders,sum(amount_minor) gross_minor from payments where paid_at>=start_at and paid_at<end_at group by 1 order by 1)x),'[]'),
  'best_sellers',coalesce((select jsonb_agg(to_jsonb(x)) from (select i.product_id,i.title,sum(i.quantity) units from order_items i join orders o on o.id=i.order_id where o.status='paid' and o.created_at>=start_at and o.created_at<end_at and i.product_id is not null group by i.product_id,i.title order by units desc limit 10)x),'[]'),
  'orders_by_status',coalesce((select jsonb_agg(to_jsonb(x)) from (select status,count(*) orders,sum(total_minor) amount_minor from orders where created_at>=start_at and created_at<end_at group by status)x),'[]'),
  'registrations_daily',coalesce((select jsonb_agg(to_jsonb(x)) from (select (created_at at time zone 'Africa/Lagos')::date as "day",count(*) registrations from registrations where created_at>=start_at and created_at<end_at group by 1 order by 1)x),'[]'),
  'capacity',coalesce((select jsonb_agg(to_jsonb(x)) from (select s.id,s.title,s.capacity,count(r.id) filter(where r.status in ('confirmed','pending')) reserved,count(r.id)filter(where r.checked_in_at is not null) attended from sessions s left join registrations r on r.session_id=s.id where s.starts_at>=start_at and s.starts_at<end_at group by s.id order by s.starts_at limit 100)x),'[]'),
  'community_activity',coalesce((select jsonb_agg(to_jsonb(x)) from (select c.name,count(po.id) posts from communities c left join posts po on po.community_id=c.id and po.created_at>=start_at and po.created_at<end_at group by c.id)x),'[]'),
  'conversion_rate',null,'article_engagement',null,'measurement_note','Conversion and article engagement are not collected. Gross uses verified payments by paid_at; refunds use processed_at; net is gross minus refunds. Order statuses are grouped by order creation date.');
 elsif action in ('list','detail','save','archive','revisions') then
  if spec is null then raise exception 'invalid_entity';end if;
  pk:=spec->>'key';select array_agg(v) into allowed from jsonb_array_elements_text(spec->'fields')v;
  if action in ('list','detail') then
   execute format('select count(*) from %I t where ($1='''' or to_jsonb(t)::text ilike ''%%''||$1||''%%'') and ($2 is null or to_jsonb(t)->>''status''=$2) and ($3 is null or to_jsonb(t)->>%L=$3)',entity,pk) into total using query,nullif(p->>'status',''),case when action='detail' then target end;
   execute format('select coalesce(jsonb_agg(j),''[]'') from (select to_jsonb(t) j from %I t where ($1='''' or to_jsonb(t)::text ilike ''%%''||$1||''%%'') and ($2 is null or to_jsonb(t)->>''status''=$2) and ($3 is null or to_jsonb(t)->>%L=$3) order by %I limit $4 offset $5)x',entity,pk,pk) into result using query,nullif(p->>'status',''),case when action='detail' then target end,lim,offs;
   if entity='sessions' then select coalesce(jsonb_agg(j||jsonb_build_object('speaker_ids',coalesce((select jsonb_agg(speaker_id) from session_speakers where session_id=(j->>'id')::uuid),'[]'))),'[]') into result from jsonb_array_elements(result) j;end if;
   return jsonb_build_object('rows',result,'total',total);
  end if;
  if action='revisions' then return coalesce((select jsonb_agg(to_jsonb(x)) from (select cr.id,cr.data,cr.created_at from content_revisions cr where cr.entity=(p->>'entity') and cr.record_id=target order by cr.created_at desc limit lim)x),'[]');end if;
  if target is not null then
   execute format('select to_jsonb(t) from %I t where to_jsonb(t)->>%L=$1 for update',entity,pk) into before_row using target;
   if before_row is null then raise exception 'not_found';end if;
   if p->>'expected_updated_at' is not null and before_row->>'updated_at'<>p->>'expected_updated_at' then raise exception 'edit_conflict';end if;
  end if;
  if action='archive' then
   if entity not in ('products','articles','summits','communities') then raise exception 'archive_not_supported';end if;
   execute format('update %I set archived=true,%s where %I::text=$1 returning to_jsonb(%I)',entity,case when entity='products' then 'status=''unavailable''' when entity='articles' then 'status=''draft''' else 'published=false' end,pk,entity) into after_row using target;
  else
   if jsonb_typeof(data)<>'object' then raise exception 'invalid_input';end if;
   for col in select jsonb_object_keys(data) loop if not col=any(allowed) then raise exception 'invalid_field';end if;end loop;
   if entity='inquiries' and target is null then raise exception 'creation_not_supported';end if;
   if entity='legal_policies' and coalesce((data->>'approved')::boolean,false) and not admin_permissions(actor) ? 'roles' then raise exception 'forbidden';end if;
   result:=coalesce(before_row,'{}')||data;
   if coalesce((before_row->>'archived')::boolean,false) and (data->>'status'='published' or coalesce((data->>'published')::boolean,false)) then raise exception 'archived_readonly';end if;
   if entity='products' and result->>'status'='published' and coalesce(result->>'product_type','digital')<>'physical' and not exists(select 1 from product_assets where product_id=target::uuid) then raise exception 'product_file_required';end if;
   if entity='sessions' then
    result:=coalesce(before_row,'{}')||data;
    if (result->>'capacity')::int is not null and (result->>'capacity')::int<(select count(*) from registrations where session_id=target::uuid and status in ('confirmed','pending')) then raise exception 'capacity_below_reserved';end if;
    if not exists(select 1 from summits s where s.id=(result->>'summit_id')::uuid and ((result->>'starts_at')::timestamptz at time zone s.timezone)::date between s.starts_on and s.ends_on) then raise exception 'schedule_outside_summit';end if;
    if (result->>'starts_at')::timestamptz>=(result->>'ends_at')::timestamptz then raise exception 'invalid_schedule';end if;
    if (result->>'registration_closes_at')::timestamptz>(result->>'starts_at')::timestamptz then raise exception 'invalid_schedule';end if;
   end if;
   if entity='summits' and data ? 'timezone' and not exists(select 1 from pg_timezone_names where name=data->>'timezone') then raise exception 'invalid_timezone';end if;
   if entity='summits' and target is not null and exists(select 1 from sessions where summit_id=target::uuid and ((starts_at at time zone (result->>'timezone'))::date not between (result->>'starts_on')::date and (result->>'ends_on')::date)) then raise exception 'existing_sessions_outside_summit';end if;
   if entity='product_assets' and (before_row is null or (data ? 'storage_path' and data->>'storage_path' is distinct from before_row->>'storage_path')) and not exists(select 1 from media_assets where storage_path=data->>'storage_path' and bucket='digital-products' and scan_status='clean') then raise exception 'scan_required';end if;
   if target is null then
    target:=case when pk='id' then gen_random_uuid()::text else data->>pk end;data:=data||jsonb_build_object(pk,target);
    select string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') into cols,vals from jsonb_object_keys(data)k;
    execute format('insert into %I(%s) select %s from jsonb_populate_record(null::%I,$1) r returning to_jsonb(%I)',entity,cols,vals,entity,entity) into after_row using data;
   else
    data:=data-pk;result:=before_row||data;
    select string_agg(format('%I=r.%I',k,k),',') into cols from jsonb_object_keys(data)k;
    if cols is null then raise exception 'invalid_input';end if;
    execute format('update %I t set %s from jsonb_populate_record(null::%I,$1) r where t.%I::text=$2 returning to_jsonb(t)',entity,cols,entity,pk) into after_row using result,target;
   end if;
   if entity='legal_policies' then update legal_policies set approved_by=case when approved then actor end,approved_at=case when approved then now() end,updated_at=now() where slug=target returning to_jsonb(legal_policies) into after_row;end if;
  end if;
  if entity in ('articles','legal_policies','summits','sessions') then insert into content_revisions(entity,record_id,data,editor_id) values(entity,target,after_row,actor);end if;
  if entity='sessions' and before_row is not null and before_row-ARRAY['updated_at']=after_row-ARRAY['updated_at'] then changed:=false;else changed:=true;end if;
  if entity='sessions' and changed then
   for reg in select * from registrations where session_id=target::uuid and status in ('confirmed','pending','waitlisted') loop
    perform queue_email('schedule:'||target||':'||(after_row->>'updated_at')||':'||reg.id,reg.email,'schedule_update',jsonb_build_object('reference',reg.reference,'title',after_row->>'title','starts_at',after_row->>'starts_at','ends_at',after_row->>'ends_at','timezone',(select timezone from summits where id=(after_row->>'summit_id')::uuid)));
   end loop;
  end if;
  if entity='summits' and before_row is not null and before_row is distinct from after_row then
   for reg in select r.* from registrations r join sessions s on s.id=r.session_id where s.summit_id=target::uuid and r.status<>'cancelled' loop
    perform queue_email('summit-update:'||req||':'||reg.id,reg.email,'schedule_update',jsonb_build_object('reference',reg.reference,'title',(select title from sessions where id=reg.session_id),'starts_at',(select starts_at from sessions where id=reg.session_id),'ends_at',(select ends_at from sessions where id=reg.session_id),'timezone',after_row->>'timezone'));
   end loop;
  end if;
  perform admin_log(actor,action,entity,target,before_row,after_row,req);return after_row;
 elsif action='orders' then
  return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select o.id,o.reference,o.email,o.customer_name,o.total_minor,o.currency,o.status,o.fulfillment_hold,o.created_at,pa.provider_id from orders o left join payments pa on pa.order_id=o.id where o.created_at>=start_at and o.created_at<end_at and (query='' or o.reference ilike '%'||query||'%' or o.email ilike '%'||query||'%') and (nullif(p->>'status','') is null or o.status=p->>'status') order by o.created_at desc limit lim offset offs)x),'[]'));
 elsif action in ('order_detail','order_reconcile','order_resolve','refund_prepare') then
  select * into ord from orders where reference=p->>'reference' for update;if not found then raise exception 'not_found';end if;
  if action='order_detail' then return (to_jsonb(ord)-ARRAY['access_hash','receipt_url','client_key','request_fingerprint'])||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)) from order_items i where order_id=ord.id),'[]'),'payments',coalesce((select jsonb_agg(to_jsonb(pa)) from payments pa where order_id=ord.id),'[]'),'events',coalesce((select jsonb_agg(to_jsonb(e)) from payment_events e where order_id=ord.id),'[]'),'refunds',coalesce((select jsonb_agg(to_jsonb(r)) from refund_requests r where order_id=ord.id),'[]'));end if;
  if action='order_resolve' then
   select * into reg from registrations where order_id=ord.id;
   if not found or ord.status<>'paid' or not ord.fulfillment_hold then raise exception 'invalid_fulfillment';end if;
   select * into sess from sessions where id=reg.session_id for update;
   if sess.cancelled or (sess.capacity is not null and sess.capacity<=(select count(*) from registrations where session_id=sess.id and id<>reg.id and status in ('confirmed','pending'))) then raise exception 'capacity_full';end if;
   update registrations set status='confirmed' where id=reg.id;update orders set fulfillment_hold=false where id=ord.id;
   perform queue_email('fulfillment:'||ord.id,reg.email,'registration',jsonb_build_object('reference',reg.reference,'title',sess.title,'status','confirmed'));
  elsif action='refund_prepare' then
   if p->>'confirmation' is distinct from ord.reference or ord.status<>'paid' then raise exception 'confirmation_required';end if;
   if exists(select 1 from refund_requests where order_id=ord.id and status in ('requested','submitted','uncertain','processed') and client_key<>(p->>'key')::uuid) then raise exception 'refund_exists';end if;
   insert into refund_requests(order_id,client_key,actor_id,reason) values(ord.id,(p->>'key')::uuid,actor,p->>'reason') on conflict(client_key) do nothing returning id into rid;
   if rid is null then select id into rid from refund_requests where client_key=(p->>'key')::uuid and order_id=ord.id;end if;
   if rid is null then raise exception 'refund_exists';end if;
   result:=(select to_jsonb(r) from refund_requests r where id=rid);
  end if;
  perform admin_log(actor,action,'orders',ord.reference,null,jsonb_build_object('reason',p->>'reason'),req);
  return coalesce(result,jsonb_build_object('reference',ord.reference,'total_minor',ord.total_minor,'status',ord.status));
 elsif action='refund_result' then
  update refund_requests set provider_id=p->>'provider_id',status=p->>'status',updated_at=now() where id=(p->>'id')::uuid returning to_jsonb(refund_requests) into result;
  perform admin_log(actor,action,'refunds',p->>'id',null,result,req);return result;
 elsif action='registrations' then
  return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select r.*,s.title session_title,s.capacity,s.cancelled session_cancelled from registrations r join sessions s on s.id=r.session_id where r.created_at>=start_at and r.created_at<end_at and (p->>'session_id' is null or r.session_id=(p->>'session_id')::uuid) and (nullif(p->>'status','') is null or r.status=p->>'status') and (query='' or r.reference ilike '%'||query||'%' or r.name ilike '%'||query||'%') order by r.created_at desc limit lim offset offs)x),'[]'));
 elsif action='registration_action' then
  select session_id into rid from registrations where id=(p->>'id')::uuid or reference=p->>'reference';perform 1 from sessions where id=rid for update;
  select * into reg from registrations where id=(p->>'id')::uuid or reference=p->>'reference' for update;if not found then raise exception 'not_found';end if;
  select * into sess from sessions where id=reg.session_id;
  if p->>'operation'='check_in' and reg.status='confirmed' and not sess.cancelled then update registrations set checked_in_at=now() where id=reg.id;
  elsif p->>'operation'='promote' and reg.status='waitlisted' and sess.price_minor=0 and not sess.cancelled then
   if sess.capacity is not null and sess.capacity<=(select count(*) from registrations where session_id=sess.id and status in ('confirmed','pending')) then raise exception 'capacity_full';end if;
   update registrations set status='confirmed' where id=reg.id;perform queue_email('admin-promote:'||reg.id,reg.email,'registration',jsonb_build_object('reference',reg.reference,'title',sess.title,'status','confirmed'));
  elsif p->>'operation'='cancel' then
   if reg.order_id is not null and exists(select 1 from orders where id=reg.order_id and status in ('pending','paid')) then raise exception 'paid_cancellation_requires_review';end if;
   update registrations set status='cancelled' where id=reg.id;
   perform queue_email('admin-cancel:'||reg.id,reg.email,'registration',jsonb_build_object('reference',reg.reference,'title',sess.title,'status','cancelled'));
  else raise exception 'invalid_registration_action';end if;
  perform admin_log(actor,action,'registrations',reg.id::text,to_jsonb(reg),jsonb_build_object('operation',p->>'operation'),req);return jsonb_build_object('saved',true);
 elsif action='session_cancel' then
  if p->>'confirmation' is distinct from 'CANCEL SESSION' then raise exception 'confirmation_required';end if;
  select to_jsonb(s) into before_row from sessions s where id=(p->>'id')::uuid for update;
  if before_row is null then raise exception 'not_found';end if;
  update sessions set cancelled=true,published=false,registration_open=false,cancellation_reason=p->>'reason' where id=(p->>'id')::uuid;
  for reg in select * from registrations where session_id=(p->>'id')::uuid and status<>'cancelled' loop
   perform queue_email('session-cancel:'||reg.id,reg.email,'session_cancelled',jsonb_build_object('reference',reg.reference,'title',before_row->>'title','reason',p->>'reason','paid_review',reg.order_id is not null));
  end loop;
  perform admin_log(actor,action,'sessions',p->>'id',before_row,jsonb_build_object('cancelled',true,'reason',p->>'reason'),req);return jsonb_build_object('cancelled',true,'registrations_retained',true);
 elsif action='session_speakers' then
  perform 1 from sessions where id=(p->>'session_id')::uuid for update;if not found then raise exception 'not_found';end if;
  delete from session_speakers where session_id=(p->>'session_id')::uuid;
  insert into session_speakers select (p->>'session_id')::uuid,value::uuid from jsonb_array_elements_text(p->'speaker_ids');
  perform admin_log(actor,action,'sessions',p->>'session_id',null,p-'request_id',req);return jsonb_build_object('saved',true);
 elsif action in ('reports','posts','memberships') then
  if action='reports' then result:=coalesce((select jsonb_agg(to_jsonb(x)) from (select r.id,r.post_id,r.comment_id,r.reason,r.status,r.moderation_note,r.created_at,po.title,po.body post_body,co.body comment_body from content_reports r left join posts po on po.id=r.post_id left join comments co on co.id=r.comment_id where (nullif(p->>'status','') is null or r.status=p->>'status') order by r.created_at desc limit lim offset offs)x),'[]');
  elsif action='posts' then result:=coalesce((select jsonb_agg(to_jsonb(x)) from (select id,title,body,community_id,author_id,hidden,featured,announcement,created_at from posts where (p->>'community_id' is null or community_id=(p->>'community_id')::uuid) and (query='' or title ilike '%'||query||'%') order by created_at desc limit lim offset offs)x),'[]');
  else result:=coalesce((select jsonb_agg(to_jsonb(x)) from (select m.community_id,m.user_id,pr.display_name,m.created_at from memberships m left join profiles pr on pr.id=m.user_id where (p->>'community_id' is null or community_id=(p->>'community_id')::uuid) limit lim offset offs)x),'[]');end if;
  return jsonb_build_object('rows',result);
 elsif action='moderate' then
  if p->>'decision'='hide' then update posts set hidden=true where id=(select post_id from content_reports where id=(p->>'id')::uuid);update comments set hidden=true where id=(select comment_id from content_reports where id=(p->>'id')::uuid);end if;
  update content_reports set status=case when p->>'decision'='hide' then 'actioned' else 'dismissed' end,moderation_note=p->>'note',reviewer_id=actor where id=(p->>'id')::uuid;
  perform admin_log(actor,action,'reports',p->>'id',null,jsonb_build_object('decision',p->>'decision','note',p->>'note'),req);return jsonb_build_object('reviewed',true);
 elsif action='post_moderate' then
  update posts set hidden=coalesce((p->>'hidden')::boolean,hidden),featured=coalesce((p->>'featured')::boolean,featured),announcement=coalesce((p->>'announcement')::boolean,announcement) where id=(p->>'id')::uuid;
  perform admin_log(actor,action,'posts',p->>'id',null,p-'request_id',req);return jsonb_build_object('saved',true);
 elsif action='restriction' then
  insert into community_restrictions(community_id,user_id,reason,restricted_until) values((p->>'community_id')::uuid,(p->>'user_id')::uuid,p->>'reason',(p->>'until')::timestamptz)
  on conflict(community_id,user_id) do update set reason=excluded.reason,restricted_until=excluded.restricted_until;
  perform admin_log(actor,action,'memberships',p->>'user_id',null,p-'request_id',req);return jsonb_build_object('saved',true);
 elsif action='users' then
  return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select u.id,u.email,u.created_at,pr.display_name,coalesce(c.suspended,false) suspended,coalesce((select jsonb_agg(role) from user_roles where user_id=u.id),'[]') roles from auth.users u left join profiles pr on pr.id=u.id left join user_controls c on c.user_id=u.id where query='' or u.email ilike '%'||query||'%' or pr.display_name ilike '%'||query||'%' order by u.created_at desc limit lim offset offs)x),'[]'));
 elsif action='user_detail' then
  return jsonb_build_object('dashboard',platform_stage2('dashboard','{}',(p->>'id')::uuid),'deletion',(select to_jsonb(d) from deletion_requests d where user_id=(p->>'id')::uuid));
 elsif action='roles' then
  perform pg_advisory_xact_lock(1751,3);
  if p->>'confirmation' is distinct from 'CHANGE ROLES' then raise exception 'confirmation_required';end if;
  if exists(select 1 from user_roles where user_id=(p->>'user_id')::uuid and role='super_admin') and not p->'roles' ? 'super_admin' and (select count(*) from user_roles r left join user_controls c on c.user_id=r.user_id where role='super_admin' and not coalesce(c.suspended,false))<=1 then raise exception 'last_super_admin';end if;
  select jsonb_agg(role) into before_row from user_roles where user_id=(p->>'user_id')::uuid;
  delete from user_roles where user_id=(p->>'user_id')::uuid;
  insert into user_roles(user_id,role) select (p->>'user_id')::uuid,value from jsonb_array_elements_text(p->'roles');
  insert into user_revocations(user_id,revoked_before) values((p->>'user_id')::uuid,clock_timestamp()) on conflict(user_id) do update set revoked_before=excluded.revoked_before;
  perform admin_log(actor,action,'users',p->>'user_id',jsonb_build_object('roles',before_row),jsonb_build_object('roles',p->'roles'),req);return jsonb_build_object('saved',true);
 elsif action='user_control' then
  perform pg_advisory_xact_lock(1751,3);
  staff:=exists(select 1 from user_roles where user_id=(p->>'user_id')::uuid);
  if staff and not admin_permissions(actor) ? 'roles' then raise exception 'forbidden';end if;
  if (p->>'suspended')::boolean and exists(select 1 from user_roles where user_id=(p->>'user_id')::uuid and role='super_admin') and (select count(*) from user_roles r left join user_controls c on c.user_id=r.user_id where role='super_admin' and not coalesce(c.suspended,false))<=1 then raise exception 'last_super_admin';end if;
  if p ? 'suspended' then insert into user_controls(user_id,suspended,reason) values((p->>'user_id')::uuid,(p->>'suspended')::boolean,p->>'reason') on conflict(user_id) do update set suspended=excluded.suspended,reason=excluded.reason,updated_at=now();end if;
  insert into user_revocations(user_id,revoked_before) values((p->>'user_id')::uuid,clock_timestamp()) on conflict(user_id) do update set revoked_before=excluded.revoked_before;
  perform admin_log(actor,action,'users',p->>'user_id',null,jsonb_build_object('suspended',p->'suspended','reason',p->>'reason'),req);return jsonb_build_object('saved',true);
 elsif action in ('deletions','deletion_review') then
  if action='deletions' then return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(d)) from deletion_requests d where status='requested'),'[]'));end if;
  -- Completion is gated by approved retention rules and an operator-confirmed external Auth deletion.
  if not exists(select 1 from website_settings where key='retention_approved' and value='true') or p->>'confirmation' is distinct from 'RETENTION REVIEWED' then raise exception 'retention_approval_required';end if;
  perform admin_log(actor,action,'users',p->>'user_id',null,jsonb_build_object('review_note',p->>'note'),req);return jsonb_build_object('reviewed',true,'auth_deletion_required',true);
 elsif action='delete_prepare' then
  select to_jsonb(d) into result from deletion_operations d where client_key=(p->>'key')::uuid and target_user=(p->>'user_id')::uuid;if result is not null then return result;end if;
  if not exists(select 1 from website_settings where key='retention_approved' and value='true') or not exists(select 1 from website_settings where key='retention_rules' and value ? 'financial_days') or not exists(select 1 from legal_policies where slug='privacy' and approved) then raise exception 'retention_approval_required';end if;
  if p->>'confirmation' is distinct from 'DELETE ACCOUNT' then raise exception 'confirmation_required';end if;
  if exists(select 1 from user_roles where user_id=(p->>'user_id')::uuid) then raise exception 'staff_deletion_requires_role_review';end if;
  if not exists(select 1 from deletion_requests where user_id=(p->>'user_id')::uuid and status='requested') then raise exception 'deletion_request_required';end if;
  insert into deletion_operations(target_user,client_key,actor_id,registration_ids,order_ids) values((p->>'user_id')::uuid,(p->>'key')::uuid,actor,array(select id from registrations where user_id=(p->>'user_id')::uuid),array(select id from orders where user_id=(p->>'user_id')::uuid)) on conflict(client_key) do nothing returning id into rid;
  if rid is null then select id into rid from deletion_operations where client_key=(p->>'key')::uuid and target_user=(p->>'user_id')::uuid;end if;
  if rid is null then raise exception 'conflict';end if;
  perform admin_log(actor,action,'users',p->>'user_id',null,jsonb_build_object('note',p->>'note'),req);return (select to_jsonb(d) from deletion_operations d where id=rid);
 elsif action='delete_complete' then
  select target_user into existing from deletion_operations where id=(p->>'id')::uuid;
  if exists(select 1 from auth.users where id=existing) then raise exception 'identity_deletion_unverified';end if;
  update registrations set name='Deleted member',email='deleted@invalid.example' where id in(select unnest(registration_ids) from deletion_operations where id=(p->>'id')::uuid);
  if exists(select 1 from website_settings where key='retention_rules' and value->>'retain_purchase_access'='false') then update entitlements set revoked_at=now() where order_id in(select unnest(order_ids) from deletion_operations where id=(p->>'id')::uuid);end if;
  update deletion_operations set status='completed' where id=(p->>'id')::uuid;
  perform admin_log(actor,action,'users',existing::text,null,jsonb_build_object('identity_deleted',true),req);return '{"completed":true}';
 elsif action='subscribers' then
  return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,email,status,consent_at,confirmed_at,updated_at from newsletter_subscriptions where (query='' or email ilike '%'||query||'%') and (nullif(p->>'status','') is null or status=p->>'status') order by updated_at desc limit lim offset offs)x),'[]'));
 elsif action='unsubscribe' then
  update newsletter_subscriptions set status='unsubscribed' where id=(p->>'id')::uuid;
  perform admin_log(actor,action,'newsletter',p->>'id',null,jsonb_build_object('status','unsubscribed'),req);return jsonb_build_object('saved',true);
 elsif action='settings' then
  return coalesce((select jsonb_object_agg(key,value) from website_settings),'{}');
 elsif action='settings_batch' then
  for data in select value from jsonb_array_elements(p->'updates') loop perform platform_admin('setting_save',data||jsonb_build_object('confirmation',p->>'confirmation','request_id',req),actor,mfa);end loop;return '{"saved":true}';
 elsif action='setting_save' then
  if p->>'key' in ('maintenance','retention_approved','retention_rules','site_origin') and not admin_permissions(actor) ? 'roles' then raise exception 'forbidden';end if;
  if p->>'key' in ('maintenance','retention_approved') and p->>'confirmation' is distinct from 'CHANGE SETTING' then raise exception 'confirmation_required';end if;
  select value into before_row from website_settings where key=p->>'key';
  if p->'value'='null' then delete from website_settings where key=p->>'key';else insert into website_settings(key,value,updated_by) values(p->>'key',p->'value',actor) on conflict(key) do update set value=excluded.value,updated_by=actor,updated_at=now();end if;
  perform admin_log(actor,action,'settings',p->>'key',before_row,p->'value',req);return jsonb_build_object('saved',true);
 elsif action='policies' then return coalesce((select jsonb_agg(to_jsonb(l)) from legal_policies l),'[]');
 elsif action in ('media','media_record','media_detail','media_scan') then
  if permission not in ('products','content','events','settings') then raise exception 'forbidden';end if;
  if action='media' then return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from media_assets order by created_at desc limit lim offset offs)x),'[]'));end if;
  if action='media_detail' then return (select to_jsonb(m) from media_assets m where id=(p->>'id')::uuid);end if;
  if action='media_scan' then update media_assets set scan_status=p->>'scan_status',bucket=p->>'bucket' where id=(p->>'id')::uuid;perform admin_log(actor,action,'media',p->>'id',null,p-'request_id',req);return '{"saved":true}';end if;
  insert into media_assets(id,bucket,storage_path,kind,content_type,size_bytes,sha256,scan_status,uploaded_by) values((p->>'id')::uuid,p->>'bucket',p->>'path',p->>'kind',p->>'content_type',(p->>'size')::integer,p->>'sha256',p->>'scan_status',actor);
  perform admin_log(actor,'upload','media',p->>'id',null,p-ARRAY['request_id','actor'],req);return jsonb_build_object('saved',true);
 elsif action='health' then
  return jsonb_build_object('outbox',coalesce((select jsonb_agg(to_jsonb(x)) from (select status,count(*) count,min(created_at) oldest from email_outbox group by status)x),'[]'),
  'runs',coalesce((select jsonb_agg(to_jsonb(x)) from (select distinct on(kind) kind,status,details,created_at from operations_runs order by kind,created_at desc)x),'[]'),
  'open_incidents',(select count(*) from system_incidents where not resolved),'pending_orders',(select count(*) from orders where status='pending' and created_at<now()-interval '1 hour'));
 elsif action='audit' then return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from admin_audit order by created_at desc limit lim offset offs)x),'[]'));
 elsif action='incidents' then return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from system_incidents order by created_at desc limit lim offset offs)x),'[]'));
 elsif action='incident_resolve' then update system_incidents set resolved=true where id=(p->>'id')::uuid;perform admin_log(actor,action,'incidents',p->>'id',null,'{}',req);return '{"saved":true}';
 elsif action='outbox_retry' then
  update email_outbox set status='pending',available_at=now(),attempts=0 where id=(p->>'id')::uuid and status='failed';perform admin_log(actor,action,'outbox',p->>'id',null,'{}',req);return '{"saved":true}';
 end if;
 raise exception 'unknown_action';
end$$;

create or replace function can_read_community(cid uuid,actor uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from communities c where c.id=cid and c.published and not exists(select 1 from community_restrictions r where r.community_id=cid and r.user_id=actor and (restricted_until is null or restricted_until>now()))
 and (c.visibility='public' or exists(select 1 from memberships m where m.community_id=cid and m.user_id=actor) or exists(select 1 from user_roles where user_id=actor and role in ('super_admin','admin','moderator'))));
$$;
alter function platform(text,jsonb,uuid) rename to platform_stage2;
create function platform(action text,p jsonb default '{}',actor uuid default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; reg jsonb;begin
 if actor is not null and exists(select 1 from user_controls where user_id=actor and suspended) then raise exception 'account_suspended';end if;
 if action='account_access' then
  if actor is null then raise exception 'unauthorized';end if;
  if exists(select 1 from revoked_sessions where session_id=p->>'session_id' and user_id=actor) or exists(select 1 from user_revocations where user_id=actor and revoked_before>=to_timestamp(coalesce((p->>'issued_at')::bigint,0))) then raise exception 'session_revoked';end if;return '{"allowed":true}';
 elsif action='session_revoke' then insert into revoked_sessions(session_id,user_id) values(p->>'session_id',actor) on conflict do nothing;return '{}';
 elsif action in ('reports','moderate','check_in') then raise exception 'mfa_required';
 elsif action='public_settings' then return coalesce((select jsonb_object_agg(key,value) from website_settings where key=any(array['site_name','contact_email','contact_details','announcement','hero_title','hero_intro','summit_intro','service_intro','logo_url','hero_images','social_links','footer_links','ecosystem_descriptions','featured_products','featured_stories','maintenance'])),'{}');
 elsif action='home_content' then
  result:=jsonb_build_object('products',platform_stage2('products','{"limit":4}',null),'articles',platform_stage2('articles','{"limit":12}',null));
  if exists(select 1 from website_settings where key='featured_products') then
   result:=jsonb_set(result,'{products}',coalesce((select jsonb_agg(to_jsonb(x) order by position) from (select pr.id,pr.title,pr.description,pr.price_minor,pr.currency,pr.product_type,pr.image_url,pr.featured,c.name category,chosen.ordinality position from website_settings st cross join lateral jsonb_array_elements_text(st.value) with ordinality chosen(id,ordinality) join products pr on pr.id=chosen.id::uuid left join categories c on c.id=pr.category_id where st.key='featured_products' and pr.status='published' and not pr.archived)x),'[]'));
  end if;
  if exists(select 1 from website_settings where key='featured_stories') then
   result:=jsonb_set(result,'{articles}',coalesce((select jsonb_agg(to_jsonb(x) order by position) from (select a.id,a.slug,a.title,a.category,a.excerpt,a.cover_image,a.author,a.published_at,a.reading_minutes,chosen.ordinality position from website_settings st cross join lateral jsonb_array_elements_text(st.value) with ordinality chosen(id,ordinality) join articles a on a.id=chosen.id::uuid where st.key='featured_stories' and a.status='published' and a.published_at<=now() and not a.archived)x),'[]'));
  end if;return result;
 elsif action='public_policy' then return coalesce((select to_jsonb(l)-'approved_by' from legal_policies l where slug=p->>'slug' and approved),'null');
 elsif action='operation_report' then insert into operations_runs(kind,status,details) values(p->>'kind',p->>'status',coalesce(p->'details','{}'));return '{}';
 elsif action='incident' then insert into system_incidents(request_id,code,route) values((p->>'request_id')::uuid,p->>'code',p->>'route');return '{}';
 elsif action='security_event' then insert into security_events(request_id,actor_id,code,route) values((p->>'request_id')::uuid,actor,p->>'code',p->>'route');return '{}';
 elsif action='monitor' then
  result:='[]';
  if not exists(select 1 from operations_runs where kind='backup' and status='ok' and details->>'encrypted'='true' and details->>'verified'='true' and created_at>now()-interval '26 hours') then result:=result||'"backup_unverified_or_stale"'::jsonb;end if;
  if not exists(select 1 from operations_runs where kind='restore' and status='ok' and details->>'verified'='true' and created_at>now()-interval '30 days') then result:=result||'"staging_restore_unverified_or_stale"'::jsonb;end if;
  if exists(select 1 from email_outbox where status='failed' or (status in ('sending','pending') and created_at<now()-interval '1 hour')) then result:=result||'"email_delivery_backlog"'::jsonb;end if;
  if exists(select 1 from system_incidents where not resolved and created_at>now()-interval '1 day') then result:=result||'"unresolved_service_incidents"'::jsonb;end if;
  if jsonb_array_length(result)>0 and p->>'ops_inbox' is not null then perform queue_email('ops:'||date_trunc('hour',now())::text,p->>'ops_inbox','operations_alert',jsonb_build_object('issues',result));end if;
  return jsonb_build_object('healthy',jsonb_array_length(result)=0,'issues',result,'alerts_configured',p->>'ops_inbox' is not null);
 end if;
 if action in ('checkout','register','inquiry') and exists(select 1 from website_settings where key='maintenance' and value='true') then raise exception 'maintenance_mode';end if;
 result:=platform_stage2(action,p,actor);
 if action='refund' then insert into refund_records(provider_id,order_id,amount_minor) select p->>'provider_id',id,(p->>'amount')::int from orders where reference=p->>'reference' on conflict do nothing;update refund_requests set status='processed',updated_at=now() where order_id=(select id from orders where reference=p->>'reference');end if;
 if action='dashboard' then
  result:=jsonb_set(result,'{registrations}',coalesce((select jsonb_agg(r||jsonb_build_object('session_cancelled',s.cancelled,'cancellation_reason',s.cancellation_reason)) from jsonb_array_elements(result->'registrations')r join sessions s on s.id=(r->>'session_id')::uuid),'[]'));
 end if;
 return result;
end$$;
revoke all on function platform_stage2(text,jsonb,uuid),platform(text,jsonb,uuid),platform_admin(text,jsonb,uuid,boolean),admin_permissions(uuid),admin_check(uuid,text,boolean),admin_entity(text),admin_log(uuid,text,text,text,jsonb,jsonb,uuid),immutable_admin_log() from public,anon,authenticated;
revoke all on function platform_stage2(text,jsonb,uuid) from service_role;
grant execute on function platform(text,jsonb,uuid),platform_admin(text,jsonb,uuid,boolean) to service_role;
commit;
