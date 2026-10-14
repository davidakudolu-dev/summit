# Cloudflare deployment compatibility audit — 14 October 2026

## Cause and selected fix

The error `Pages _routes.json is not supported` identifies a Pages-format artifact arriving at a
Workers/static-assets upload path. _routes.json is supported in actual Cloudflare Pages and the
old JSON validates as version 1. This is a deployment-product mismatch, not malformed JSON.
The user's exact dashboard screen was not inspected; use `wrangler pages project list` to confirm
whether that named project is Pages. A Workers project cannot accept the Pages ZIP unchanged.

The earlier package included Pages advanced-mode _worker.js and _routes.json, but its demo
wrangler.toml configured Workers `main`, `workers_dev` and `[assets]`. The packager invoked
`wrangler deploy` then turned that output into a Pages ZIP. A local dry-run checked compilation,
but did not validate remote Workers asset ingestion. That mixture and broad dashboard-upload
instructions were incorrect for the reported deployment target.

Cloudflare's Pages dashboard can accept a compiled advanced-mode _worker.js, but does not compile
a source functions/ folder. Its Workers asset uploader is a different product with different
routing rules. The supported full deployment selected here is **Wrangler Pages source-functions
mode**, preserving the existing application and provider architecture without migrating it.

## Component inventory and result

| Component | Audit / correction |
| --- | --- |
| dist/_routes.json | Retained; version 1; API, public clean/detail, account, legal, robots/sitemap routes included |
| functions/api/[[path]].js | Preserved; API dispatcher covers authentication, admin/MFA, Supabase, Paystack, mail and jobs |
| functions/[[path]].js | Preserved; public rendering, metadata, published-content visibility and asset fallback |
| backend/, shared/ | Preserved; server code stays outside static output and is bundled into Pages Functions |
| _worker.js | Old ZIP used advanced mode; new recommended dist intentionally has no worker to avoid overriding source functions |
| root wrangler.toml | Pages pages_build_output_dir=dist; no Workers main/[assets]/workers_dev |
| demo/wrangler.toml | Corrected to Pages reference configuration; Pages CLI uses the root config, not a custom --config path |
| build:functions script | Portable Node wrapper; removes POSIX-only environment assignment syntax from Windows setup |
| full ZIP | Complete source project plus prebuilt dist; includes functions/backend, manifests/lockfile, Pages config, migrations and guides |
| static ZIP | Separate labelled preview with original UI assets and safe disabled forms; no Pages Functions markers/backend code |

No public UI, database migration, authentication rule, financial verification or provider adapter
was redesigned or removed. The static preview is generated separately; its disabled API adapter
never ships with the full application. Original Stage 1 CSS/artwork remain intact.

## Validation scope

The final validation report is docs/CLOUDFLARE_VALIDATION.md. Schema/API/browser regressions and
Cloudflare workerd checks use isolated fixtures and explicit provider doubles. Build configuration
and routing are checked locally by the pinned CLI. No credentialed hosted deployment/provider
acceptance is claimed: Cloudflare network/auth and external test-service values remain missing in
this environment. Legal/retention/backup owner launch gates remain unchanged.

References: Cloudflare Pages Direct Upload (functions versus compiled _worker.js), Pages Functions
routing/_routes.json, Pages Wrangler configuration, and Workers migration routing differences:
https://developers.cloudflare.com/pages/get-started/direct-upload/
https://developers.cloudflare.com/pages/functions/routing/
https://developers.cloudflare.com/pages/functions/wrangler-configuration/
https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
