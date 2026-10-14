# Correct Cloudflare deployment for 1751 (Windows / PowerShell)

Use **Cloudflare Pages with source Pages Functions through Wrangler** for the complete application.
The project root contains functions/, backend/, wrangler.toml and package.json. The built static
folder is dist/. Keep dist/_routes.json. Do not put a compiled _worker.js into dist/ for this mode.
Do not upload the full source ZIP through the dashboard's Workers Static Assets importer.

## Dashboard preview: the shortest Windows path

1. Download **1751_DASHBOARD_UPLOAD_STATIC_ONLY.zip** from this repository's download link.
2. Cloudflare → Workers & Pages → Pages → Direct Upload: choose a separate preview project.
3. Select that ZIP itself and upload it. Do not select the full-source ZIP, the GitHub repository
   archive or the entire extracted project folder. The correct upload has 32 files, not 140.
4. Deploy and open the URL Cloudflare reports. Verify the visible "Static preview only" label.
   Navigation/layout/carousel can be reviewed; account/admin/payment/data/email actions are disabled.

No Node/npm, configuration keys or wrangler.toml upload is needed for this static preview.
The remainder of this guide is for the separate complete Wrangler application.

## 1. Download and extract the full package

Download **1751_WRANGLER_FULL_SOURCE_DO_NOT_UPLOAD_TO_DASHBOARD.zip** from this repository branch and save it in Downloads.
Install Node.js 24 LTS from nodejs.org; close/reopen PowerShell after installation.

```powershell
$zip = Join-Path $env:USERPROFILE 'Downloads\1751_WRANGLER_FULL_SOURCE_DO_NOT_UPLOAD_TO_DASHBOARD.zip'
$folder = Join-Path $env:USERPROFILE 'Downloads\1751-pages-fixed'
Expand-Archive -LiteralPath $zip -DestinationPath $folder
Set-Location (Join-Path $folder '1751-cloudflare-pages')
node --version
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run build
npm.cmd run build:static
npm.cmd run validate:deployment
npm.cmd run build:functions
```

Use a new extraction folder rather than combining this package with the old ZIP. npm.cmd avoids
PowerShell's npm.ps1 execution-policy issue without changing your execution policy. No Python is
needed to deploy on Windows. The Python script is only an optional maintainer ZIP packager.

Expected: dist/index.html and dist/_routes.json exist; dist/_worker.js does not. functions/ sits
beside dist/, not inside it. build:functions compiles a verification bundle into ignored .local/;
Wrangler Pages deployment itself compiles and deploys the source functions automatically.

## 2. Authenticate and confirm the project is Pages

```powershell
node scripts/wrangler.mjs login
node scripts/wrangler.mjs pages project list
$projectName = 'REPLACE-WITH-YOUR-EXACT-PAGES-PROJECT-NAME'
```

Choose the existing 1751 **Pages** project name shown by project list. If your dashboard project
is a Worker and is not listed, create a separate Pages project instead of deploying Pages files
into its asset importer. Only for a new Pages project:

```powershell
node scripts/wrangler.mjs pages project create $projectName --production-branch main --force
```

The pinned CLI's --force here explicitly selects Pages rather than its optional new-project
Workers delegation. It does not migrate the existing site. Do not run project create if your
Pages project already exists. Do not run `wrangler deploy` for this package. Pages uses the root
wrangler.toml automatically; passing a custom --config location is unsupported by Pages.

## 3. Configure the sandbox services

In the Pages project's **Settings → Variables and Secrets**, select **Preview** for the sandbox
branch deployment. Enter the names in .env.example securely. In particular:

- APP_ORIGIN = the exact stable HTTPS sandbox branch URL displayed by Cloudflare, normally
  https://sandbox.YOUR-PROJECT.pages.dev. Use that stable URL for browser tests, Auth redirects,
  receipts and the Paystack test webhook.
- SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY = separate test-project credentials.
- PAYSTACK_SECRET_KEY = sk_test_ key only; live keys remain rejected.
- RESEND_API_KEY, EMAIL_FROM and tester-owned TEAM_INBOX/OPS_INBOX = approved test mail delivery.
- APP_SECRET and JOB_SECRET = separate cryptographically random secrets at least 32 characters.
- APP_ENV = staging; PUBLIC_INDEXING_ENABLED = false; HTTPS_VERIFIED = false until TLS acceptance.
- SCANNER_URL/SCANNER_TOKEN = approved scanner for new downloadable document uploads.

Keep keys out of PowerShell history, Git and public files. Secret values belong in encrypted Pages
bindings. Do not replace working provider credentials or apply migrations again blindly.

For a fresh isolated Supabase project, apply the two versioned migrations in order and both
Storage setup files. For an existing Stage 2/3 project, first review migration history and apply
only missing migrations. Preserve all existing records. Configure confirmed-email password Auth,
TOTP and test SMTP. Set Site URL/redirect allowlist to the sandbox URL and use the token-hash email
link templates in docs/DEPLOYMENT.md. Bootstrap only the owner-selected verified administrator;
there is no default admin or password in this package.

## 4. Deploy the complete site to Preview

Run from the project root used above:

```powershell
npm.cmd run pages:deploy -- --project-name $projectName --branch sandbox
```

Wrangler should compile functions/ and upload dist/ plus the valid Pages _routes.json. The /api/*
handler remains functions/api/[[path]].js; public rendering remains functions/[[path]].js.
Do not delete _routes.json, remove functions/, use --no-bundle to conceal compile errors, or upload
backend/database source as static assets. Production release is a separate decision; keep this
initial deployment on the sandbox preview branch.

## 5. Check the deployed URL

Use the stable sandbox URL Cloudflare actually reports. Replace the placeholder below:

```powershell
$demoUrl = 'https://sandbox.YOUR-PROJECT.pages.dev'
Invoke-RestMethod "$demoUrl/api/health"
Invoke-RestMethod "$demoUrl/api/products"
Start-Process $demoUrl
Start-Process "$demoUrl/admin"
```

Health configured:false means required backend values are still missing. configured:true is only
a presence check; products must return JSON to establish database connectivity. A 503 at the
homepage can indicate an unconnected content database, not a missing stylesheet or redesign.

Verify signup/email/recovery, MFA/admin permissions, Store/Stories/Summit deep links after refresh,
Paystack test success/failure/replay, private downloads, registration persistence, community access,
inquiry mail and newsletter opt-in/unsubscribe. Check browser network calls use /api/, and review
Pages Function logs without printing secret values. Queued email is not proof of delivery.

## Optional dashboard-only static preview

Use **1751_DASHBOARD_UPLOAD_STATIC_ONLY.zip** with a separate dashboard Direct Upload project. ZIP root
contains index.html, artwork, fonts, scripts/styles, _headers, _redirects and a visible preview label.
It deliberately has no functions/, _worker.js or _routes.json. It is a separate visual artifact;
all original source/backend files remain in the full package.

Visual navigation, responsive layout, carousel and dialogs can be reviewed. Authentication,
admin data/actions, Supabase reads/writes, Paystack checkout/verification, paid downloads, live
catalog/stories/schedule/community records, registration, inquiry/newsletter delivery and protected
jobs do not run. Forms return an explicit preview-unavailable message rather than false success.
Do not upload this visual ZIP over your working full application.
