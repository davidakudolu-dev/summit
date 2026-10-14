# Stage 3 validation report — 14 October 2026

**72 local checks passed: 44 backend tests, 13 public-browser checks, 8 admin-browser checks,
6 PostgreSQL concurrency checks and one isolated encrypted recovery drill.** These are separate
runners, not one 72-test framework suite. Final runs have no failed/skipped/disabled or expected
failures. Syntax/static build, Cloudflare worker compilation and development startup smoke passed.
The npm production and full development advisory audits both reported zero vulnerabilities.

## Backend and security

The actual two migrations/RPCs run on PostgreSQL/PGlite; API handlers use explicit provider doubles.
Coverage preserves Stage 2 account/cart/payment/download/event/community/form flows while adding
MFA/RBAC, direct-client denial, role/session revocation, suspension and last-super-admin protection.
Administrative simulations cover product price/history/archive, approved asset publication, verified
reconciliation/read-only finance, stories/revisions/visibility, schedule notices/cancellation,
moderation/private reports, inquiry notes, subscriber unsubscribe, structured settings/legal gates,
analytics, immutable audits, CSV escaping and scanner failures. Crypto tests verify tamper/hash and
isolated-target guards. New checks verify atomic settings rollback/missing sensitive confirmations
and retention-approved identity deletion with preserved financial/history relationships.

The final regression fixed a missing-confirmation SQL NULL comparison bypass and a verification
link routing race. Recovery now retains permission ACLs rather than discarding them. Ordinary
clients remain denied after restore; service RPC access succeeds. Logs and output never include
real credential values.

## Browser simulations

Public browser checks cover navigation/details, guest purchase/cart refresh/paid file access,
article deep links/XSS escaping, login/profile/session/recovery, schedule/calendar/registration,
community join/post/comment/edit/report, inquiry references, newsletter consent/confirmation/
unsubscribe, search, desktop/mobile layout, honest backend-outage feedback and signup/recovery
link completion. No uncaught JavaScript errors were recorded.

Admin checks cover password/TOTP gating, real database overview, product NGN/draft changes,
story preview/publish/archive, inquiry workflow, structured hero settings and layout/dialogs from
320 to 1920 pixels. Axe admin/home scans have no serious/critical violations. This is automated
coverage, not a complete human accessibility assessment. Original ten images and stage1.css
were compared with the supplied ZIP and are byte-identical.

## Real PostgreSQL concurrency and recovery

PostgreSQL 17 runs in an owned disposable Docker container with no published ports. Tests applied
both migrations and exercised 12 simultaneous registrations (one confirmed/11 waitlisted), waitlist
cancellation, 12 checkout retries, 12 payment callbacks, newsletter deduplication and parallel
outbox claims. There was no overselling/duplicate fulfillment in these simulations.

An actual pg_dump was encrypted, hashed, decrypted and restored into a different database. User,
profile, order, item, payment, entitlement, registration and immutable audit counts matched; paid
relationships, restored permission boundaries/service RPC and fixture file bytes were verified.
This test did not upload a remote backup, restore hosted Supabase Auth/Storage or prove production
recovery objectives. Those remain required hosted operator drills.

## Performance and operational scope

Final Lighthouse lab scores: mobile performance 97; desktop 78; accessibility, best practices and
SEO 100 for both. Desktop LCP 2.7s/TBT 90ms indicates remaining performance work. See
[performance report](docs/PERFORMANCE.md) and its raw HTML evidence. These local measurements
cannot establish actual provider latency or field Core Web Vitals.

The restarted development server returns the public/admin/static assets correctly and rejects
configuration/backend/migration file reads. Health accurately returns configured:false because
required provider variables are absent. Static/admin shells are available; real application data,
sign-in, payment and messaging remain unavailable until configuration is supplied.

## Unrun external gates and known limits

Hosted Auth/email/MFA/deletion, Paystack test merchant/webhook/refund, scanner, private file
Storage, independent monitoring, remote encrypted backup and hosted restore acceptance remain
unrun. No real campaign, public deployment or live payment was enabled. No owner policies,
retention period, production domain or initial administrator identity were invented.

All unresolved launch requirements and implementation limits are recorded in
[launch checklist](docs/LAUNCH_CHECKLIST.md), [admin manual](docs/ADMIN_MANUAL.md),
[security review](docs/SECURITY_REVIEW.md) and [deployment/rollback](docs/DEPLOYMENT.md).
Original Stage 1/2 reports are preserved under docs/stage1 and docs/stage2.
