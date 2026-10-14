# Launch readiness and owner requirements

Local source and validation can be reviewed now. Launch is blocked until the unchecked owner/
external gates below have evidence and explicit public-deployment approval. No hosted demo URL
has been supplied or deployed; the development/test servers use isolated local HTTP origins.

## Verified local release work

- [x] Additive schema, administration, MFA/RBAC and transactional API implementation.
- [x] Products/order history, publishing, events, moderation, support and controlled settings simulations.
- [x] Backend security/transaction regression, public/admin browser and responsive checks.
- [x] PostgreSQL 17 concurrency tests; isolated encrypted restore and post-restore grants/relationships.
- [x] Static build and Cloudflare Pages worker compilation; secret-free configuration templates.
- [x] Actual lab performance/accessibility reports; limits explicitly recorded.
- [x] Admin manual, security review, backup/recovery and deployment/rollback runbooks.
- [x] Original ten artwork files and Stage 1 stylesheet verified byte-identical.

## Owner decisions and access — launch blockers

- [ ] Exact production domain, canonical hostname, DNS/Cloudflare ownership and release approver.
- [ ] Separate approved staging/production Supabase projects and server keys; real hosted preview.
- [ ] First verified owner administrator identity, MFA recovery responsibility and role assignments.
- [ ] Paystack merchant test access and sandbox/webhook acceptance. Live activation is separate work.
- [ ] Verified SMTP/Resend sender, authorized TEAM_INBOX/OPS_INBOX and independent alert destination.
- [ ] Approved real catalog, NGN prices, licensed downloadable assets, event dates/speakers and stories.
- [ ] Owner-supplied and explicitly approved privacy, terms, cookies, refunds, digital delivery,
      community guidelines and event terms. These remain blockers at the user's direction.
- [ ] Owner-approved financial/PII retention, deletion review/purge procedure, purchase-access policy,
      backup retention/lifecycle, recovery point/time objectives and responsible operator.
- [ ] Scanner provider/HTTPS endpoint/secret, private quarantine and real clean/rejected test results.
- [ ] Independent private remote backup bucket/access, key custody and verified hosted staging restore.
- [ ] Required exact service/network hostnames and encrypted secure value entry in environment settings.
- [ ] Reviewed/pushed source release, branch protections, CI evidence and release artifact checksum.

## Hosted acceptance before production approval

- [ ] Every original page/detail URL loads on phones/tablets/desktops; design/content accepted.
- [ ] Real delivered signup/recovery links, MFA enrollment, cookies, role changes and session revocation.
- [ ] Cross-account/RLS denial; revoked/archived/unpublished/private content boundaries.
- [ ] Sandbox success/failure/retry/delayed and duplicate webhook; historical orders and private files.
- [ ] Event concurrency, free/paid capacity, waitlists, schedule-change/cancellation mail and attendance.
- [ ] Community/private membership, reporter privacy and hidden direct-detail responses.
- [ ] Staff content previews/revisions/publication and settings; no exposed deployment secrets.
- [ ] Inquiry delivery and newsletter confirmation/unsubscribe/suppression; real job/outbox recovery.
- [ ] External uptime/job failure alerts; complete database/Storage/secret recovery and measured RPO/RTO.
- [ ] TLS certificate, HTTP-to-HTTPS and canonical-host redirects, complete HSTS policy and security headers.
- [ ] Human keyboard/screen-reader/accessibility acceptance and deployed performance targets agreed.
- [ ] Staging rollback drill, provider payment reconciliation and preservation of audit/customer history.
- [ ] Explicit approval to deploy publicly. Enable indexing only on the accepted production origin.

No credentials should be pasted into chat or included in a downloadable archive. Save them through
secure deployment/environment settings. Saved environment setup instructions do not apply runtime
values or publish a snapshot/site by themselves.
