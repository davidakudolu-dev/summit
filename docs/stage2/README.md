# 1751 — Stage 2 platform

The uploaded Stage 1 design now connects to a server API, transactional PostgreSQL schema,
Supabase Auth and private Storage, Paystack **test** checkout and a Resend email outbox.
The static frontend architecture, artwork, green/lavender theme, carousel and original five pages
are preserved. Account, order, article and discussion views extend the same layout.

## Development

Requires Node 22+ (validated with 24.19.0). Each Codex cloud task is already isolated; use this
checkout rather than creating a worktree.

```sh
cd /workspace/summit
npm ci --ignore-scripts --no-audit --no-fund --cache /workspace/.npm-cache
npm test
npm run build
npm run dev
```

For a functional provider-backed application, configure a Supabase development project and copy
`.env.example` to the ignored `.dev.vars`, then fill values securely. Never commit this file.
Without provider configuration the frontend starts, but data APIs explicitly report unavailable
services. The test suite works without credentials using PostgreSQL/PGlite and explicit provider
test doubles; these doubles are not present in the development or production API.

```sh
npm run test:browser  # requires Chromium; optionally set CHROMIUM_PATH
```

The browser suite starts its own temporary HTTP server, real PostgreSQL/PGlite database and
provider test doubles. Its published records are explicitly test fixtures, never production seed data.
For optional concurrency validation against PostgreSQL 17, see `docs/TESTING.md`.

## Deliverables

- `index.html`, `bootstrap.js`, `stage1.*`, `stage2.*`: integrated static frontend.
- `backend/api.js`, `functions/api/[[path]].js`: secure Cloudflare Pages API.
- `supabase/migrations/202610130001_platform.sql`: schema, access controls and transactional RPC.
- `supabase/storage.sql`, `supabase/rollback.sql`: private storage and reviewed rollback.
- `jobs/`: protected email/reconciliation job scheduler.
- `.env.example`: server configuration template, without secrets.
- `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/API.md`, `docs/TESTING.md`: audit, operations and validation.
- `QA_REPORT.md`: actual Stage 2 results and remaining acceptance gates.

No sample catalog, timetable, speakers or stories are promoted to approved records. Publish
owner-approved content in Supabase; empty listings are intentional until that data exists.
Physical product records are supported but shipping checkout is disabled until fulfillment rules
are configured. Paid registration cancellation requires team review. The promotional community
access offer is disabled. No deployment, external customer email or live payment has been initiated.

See `docs/DEPLOYMENT.md` for required provider configuration and hosted acceptance testing.
Stage 2 cannot be considered operationally complete until those provider-backed checks pass.
