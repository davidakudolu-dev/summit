# Interactive sandbox deployment

The sandbox uses the real Stage 3 API, a separate Supabase test project and Paystack test mode.
Use the root Pages wrangler.toml and source functions/, following [Windows deployment steps](../docs/CLOUDFLARE_WINDOWS.md).
The previous Workers-assets packaging workflow is superseded. Full application source remains intact.

The separate static-preview build is visual-only; it has no operational accounts, payments, admin
data, registrations, community persistence or email. Use it only for a clearly labelled preview.

Hosted sandbox access/test-provider credentials must be supplied securely. Legal/retention/backup
approval and live payments remain owner launch gates.
