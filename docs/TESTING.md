# Validation scope

`npm test` applies the actual migration to PostgreSQL/PGlite and calls the production API handler.
Auth, Paystack, Resend and Storage are explicit test doubles. These tests verify our transactions,
authorization and API behavior, not actual provider configuration or delivery.

`npm run test:browser` runs Chromium against a temporary HTTP origin with that same handler and
database. It exercises real DOM forms, persistent carts/cookies, navigation and responsive views.
Results/screenshots go to ignored `test-results/`. Provider doubles exist only under tests/.

## PostgreSQL concurrency suite

Docker is optional. This suite uses a dedicated PostgreSQL 17 container with **no published ports**;
trust authentication is confined to the disposable test container. Never target a shared/production
database: the script resets test schemas. The image is pinned to the verified digest used here.

```sh
docker run --detach --rm --name 1751-postgres-tests \
  --env POSTGRES_HOST_AUTH_METHOD=trust \
  postgres@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3
docker exec 1751-postgres-tests pg_isready -U postgres
node tests/concurrency.mjs
docker stop 1751-postgres-tests
```

Wait for pg_isready success. Checks include 12 concurrent registrations into one seat, cancelling
waitlist entries, 12 duplicate checkouts, 12 payment callbacks, 12 newsletter requests and parallel
outbox claims. This validates actual locks with multiple database sessions.

Hosted/provider acceptance gates in DEPLOYMENT.md remain unrun until development accounts/secrets
are supplied. Test addresses end in `.test`; the suites do not send external customer messages.

## Stage 3 administration, accessibility and recovery

`npm run test:admin` adds real DOM TOTP, CMS/product/inquiry/settings, native dialog, responsive
320/375/430/768/1024/1440/1920 checks and Axe on the admin overview/public homepage. It uses
explicit provider doubles and fixture data. `npm run test:performance` produces Lighthouse HTML/
JSON/mobile/desktop summaries; these are local lab measurements, not field Core Web Vitals.

The backend suite applies both migrations by default, including permission/confirmation, file
quarantine, immutable history, retention-gated deletion, atomic settings, SEO and crypto guards.
The original destructive rollback test deliberately uses only the Stage 2 schema.

For the isolated recovery drill, run `npm run test:concurrency` and then `npm run test:recovery`
before stopping the same disposable Docker container described above. Recovery creates only
`1751_restore_test` inside that unpublished container. It encrypts/decrypts a real pg_dump, restores
to a separate database, checks retained records/relationships, denies authenticated table/admin
RPC reads, verifies service-only RPC functionality and reproduces fixture file bytes. It does not
exercise a hosted bucket, Supabase managed Auth restore or remote S3 integrity end-to-end.
