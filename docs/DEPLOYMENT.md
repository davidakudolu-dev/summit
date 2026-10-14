# Stage 3 deployment and rollback

This release prepares Cloudflare Pages + Pages Functions, Supabase Auth/PostgreSQL/Storage,
Paystack test checkout and Resend transactional mail. No hosted staging/production deployment,
DNS change, real campaign or live transaction has been performed or authorized.

For this deployment use the corrected **Pages source-functions** workflow in [Windows steps](CLOUDFLARE_WINDOWS.md).
The old mixed Workers-assets ZIP workflow is superseded; the full source remains preserved.

## Configure an isolated preview first

1. Use separate staging and production projects, buckets, mail destinations and credentials.
   Set the names in `.env.example` securely. `APP_ORIGIN` must be the exact preview HTTPS origin.
   Leave `PUBLIC_INDEXING_ENABLED=false` and `HTTPS_VERIFIED=false` initially. Paystack requires
   `sk_test_` credentials; the API rejects live keys and live-domain transactions.
2. Back up existing data and record migration history. On a fresh approved staging project apply
   `supabase/migrations/202610130001_platform.sql` once, then
   `supabase/migrations/202610130002_admin.sql` once. On an existing Stage 2 project apply only
   the second migration. No test fixture/seed script belongs in staging business data.
3. Apply `supabase/storage.sql` and `supabase/storage-stage3.sql`. Digital products and quarantine
   are private; site-media is public image content with no client-write policy. Confirm RLS,
   anon/authenticated grants and service-only RPC invocation. Review legacy files before trusting
   them: new files require scanning, while legacy product assets were preserved.
4. Configure Supabase email/password Auth, email confirmation, TOTP MFA and a verified SMTP
   sender. Set Site URL and exact redirect allowlist to APP_ORIGIN; configure strength/rate limits,
   secure email changes and disable unused providers. Verification template:

   ```html
   <a href="{{ .SiteURL }}/#verify/signup/{{ .TokenHash }}">Verify your email</a>
   ```

   Recovery uses `#verify/recovery/{{ .TokenHash }}`. Verify delivered links, fresh TOTP enrollment,
   actual provider AAL2/AMR timestamps, cookie refresh and high-impact step-up with a real test
   account. The client removes link capabilities from history after creating the verification form.
5. The owner must identify the first verified administrator. Through trusted SQL administration,
   parameterize that known Auth UUID into `insert into public.user_roles(user_id,role)
   values(<verified owner UUID>,'super_admin')`. Do not promote accounts by guessing email or
   installing a default admin. Enroll MFA before using `/admin`; grant daily roles through its UI.
6. Configure Resend, verified EMAIL_FROM, approved TEAM_INBOX and OPS_INBOX, and independent
   outside uptime/job-failure monitoring. Integration presence is not delivery verification.
   Connect an approved HTTPS scanner with SCANNER_URL/TOKEN; its JSON verdict must match the
   exact uploaded SHA256. Confirm clean/rejected/quarantine behavior against real Storage.
7. Supply distinct cryptographically random APP_SECRET and JOB_SECRET, each >=32 characters.
   APP_SECRET signs capabilities and pseudonymizes IPs; JOB_SECRET protects jobs. Never put raw
   values into the frontend, downloadable package, chat or version control. Preserve APP_SECRET
   across ordinary releases so guest checkout retries remain usable.

Network access needs the exact Supabase project host, api.paystack.co, api.resend.com, scanner
host and approved backup endpoint/database host. Existing package-manager network presets must
be preserved. Browser payment redirects use checkout.paystack.com. Unknown hosts are owner
requirements; do not grant a wildcard for all projects or print secret values to diagnose them.

## Build and deploy only after approval

Run `npm ci --ignore-scripts --no-audit --no-fund`, `npm run check`, browser/admin checks and
`npm run build:functions`. The supported full deployment is root `wrangler.toml`, source `functions/`
and static `dist/` with `_routes.json`. Run `npm run pages:deploy -- --project-name <Pages project>
--branch sandbox` from the project root. Keep `_worker.js` out of dist in this source-functions mode;
it would override source functions. Pages uses root configuration automatically and does not accept
a custom --config file location. Do not use Workers `wrangler deploy` on this Pages directory.
Do not upload the full source ZIP or repository root as static content. The separate clearly labelled
static-preview ZIP is for dashboard visual review only, with backend actions disabled.
Configure variables/secrets on the Preview deployment first, using separate staging and production
Supabase projects/credentials. Build needs no provider keys. See CLOUDFLARE_WINDOWS.md for exact
extraction, install, login, project identification, secret configuration and deployment commands.

Register `<APP_ORIGIN>/api/payments/webhook` in Paystack test mode and verify exact matching,
forged signatures, replay, delayed callbacks, declined transactions and refunds. Configure the
protected jobs worker in `jobs/` with APP_ORIGIN and JOB_SECRET; it runs mail, reconciliation and
health checks every five minutes. Backup scheduling is separate and off until approved; see
BACKUP_RECOVERY.md. None of the included CI workflows deploys the website.

Use `/admin` to enter owner-approved catalog, licensed files, programme/speaker data, communities,
stories and controlled homepage content. Drafts remain private. Publish seven approved legal
policies: privacy, terms, cookies, refunds, digital-delivery, community-guidelines and event-terms.
Policies and retention approval remain explicit owner launch blockers, as requested.

## Hosted acceptance and release record

Record the exact commit/artifact SHA256, applied migrations, hosting build, configuration names,
approved content, owner/admin assignments and operator sign-off. Push/review source in the selected
repository and protect the release branch; this local work does not claim a pushed remote release.
Run the launch checklist in LAUNCH_CHECKLIST.md against a real preview. Validate account signup/
verification/recovery, MFA, role/revocation, paid test checkout, receipt and private file delivery,
event capacity/notifications, moderation, publishing, inquiry mail, newsletter consent and monitor
alerts. Capture provider logs and verify backup/isolated restore before requesting production approval.

After domain access is provided, configure DNS, TLS, Cloudflare's Always Use HTTPS and an exact
canonical-host redirect preserving paths/query strings. Verify the certificate and redirects
on every host, API, admin and static route. HSTS is emitted for HTTPS public-rendered routes only
when HTTPS_VERIFIED=true; use a reviewed edge rule for complete host coverage. Enable indexing
only on the approved production origin after legal/content acceptance. No live payment activation
is included in this release; that requires separate authorization, reviewed code/configuration
and merchant acceptance.

## Rollback

Preserve the previous application artifact and tested database/Storage backup. Prefer a forward
fix for a data-bearing migration. If an application rollback is necessary, route the affected
operations to maintenance, reconcile provider payments and roll back frontend AND API together
to a compatible artifact. Do not roll back to the old Stage 2 staff moderation endpoint against
Stage 3 data: the new wrapper deliberately requires MFA. Preserve Stage 3 data and use a reviewed
compatibility fix. Test rollback in isolated staging first.

`supabase/rollback.sql` is the original destructive Stage 2 teardown, retained as historical
evidence; it is NOT a safe production Stage 3 downgrade. Do not run it on customer data.
For schema recovery, restore into a separate approved target, check grants and relationships,
then obtain explicit cutover authorization. Backups protect public/auth data and object bytes;
secret-manager and hosting configuration recovery must be tested separately.
