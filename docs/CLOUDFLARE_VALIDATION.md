# Cloudflare routing fix validation — 14 October 2026

Passed current checks:

- 44/44 backend regression tests; 13/13 public-browser and 8/8 admin-browser checks.
- Pinned Wrangler Pages Functions compilation and source build.
- Deployment validator: root Pages-only config, retained valid _routes.json and nested API/public
  source Functions, no _worker.js conflict, no credentials/backend source in static output.
- Actual `wrangler pages dev` parsed the Pages routes/headers and served API JSON, admin, artwork
  and CSS. Missing provider values correctly returned configured:false/503. Unknown private-looking
  file paths now return a custom 404 instead of Pages' automatic SPA fallback; no secret file exists
  in either output. Clean application routes continue through the unchanged source Functions.
- Actual Cloudflare workerd with isolated PostgreSQL/PGlite and explicit test-only provider doubles:
  SSR Store, catalog API, login/cookie/dashboard, verified Paystack test purchase, signed download,
  persistent registration, protected email flush and MFA-gated admin overview passed. Assets and
  credential-file denial passed. No customer email/payment or real provider request was made.
- Static browser preview: six public/account views at 375/768/1440, visible preview label, admin
  shell, explicitly unavailable actions and zero API network requests passed.
- Original Stage 1 stylesheet and ten artwork files remain byte-identical to the uploaded ZIP.

Windows commands were prepared using Node CLI wrappers and npm.cmd and avoid POSIX assignments,
Python deployment requirements, custom Pages config paths and execution-policy changes. They were
not executed on a Windows host. Current CLI builds/runtime checks ran on this Linux environment.
Hosted Pages upload/provider acceptance requires valid account/service access; no remote Cloudflare
site deployment is claimed. Existing legal/retention/backup/live-payment gates are preserved.

Full and static ZIP entry checks, CRC integrity, credential scans and final GitHub HTTPS download
checksum verification are performed before reporting the artifact links. They validate downloadable
packaging, not merchant email/Auth/Storage acceptance or a completed hosted release.
