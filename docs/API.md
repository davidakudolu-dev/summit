# API contract

Routes are below `/api`. GET queries accept `q`, `limit` (1–50) and `offset` where applicable.
Mutations except jobs/webhooks require exact APP_ORIGIN, JSON, and `X-1751-Request: 1`. Auth
uses HttpOnly SameSite cookies; browser JavaScript receives no session tokens. Responses are
JSON/no-store; errors use stable `{ "error": "code" }` values without database details.

| Routes | Access / purpose |
| --- | --- |
| GET health | Presence checks and sandbox mode, not provider readiness |
| POST auth/signup, auth/login, auth/recover, auth/verify | Verified account lifecycle |
| GET auth/session; POST auth/logout, auth/password | Session refresh/logout/password |
| GET products, product, categories | Published catalog; detail uses UUID id |
| GET summits, events, event | Published schedule; meeting URLs excluded |
| GET articles, article | Published articles; detail uses slug |
| GET search | Public products, sessions and articles |
| GET communities, posts, post | Private discussion reads require membership |
| GET dashboard; POST profile, account/delete-request | Own profile/history/settings |
| GET/POST cart | Own account cart, live prices |
| POST checkout | Guest/member; UUID key, name, email, items, optional promotion |
| POST orders, payments/verify, payments/retry | Order ownership or order-scoped access token |
| POST downloads | Paid entitlement and asset ID; 60-second signed URL |
| POST registrations, registrations/cancel | Verified account, atomic capacity/own cancellation |
| POST memberships | Join/leave published communities |
| POST posts/create, posts/update, posts/delete | Member/author checks |
| POST comments/create, comments/update, comments/delete | Member/author checks, optional parent_id |
| POST reports | Private post/comment report |
| GET reports; POST moderation, registrations/check-in | Moderator/admin role |
| POST inquiries | Consent, spam trap, UUID key, private notification |
| POST newsletter/subscribe, newsletter/confirm, newsletter/unsubscribe | Consent and hashed capabilities |
| POST payments/webhook | Raw-body Paystack SHA-512 signature and independent verification |
| POST jobs/email, jobs/reconcile | Separate >=32-character bearer job secret |

Browser prices/totals are ignored. Prices are integer kobo. Checkout/inquiry UUID keys make retries
idempotent; basket changes under the same key conflict. Guest capabilities grant access only to their
order. Keep receipt links private. There is no public content-publishing or role-granting endpoint.

## Stage 3 additions

`GET /api/admin/context` allows verified staff to discover their permissions/MFA requirement;
all business administration requires AAL2. MFA routes are `mfa/enroll`, `mfa/challenge`, and
`mfa/verify`. Browser tokens remain in protected cookies. Administrative routes include overview,
analytics, list/detail/save/archive/revisions, orders/order_detail/order_reconcile/fulfillment,
refund_prepare, registrations/registration_cancel/check_in/session_cancel/session_speakers,
reports/moderate/restriction/posts/post_moderate/memberships, users/user_detail/roles/user_control,
deletions/deletion_review/delete_account, subscribers/unsubscribe, settings/setting_save/
settings_batch/policies, health/audit/incidents/incident_resolve/outbox_retry and export.

All use the permission matrix in ADMIN_MANUAL.md; write routes are POST with the existing CSRF
boundary. Entity writes use the shared field allowlist and optional expected_updated_at conflict
check. High-impact writes require recent TOTP plus their explicit confirmation. No direct financial
Paid edit exists. Export is permission-bound CSV with formula escaping and a 5,000-row ceiling.
Uploads (`admin/upload`, `admin/scan`) are authenticated before bounded base64 decode and use safe
Storage keys. Scanner protocol and quarantine are documented in the environment template/manual.

Public additions: settings and policy endpoints return only approved/allowlisted content. Home
content includes only published selected products/stories. Clean detail routes, approved policy
pages, sitemap and robots are server-rendered by Pages Functions. Private pages remain noindex
and no-store. Staging indexing is off by default.

Protected POST jobs add `/api/jobs/monitor` and `/api/jobs/report`. Report accepts only the
backup/restore/health kinds, ok/failed status and redacted verification/checksum details. It requires
JOB_SECRET, and a caller's verified flag must reflect an actual completed operating procedure.
