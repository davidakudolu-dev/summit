-- DESTRUCTIVE: review and back up business data first. Do not run on a live database by default.
-- Auth users and Storage objects are deliberately retained for reviewed cleanup/restoration.
begin;
drop function if exists public.platform(text,jsonb,uuid);
drop function if exists public.can_read_community(uuid,uuid);
drop function if exists public.queue_email(text,text,text,jsonb);
drop table if exists public.downloads,public.entitlements,public.payment_events,public.payments,
 public.registrations,public.session_speakers,public.speakers,public.sessions,public.summits,
 public.order_items,public.orders,public.promotions,public.cart_items,public.carts,
 public.product_assets,public.products,public.categories,public.content_reports,
 public.comments,public.posts,public.community_categories,public.memberships,public.communities,
 public.articles,public.inquiries,public.newsletter_subscriptions,public.deletion_requests,
 public.user_roles,public.profiles,public.email_outbox,public.rate_limits;
drop function if exists public.touch_updated_at();
commit;
