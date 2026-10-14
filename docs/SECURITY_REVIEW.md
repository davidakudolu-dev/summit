# Stage 3 security review — 14 October 2026

Scope: source/API/RPC/storage configuration, local authorized simulations, compiled Cloudflare
worker and dependency audit. No production system or external provider account was scanned.
This is implementation evidence, not a penetration-test certificate or universal security claim.

| Control | Implementation and exercised evidence |
| --- | --- |
| Authentication | Auth provider validates identity before JWT AAL/AMR claims are used; verified email, HttpOnly SameSite cookies, refresh/logout/recovery |
| Staff access | Six roles; server and service-only RPC enforce explicit permissions; AAL2 required; recent MFA for sensitive operations |
| Privilege changes | Audited changes/revocations; suspended identities denied; last active super-admin safeguard; no signup promotion |
| Request boundaries | Exact Origin + custom request header for browser writes; JSON/content limits, UUID validation, server rate buckets; jobs use separate bearer secret |
| Private information | Direct clients cannot invoke platform/admin RPC or read private tables; role-filtered overview; reporter identity omitted; no browser privileged secrets |
| SQL/content | Entity/field allowlists, bound RPC parameters and validated identifiers; escaped plain-text articles/discussions, safe URLs; CSV formula escaping |
| Payments | Server catalog prices, exact provider verification, signed webhooks, test-domain/live-key rejection, idempotent fulfillment and refunds; no administrative paid override |
| Events | Locked capacity/reservation changes, duplicate prevention, schedule bounds and notifications; cancellation retains registrations |
| Uploads | Staff/MFA before decode; byte/type/size checks, generated keys, no overwrite; PDF/ZIP fail closed into quarantine without matching clean scanner verdict |
| History | Immutable audit/revision evidence; archive preserves order prices/assets/history; deliberate identity deletion preserves financial and historical relationships |
| Recovery | GCM encryption/file hashes; independent trusted artifact checksum; source/production restore guards; ACLs retained; restored client denials and service RPC verified |
| Browser delivery | Allowlisted build/static routes, strict external-script CSP, no-store/noindex private views, nosniff/referrer/frame/form restrictions |
| Operations | Redacted error IDs/codes, protected job reports, mail retries, stale backup/restore and incident monitoring |

Confirmed defects fixed during this work include missing MFA on legacy staff operations,
verification-link replacement by clean routing, nullable confirmation comparisons that allowed
omitted confirmations, and ACL-dropping backup/restore options. Regression checks now exercise
these boundaries. Staff speaker assignments are retained when reopening the session tools.
Original artwork/style bytes are unchanged; accessibility fixes are additive.

The final npm audit reported zero vulnerabilities across production and development dependencies.
There are no third-party production npm dependencies; provider calls use platform Fetch/Web Crypto.
This is the registry advisory result on this date, not a guarantee against undisclosed defects.
Package installation keeps integrity/TLS verification enabled; build tools are development-only.

## Remaining acceptance and operational risks

- Real Supabase SMTP, MFA factors/AMR, managed Auth deletion, PostgREST grants and Storage cross-bucket
  moves need hosted acceptance. Local provider doubles cannot verify provider configuration.
- New downloadable documents remain unavailable until scanner delivery/verdicts are verified.
  Legacy digital files were preserved and need a reviewed asset migration. Image validation is
  bounded type/size validation, not image transcoding or comprehensive antivirus certification.
- Legal approval, financial/PII retention, eventual cleanup, backup lifecycle and key recovery
  remain owner launch gates. No default legal text or arbitrary retention period was approved.
- External uptime/error alerting, real email suppression/deliverability and protected backup runner
  credentials remain unconfigured. In-app alerts depend on the database/email they monitor.
- Full WCAG 2.2 AA verification, human screen-reader assessment and field Core Web Vitals are not
  established by automated Axe/Lighthouse. Review performance/accessibility evidence separately.
- Admin/query/export and backup memory bounds are explicit; confirm approved inventory/volume
  fits them before launch. Advanced member approval workflows and public post highlighting are
  remaining product refinements. Paid waitlist invitations are reviewed manually.
- Keep staging unindexed. Configure and verify canonical-host/HTTPS edge redirects and full HSTS
  coverage only with domain/TLS access. Use independent projects and never run schema-reset tests
  or the original destructive rollback on shared/customer databases.
- This package supports test payments. Live transactions require separate authorization and
  reviewed implementation; hosted test success is not merchant/live-payment acceptance.
