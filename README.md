# 1751 — Reference UI reconstruction

Reconstructed the supplied homepage, store and summit UI while preserving the existing application.
[Visual review, screenshots and implementation details](docs/UI_RECONSTRUCTION.md).

## Which download to use

**Uploading in the Cloudflare dashboard? Use only
[1751_DASHBOARD_UPLOAD_STATIC_ONLY.zip](https://github.com/davidakudolu-dev/summit/raw/refs/heads/cloudflare-sandbox-package/1751_DASHBOARD_UPLOAD_STATIC_ONLY.zip).**
Upload this ZIP as-is to a separate Pages Direct Upload preview project. It has index.html at ZIP
root and only public HTML/CSS/JS/images/fonts plus supported _headers/_redirects/robots files.
It has no wrangler.toml, _routes.json, _worker.js, functions, server source or secret/config files.
This is a labelled visual preview with reference sample content and prices: authentication, admin operations, payments, saved data and email do not run. It contains 39 public files.
Do not upload it over a working full application.

**Need the full interactive application? Download
[1751_WRANGLER_FULL_SOURCE_DO_NOT_UPLOAD_TO_DASHBOARD.zip](https://github.com/davidakudolu-dev/summit/raw/refs/heads/cloudflare-sandbox-package/1751_WRANGLER_FULL_SOURCE_DO_NOT_UPLOAD_TO_DASHBOARD.zip).**
Extract it locally and follow [Windows CLI steps](docs/CLOUDFLARE_WINDOWS.md). Never drag this archive
or its root folder into the dashboard asset uploader. Its wrangler.toml, functions and configuration
are intentionally outside dist/. Wrangler uploads dist/ assets and compiles functions/ separately.
The earlier 140-file full-source ZIP is superseded by this explicitly named package.

The Stage 1 design and Stage 2 transactional platform now include protected administration,
MFA and role permissions, content/catalog/event/support management, audit history, secure uploads,
verified payment operations, public server rendering/SEO, health monitoring and encrypted recovery
scripts. Original artwork and the Stage 1 stylesheet remain available; reference.css supplies the reconstructed UI. Paystack remains test-only.

Local implementation is available; public launch remains blocked by owner access/configuration
and legal/retention decisions. No public deployment or live payment activation occurred.

## Cloudflare deployment fix

Use the **1751_WRANGLER_FULL_SOURCE_DO_NOT_UPLOAD_TO_DASHBOARD.zip** source package with **Wrangler Pages**, from a project
root containing functions/, backend/, package.json and wrangler.toml. Keep dist/_routes.json.
This is source-functions mode; do not put a compiled _worker.js in dist/ or run `wrangler deploy`.
The `Pages _routes.json is not supported` error comes from sending Pages artifacts to a Workers
asset importer. [Audit](docs/CLOUDFLARE_AUDIT.md) and [exact Windows steps](docs/CLOUDFLARE_WINDOWS.md).

After extracting the full source ZIP, open PowerShell in its 1751-cloudflare-pages folder:

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run build
npm.cmd run build:static
npm.cmd run validate:deployment
npm.cmd run build:functions
node scripts/wrangler.mjs login
node scripts/wrangler.mjs pages project list
npm.cmd run pages:deploy -- --project-name YOUR-EXACT-PAGES-PROJECT --branch sandbox
```

Configure Preview secrets/variables from .env.example and the exact APP_ORIGIN before testing
interactive features. Use the existing Pages project from project list; see the Windows guide
if you currently have only a Workers project. Pages does not support a custom --config location.
No Python, Bash or PowerShell execution-policy change is needed for these deployment commands.

**1751_DASHBOARD_UPLOAD_STATIC_ONLY.zip** is the separate dashboard-only visual preview. Its ZIP root
contains index.html; it has no functions, _worker.js or _routes.json. Account/admin data, payments,
private files, live content/registration/community/forms/email/jobs are unavailable in that preview.
It does not replace the full application. Do not upload either the full source ZIP or your whole
repository as static assets. Use the clearly named artifact for its documented deployment method.

## Develop and validate

Requires Node 22+ (validated on 24.19.0), with the lockfile's development tools. Use the existing
isolated `/workspace/summit` checkout; no additional worktree is required.

```sh
cd /workspace/summit
npm ci --ignore-scripts --no-audit --no-fund --cache /workspace/.npm-cache
npm run check
npm run build:functions
npm run dev
```

Copy `.env.example` to ignored `.dev.vars` and supply server values securely to connect a real
staging project. Without those values, the static site/admin shell starts but provider-backed APIs
return explicit errors and health reports `configured:false`. There are no runtime provider mocks.

```sh
npm run test:browser
npm run test:admin
npm run test:performance
```

Browser tools use Chromium; set CHROMIUM_PATH or install the pinned Playwright Chromium.
Tests use disposable PostgreSQL/PGlite and explicit external-provider doubles. Docker PostgreSQL
concurrency/recovery instructions are in docs/TESTING.md. None of the test fixtures is production
inventory. Build output excludes credentials, tests, migrations and server source from static assets.

## Release contents

- `admin/`, `backend/`, `shared/`, `functions/`: administration, API and public rendering.
- `index.html`, `stage1.*`, `stage2.*`, `stage3.*`, `bootstrap.js`, `assets/`: original public experience
  with additive accounts/business/content integrations and licensed self-hosted original font families.
- `supabase/`: preserved Stage 2 and additive Stage 3 migrations/storage setup.
- `jobs/`, `scripts/`, `.github/`: protected operations, encryption/restore and non-deploying CI.
- `.env.example`, `backup.env.example`: configuration names/defaults without secrets.
- [Administration manual](docs/ADMIN_MANUAL.md), [deployment/rollback](docs/DEPLOYMENT.md),
  [backup/recovery](docs/BACKUP_RECOVERY.md), [security review](docs/SECURITY_REVIEW.md),
  [launch checklist](docs/LAUNCH_CHECKLIST.md), [QA results](QA_REPORT.md).

Stage 1/2 reports are preserved under `docs/stage1/` and `docs/stage2/`. The corrected Cloudflare full package uses source Functions and prebuilt dist/ in Pages mode.
Previous advanced-worker ZIPs are superseded for deployment; use the Windows guide above.
