# Development and deployment

## Required configuration

All variables are **server-only**. Put real secrets in encrypted Cloudflare settings or the ignored
local `.dev.vars`; do not put them in browser assets, the repository, chat, or a static JSON file.

| Variable | Purpose |
| --- | --- |
| APP_ORIGIN | Exact origin, HTTPS on hosted environments; local default is http://localhost:8788 |
| SUPABASE_URL | Development project HTTPS URL |
| SUPABASE_ANON_KEY | Auth API project key; implementation expects the legacy anon key |
| SUPABASE_SERVICE_ROLE_KEY | Legacy service-role key used only by the server RPC and Storage API |
| PAYSTACK_SECRET_KEY | `sk_test_...` only; live keys are rejected |
| RESEND_API_KEY | Transactional email transport |
| EMAIL_FROM | Verified sender address/domain |
| TEAM_INBOX | Owner-approved inquiry/deletion notification inbox |
| APP_SECRET | Random secret >=32 characters for capability signing and IP pseudonymization |
| JOB_SECRET | Separate random secret >=32 characters for background job authorization |

Generate signing/job secrets with a cryptographic random generator and save them securely; do not
reuse provider keys. Keep APP_SECRET stable: changing it affects existing guest checkout retry
capabilities. Existing order capability hashes remain valid for reads. Proxy-held secret placeholders
are suitable only for supported HTTPS forwarding; APP_SECRET and JOB_SECRET require actual runtime
secret values because they perform local signing/comparison. Never paste secrets into chat.

Network destinations are registry.npmjs.org for installation, the specific `<project>.supabase.co`
project hostname for Auth/database/Storage, api.paystack.co and api.resend.com. The browser redirects
to checkout.paystack.com for hosted test payments. Add exact project/API hostnames to restricted
environment egress settings if provider-backed checks are blocked; preserve other network settings.

## Supabase

1. Use a development project and back up existing data. Apply
   `supabase/migrations/202610130001_platform.sql` once in its SQL editor or migration runner.
   It creates only the platform's business objects; it does not reset public/auth schemas.
2. Apply `supabase/storage.sql`. Upload licensed digital files privately, then add their relative
   paths to `product_assets`. Do not make the bucket public or add client Storage access policies.
3. Enable email/password Auth and **email confirmation**. Configure Site URL and exact redirect
   allowlist to APP_ORIGIN. Use a verified Auth SMTP sender; Supabase default test mail limits
   are inadequate for a public site. Configure a password strength policy, secure email changes
   and rate limits. Disable unused providers.
4. Use link templates that send token hashes to this application rather than exposing access/
   refresh tokens in URL fragments. For confirmation:

   ```html
   <a href="{{ .SiteURL }}/#verify/signup/{{ .TokenHash }}">Verify your email</a>
   ```

   For recovery use `#verify/recovery/{{ .TokenHash }}`. For email change, if enabled by a future
   account email-edit interface, use `#verify/email_change/{{ .TokenHash }}`. Verify real delivered
   links before acceptance. Browser-supplied identities are never used as authorization.
5. Add approved categories, catalog, licensed assets, summit dates/timezones, sessions, speakers,
   communities and articles through trusted administration. Content must be explicitly published.
   Prices use integer kobo: NGN 2,000 is `200000`. Digital/course records need a private asset
   before checkout; physical fulfillment is disabled. Summit dates must match session dates in
   the configured IANA timezone. Meeting links are private until registration is confirmed.
6. Assign moderator/admin roles in `user_roles` through trusted administration. The account
   dashboard supports report review and attendance check-in; server checks enforce roles.

## Cloudflare Pages (prepare, then deploy only with authorization)

Build with `npm ci --ignore-scripts && npm run build`. Output is `dist`; Pages Functions in
`functions/` import server-only `backend/` code. Use `wrangler.toml`. Do not publish the repository
root: it contains migrations and server source. Configure variables/secrets on a **preview**
deployment first. Preview and production must use separate Supabase projects and credentials.
The build itself needs no provider keys.

Register the Paystack **test-mode** webhook URL `<APP_ORIGIN>/api/payments/webhook`. Confirmation
requires provider verification, exact amount/currency/reference matching and test-domain enforcement.
Browser callback parameters never mark an order paid. Webhooks/manual verification are idempotent.
Full processed refunds revoke downloads and cancel associated registrations. Partial refunds require
manual review. No card data is stored.

Email uses an outbox: successful form submission means the database accepted the record, not that
email was delivered. Configure `jobs/` with APP_ORIGIN and the same JOB_SECRET, or invoke
`/api/jobs/email` and `/api/jobs/reconcile` from a trusted scheduler with
`Authorization: Bearer <JOB_SECRET>`. The included worker runs every five minutes. Email retries
up to five attempts before operator review. Monitor failed/sending outbox records, stale pending
orders, webhook errors and reconciliation outcomes. Job endpoints are POST-only and private.

## Operational rules and limits

- A retry continues the same order and hosted payment reference. It never creates another order
  or grants access prematurely. If initialization succeeds upstream but its response is lost before
  the checkout URL is persisted, reconciliation can recognize a later payment; an unpaid terminated
  reference requires operator recovery. Reconcile before creating another payment reference.
- Pending paid registrations reserve capacity. Reconcile before releasing seats. Paid cancellation/
  refund requests use an inquiry and team review. Free waitlists promote the oldest entry when a
  confirmed free seat is cancelled. Automatic paid waitlist invitation is not implemented.
- Download links expire after 60 seconds. Refunds revoke new links; an existing link may remain valid
  until expiry. Download limits count successful signed-link issuance, not completed file transfers.
  Product retention and re-download policies need owner approval.
- Account deletion is a durable request and team notification. Operators verify identity, review
  purchase access and legally required retention, complete Auth deletion and separately clean up
  Storage as appropriate. Document privacy/retention rules and schedule data cleanup before launch.
- Article/discussion bodies are escaped plain text. Comments are returned together with a selected
  thread; high-volume comment pagination is a future optimization. Only display names and opaque
  author IDs are exposed, never member emails.
- The dashboard returns the most recent 100 orders. Full historical export and publishing/admin UI
  are future extensions; trusted Supabase administration is the current content workflow.
- Approved legal content and any additional shipping/course eligibility rules remain owner decisions.
  The commercial community-access offer stays disabled. Discounts are explicit, default-disabled
  rows with expiry, minimum total, percentage and usage cap.

## Migrations and rollback

Version-control future migrations rather than editing an already deployed migration. Back up database
and Storage; test restore in isolation. Prefer forward fixes once real orders exist.
`supabase/rollback.sql` transactionally removes Stage 2 business data/objects. It is destructive and
requires reviewed backups and explicit authorization on live data. Auth users/Storage objects remain.

## Hosted acceptance gates

Before Stage 2 is complete, use real preview accounts to verify delivered verification/recovery,
account lifecycle and profile persistence across browsers; search/private boundaries; licensed
downloads with Paystack test success/failure/webhook replay/refund; guest receipt access; free/paid
capacity and delivered registration email; community posting/report/moderation; team inquiry delivery;
newsletter delivered confirmation/unsubscribe; outbox retry and job monitoring. Confirm provider logs.

Automated provider doubles do not replace these checks. Obtain explicit authorization before any
production launch, live key support, real payment or production migration.
