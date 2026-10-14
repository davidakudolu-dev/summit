# Fully interactive Cloudflare sandbox

This demo uses the actual Stage 3 API and a separate Supabase test project. It needs real test
service configuration. No accounts, provider keys or working hosted URL currently exist in this
workspace. Cloudflare OAuth/API connection also returned a proxy CONNECT 403; the saved environment
network draft includes api.cloudflare.com and dash.cloudflare.com but must be applied before retrying.
A compiled upload succeeding by itself cannot enable sign-in or database functions.
The sandbox wrapper keeps every route unindexed even if an indexing variable is accidentally set.
Payments are the existing Paystack test integration; live keys remain rejected.

## Secure settings needed

Set values securely in Codex environment settings so the deployment can be completed here;
never paste secret values into chat. For a manual upload, use Cloudflare Pages' project
**Settings → Variables and Secrets**, selecting Preview, and the corresponding provider dashboards.

| Setting | Where it comes from / enables |
| --- | --- |
| CLOUDFLARE_ACCOUNT_ID | Cloudflare account: identifies the account in which to create the demo |
| CLOUDFLARE_API_TOKEN | Scoped token with Account → Cloudflare Pages → Edit for Pages deployment |
| SUPABASE_URL | A separate Supabase test project URL; do not use production |
| SUPABASE_ANON_KEY | Test project legacy anon key for Auth |
| SUPABASE_SERVICE_ROLE_KEY | Test project legacy service-role key, server secret |
| PAYSTACK_SECRET_KEY | Paystack **test** secret, starting sk_test_, for sandbox checkout |
| RESEND_API_KEY | Email test transport; restrict recipients to approved testers |
| EMAIL_FROM | Verified test sender |
| TEAM_INBOX / OPS_INBOX | Tester-owned recipients; never real customer campaign lists |
| APP_SECRET / JOB_SECRET | Distinct cryptographically random server secrets, >=32 characters |
| SCANNER_URL / SCANNER_TOKEN | Needed to test new downloadable document uploads/publication |
| APP_ORIGIN | Exact stable HTTPS sandbox deployment origin once created |

For a Workers deployment instead, a token needs Account → Workers Scripts → Edit.
Cloudflare deployment token/account ID belong only in the deploy runner, not website bindings.
Auth confirmation/recovery requires verified test SMTP on Supabase. Without email/Paystack/
scanner access, the corresponding workflows remain unavailable and must not be called verified.

## Deployment sequence

1. Create a new Pages Direct Upload project in the intended account, with a unique demo name.
   Use a new isolated project and `sandbox` preview branch, avoiding an existing live site.
2. Apply both versioned migrations to the fresh Supabase test project, followed by both Storage
   setup SQL files. An existing Stage 2 test project needs only the additive Stage 3 migration;
   verify migration history first. These scripts must never target the production project.
3. Enable email confirmation, password Auth and TOTP; configure test SMTP. Set Supabase Site URL
   and exact redirect allowlist to the stable sandbox branch alias shown by Cloudflare. Configure
   the verification/recovery token-hash templates from docs/DEPLOYMENT.md.
4. Run `python3 scripts/package-sandbox.py` (Node/npm and Python 3 required). It builds the real
   platform, checks Wrangler's dry-run, extracts the JavaScript module from its multipart payload,
   copies allowlisted assets and adds the compiled `_worker.js`, noindex headers and routing.
   The prepared 1751_Cloudflare_Sandbox.zip is this upload directory, with index.html at ZIP root.
5. Configure Preview bindings using the table above and APP_ENV=staging. Upload the prepared
   directory with `wrangler pages deploy <directory> --project-name <new-project> --branch sandbox`,
   or dashboard Direct Upload. Cloudflare supports a compiled `_worker.js` in drag-and-drop
   uploads; uploading an uncompiled functions directory through that UI is unsupported.
6. Set APP_ORIGIN to the exact stable alias, configure the provider redirects/webhook and redeploy
   if needed. Paystack test webhook is `<APP_ORIGIN>/api/payments/webhook`. Use the stable alias
   for the demo: temporary hashed deployment origins will not satisfy a different exact CSRF origin.
7. Create a verified tester account and assign the owner-selected first Super Administrator using
   the procedure in docs/DEPLOYMENT.md. Enroll MFA. Enter clearly labelled SANDBOX ONLY products,
   events, communities and stories via `/admin`; upload approved test files through the scanner.
   Test data creation is authorized for this isolated demo, not for production records. Do not
   invent or approve legal/retention policies to unlock deletion; those gates remain blocked.
8. Run protected email/reconciliation jobs for tester-only delivery, then test signup/recovery,
   MFA/roles, sandbox success/failure, private downloads, registrations, community, CMS and forms.
   Record actual results and the final reachable URL. A noindex header is not access protection;
   configure Cloudflare Access for private testers if that is the required audience.

## Current status

Compiled source/assets are prepared locally. Required account/test-provider credentials are
absent, so no interactive site has been deployed. A fully interactive sandbox must pass hosted
acceptance; local tests with provider doubles are separate evidence. Production legal/retention,
backup and live-payment launch gates remain unchanged by a demo deployment request.
