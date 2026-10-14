# Stage 2 audit and implementation plan

The uploaded Stage 1 contains one static HTML document, inline layout styles and JavaScript,
stage1.css, stage1.js, ten WebP assets, and previous documentation. There is no build system,
hosting configuration, server, database, credential binding, or approved inventory.
Stage 1 navigation, image carousel, modal focus handling, layout and artwork are retained.

## Integration inventory

| Surface | Stage 1 behavior | Stage 2 integration |
| --- | --- | --- |
| Store / featured cards | Eight illustrative products, browser filtering | Published PostgreSQL products, API filtering/sorting/pagination |
| Cart | localStorage quantity map with browser prices | Non-sensitive guest selection; authenticated persisted cart; server checkout recalculation |
| Checkout | informational dialog | Pending orders, hosted Paystack test checkout, verification, webhooks, entitlements |
| Schedule / five-day tabs | Two sample days, three empty days | Published summits/sessions, timezone-aware dynamic day tabs, capacity transactions |
| Registration | form validation only | Authenticated free/paid registration, waitlist, references, cancellation, protected meeting details |
| Community | interest form, proposed groups | Published communities, membership, posts/comments, reports and moderation |
| Stories | three fabricated preview teasers | Published articles, URL routes, search and related stories |
| Services | local form validation | Durable inquiries, consent, deduplication, transactional email outbox |
| Newsletter | email validation only | Double opt-in, durable consent, expiring capabilities and unsubscribe |
| Search | local pages/sample products | Public database search plus existing ecosystem pages |
| Accounts | absent | Supabase Auth, HttpOnly sessions, dashboard and account settings |

## Infrastructure

Cloudflare Pages serves a strictly allowlisted dist/ directory. A Pages Function routes /api/*
to backend/api.js. Supabase provides PostgreSQL, Auth (including verified email and recovery),
and a private digital-products Storage bucket. No service credential is delivered to the browser.
The backend validates identities against Auth and invokes restricted transactional SQL RPCs.
All business tables have RLS; direct anonymous/authenticated access is revoked. RPCs are
service-role-only, with explicit actor authorization and constrained search paths. Administrative
publishing is through trusted Supabase administration; moderation actions require an explicit role.

Paystack is the proposed sandbox gateway, pending provider preference. No production payment
key is accepted. Resend is the proposed email transport. A durable database outbox separates
accepted records from email delivery; a protected job retries transient failures. Provider-backed
calls require configured accounts and credentials. Local integration tests use a real PostgreSQL
engine (PGlite) and explicit test doubles for external services; they do not prove provider delivery.

## Data and launch gates

No preview products, events, speakers, authors or dates are seeded as approved business content.
The displayed community promotional offer remains disabled; discounts must be explicitly configured.
Approved data, private product files, sender domain, inbox, Auth mail templates, credentials,
and deployment configuration must be supplied before hosted acceptance testing or production launch.
Schema rollback is documented separately and requires backups. No external deployment or message
to a real customer is performed during this task.

## Stage 3 extension

The original migration and public layout are retained. `202610130002_admin.sql` adds explicit
permissions, service-only MFA-gated administrative RPC, immutable audits/revisions, safe archives,
private restrictions, provider-reviewed financial operations, controlled settings/policies, uploads
metadata, health runs and owner-gated deletion. It renames the existing business RPC to a private
Stage 2 implementation and wraps it with revocation/maintenance/content checks. Legacy staff
operations use the new administrative gate; customer business operations still use existing
transaction logic. No migration installs test data or resets production schemas.

`admin/` is an accessible static shell with permission-filtered UI; private data comes only from
verified API calls. `backend/admin.js` validates provider-verified claims and inputs;
`backend/uploads.js` quarantines bounded documents. `backend/render.js` adds public metadata and
published clean routes, with `stage3.js` adapting the existing client navigation/content settings.
Self-hosted licensed DM Sans/Manrope eliminate the external font request while preserving typography.

The protected scheduler records email/reconciliation/health runs. Independent backup tooling
captures public/auth database data with ACLs and Storage bytes, encrypts before remote upload,
verifies metadata and requires isolated targets/trusted hashes for restore. Recovery acceptance
and external outage alerting remain separate from successful copy commands. See the Stage 3
runbooks and release report for actual coverage and remaining owner gates.
