# Dashboard assets versus Wrangler source — updated 17 October 2026

The reported `1/140 files could not be uploaded — wrangler.toml` matches the 140-entry full source
archive. The source/configuration package was sent to the dashboard's public-assets upload path.
wrangler.toml is configuration for Wrangler, not a public asset. Removing just that file from the
source ZIP would still leave backend source, migration/configuration templates and a mixed upload.
The earlier _routes.json rejection likewise concerned a Pages routing file in an incompatible
upload path. Pages routing is preserved in the full application; the static preview needs only
supported _headers/_redirects rules and contains no backend routing markers.

## Clean public upload

1751_DASHBOARD_UPLOAD_STATIC_ONLY.zip is generated from an explicit public-asset allowlist.
It contains 39 files, with index.html at ZIP root. No source/configuration templates, manifests,
server code, functions, _worker.js, _routes.json, hidden environment files or private values enter
this artifact. Credentials remain deployment bindings. Its reconstructed reference UI is visibly labelled as a
static preview, with data-backed actions explicitly unavailable and zero API network requests.

## Complete source deployment

1751_WRANGLER_FULL_SOURCE_DO_NOT_UPLOAD_TO_DASHBOARD.zip contains the application source,
configuration templates with no credentials, root Pages wrangler.toml, functions/, backend/,
Supabase migrations/storage setup and prebuilt dist/. Wrangler Pages uploads only dist/ assets
and compiles the source Functions separately. dist/_routes.json is retained; dist/_worker.js is
absent in source-functions mode. It preserves Supabase Auth, MFA/RBAC/admin, Paystack test checkout,
email/jobs and every API handler. Working code and business data were not deleted or reset.

Windows steps and the choice of artifact are in README.md and CLOUDFLARE_WINDOWS.md. Current
validation includes public-asset allowlist/configuration exclusion, ZIP CRC/structure checks,
secret-value exclusion, source preservation, Cloudflare workerd/backend fixture checks, static
browser checks and downloaded GitHub artifact SHA256 verification. No credentialed hosted upload
or real provider acceptance is claimed by a local check. A fully interactive deployment still
needs the existing test-service settings configured securely in its Pages deployment environment.
