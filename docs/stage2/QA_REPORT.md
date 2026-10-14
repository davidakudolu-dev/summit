# Stage 2 validation report — 2026-10-13

**45 local checks passed: 26 backend tests, 13 browser checks, 6 PostgreSQL concurrency checks.**
No failed, skipped, disabled or expected-failure checks remain in those runs. Build and JavaScript
syntax checks also passed. This is local implementation validation, not provider-backed acceptance.

## Backend integration — 26 passed

The actual schema/RPC migration runs on PostgreSQL/PGlite. Tests invoke the production handler
with explicit doubles for external Auth, Paystack, email and Storage. Coverage includes:

- Public catalog/filtering/search/detail and draft exclusion; published editorial content.
- RLS and revoked direct client/RPC access; membership/author/moderator boundaries.
- Signup, verification requirement, login, refresh, HttpOnly session persistence, profile,
  recovery/password change, logout and durable deletion requests.
- Account carts; checkout price recalculation, unavailable-item rollback, idempotency and discounts.
- Independently verified payments, amount/currency/test-mode mismatch rejection, webhook signature
  validation/replay, one-time fulfillment, private downloads and full refund access revocation.
- Declined/cancelled payment behavior and same-order retry; explicit live-key rejection.
- Free/paid registration, capacity, waitlists, duplicate prevention, private meeting links and attendance.
- Community membership, posts/comments, author changes, private reports and moderation.
- Inquiry consent/spam trap/deduplication/outbox and newsletter opt-in/expiry/unsubscribe persistence.
- Rate-limit separation, initialization outage recovery, file-signing failure rollback,
  email retry, production error redaction and schema rollback preserving Auth identities.
- Actual paid orders, entitlements, profiles and carts survive database close/reopen.

## Browser integration — 13 passed

Chromium runs against a local HTTP server, the production handler and PostgreSQL/PGlite. Provider
responses are controlled test doubles; no external email or payment is sent. Checks cover original
navigation/product dialogs; guest cart refresh/checkout/download entitlement; article deep-link
refresh/XSS escaping; login/profile across independent browser contexts; five-day schedule/calendar/
registration; community posting/comment/edit/report; inquiry references; newsletter confirmation/
unsubscribe; global search; layout at 375, 768 and 1440 pixels across all five original pages plus
Account; logout/error feedback; signup verification/recovery forms; no uncaught JavaScript errors.
Screenshots and machine-readable results are in ignored `test-results/`.

## PostgreSQL concurrency — 6 passed

PostgreSQL 17 ran in a disposable Docker container with multiple simultaneous connections.

1. Twelve competing registrations for one seat yielded one confirmed user and eleven waitlisted.
2. Cancelling a waitlist entry did not allocate an extra confirmed seat.
3. Twelve simultaneous duplicate checkouts created exactly one order.
4. Twelve payment callbacks created one payment, entitlement and receipt notification.
5. Twelve newsletter requests created one subscription and one confirmation notification.
6. Parallel outbox workers claimed disjoint batches.

The concurrency setup was rerun successfully, then the owned test container was removed.

## Current machine and saved configuration

Frozen installation and build succeeded. The ordinary development server starts and serves the
frontend; internal health explicitly reports `configured:false`. Product APIs return 503 because
provider/signing configuration is absent. Backend source and local environment files return 404
through the static server. The original ten assets and Stage 1 stylesheet match uploaded bytes.

Saved configuration fields: installation script, startup instructions, ten runtime variable
requirements, and API network destinations api.paystack.co/api.resend.com, preserving package
manager presets. The exact Supabase project hostname must be added after the project is selected.
Saving the draft does not inject values, deploy this application or publish an environment snapshot.

## Unrun acceptance and known limits

Real Supabase Auth email verification/recovery, hosted Storage access, Paystack sandbox merchant
transactions/webhooks/refunds, Resend delivery and Cloudflare preview deployment are **unrun**.
Provider credentials, a verified sender/inbox, approved products/events/stories/communities and
licensed private product files are absent. Configure them securely and execute DEPLOYMENT.md's
hosted acceptance gates before declaring Stage 2 operationally complete.

Physical shipping, automatic paid-waitlist invitations, partial refunds, lost initialization-response
recovery for an unpaid terminated Paystack reference, account deletion completion, full history export
and content publishing require the documented administrator workflow or future extension. Legal,
retention and commercial promotion rules need owner approval. Production deployment/live payments
were not authorized and have not been enabled.

The original Stage 1 documentation/QA is retained under `docs/stage1/` as historical evidence.
