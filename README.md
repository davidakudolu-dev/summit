# 1751 Cloudflare sandbox deployment package

Download `1751_Cloudflare_Sandbox.zip` from this branch. It is an upload-ready Cloudflare Pages
archive: index.html is at its root, together with compiled _worker.js, _headers, _routes.json,
the public website, administrative interface, scripts, styles, images and licensed font files.
It contains no server credentials. The original ZIP checksum is in 1751_Cloudflare_Sandbox.sha256.

## Download using Git

```sh
git clone --branch cloudflare-sandbox-package --single-branch https://github.com/davidakudolu-dev/summit.git 1751-cloudflare-package
cd 1751-cloudflare-package
sha256sum -c 1751_Cloudflare_Sandbox.sha256
```

If the repository is private, sign into GitHub with an account allowed to access it. You can also
open the ZIP file in GitHub and use **Download raw file**. Do not download a preview of its contents.

## Deploy

Cloudflare dashboard: Workers & Pages → create a new Pages Direct Upload project → upload the
ZIP → deploy. A compiled _worker.js is supported in dashboard Direct Upload. Do not upload this
entire repository as static content: database/configuration/docs are deployment support files.

For the CLI, extract the ZIP into `site/`, authenticate to your Cloudflare account and run:

```sh
unzip 1751_Cloudflare_Sandbox.zip -d site
npx wrangler pages deploy site --config configuration/wrangler.toml --project-name YOUR-NEW-DEMO-PROJECT --branch sandbox
```

Use a separate Supabase test project. Apply database/ migrations in order, then both Storage
setup scripts. Enable confirmed-email password Auth and TOTP, configure test SMTP, and enter the
server variables from configuration/.env.example securely in the Cloudflare environment used by
this demo deployment. A dashboard upload initially uses the demo project's Production environment;
a CLI --branch sandbox upload normally uses Preview. Match the bindings to the actual deployment.
Set APP_ORIGIN and Supabase Auth redirects to the exact stable HTTPS demo URL; use Paystack test
keys/webhook and approved tester email recipients only. The wrapper always disables indexing.

Create a verified tester account and assign the owner-selected initial super-administrator,
enroll MFA, and enter approved SANDBOX ONLY content through /admin. New downloadable files
require the scanner. See docs/ for detailed setup, administrative operation and remaining gates.

## What is and is not verified

ZIP integrity, compiled worker routing, static admin delivery, noindex/robots and credential
exclusion were checked locally. Hosted deployment and external providers are not configured:
without the service bindings, health reports configured:false and data-backed routes return 503.
Uploading does not create a database or automatically enable account/payment/email operations.
Legal/retention/backup approvals and live payments remain outside this sandbox deployment.
