# 1751 administration

Open `/admin` on the configured site. A blank or unconfigured development environment cannot
authenticate or show business data. No demonstration customers are installed in the application.

## Sign-in and permissions

Use a verified account. Enter your password, enroll the displayed setup key in an authenticator
when prompted, then enter its six-digit TOTP code. Enrollment secrets are shown only during your
own setup. Do not share screenshots of them. Password recovery uses the public Account recovery
form and verified email link. Store the provider's account-recovery procedure with the site owner.

| Role | Permissions |
| --- | --- |
| Super Administrator | All sections, role changes, sandbox refunds, retention and maintenance controls |
| Administrator | Daily operations, content, reports and support; no roles/refund initiation |
| Content Editor | Overview and stories |
| Event Manager | Overview and programmes, sessions, speakers and registrations |
| Store Manager | Overview, products/assets/categories/promotions and order inspection/reconciliation |
| Community Moderator | Overview, communities, memberships, posts and reports |

Navigation follows permissions. Every API operation also checks the verified account, role and
MFA on the server and in the service-only database RPC. Sensitive actions require MFA within the
last 15 minutes: sign in and verify again if prompted. Role changes revoke existing sessions.
The last active Super Administrator cannot be demoted or suspended. There is no automatic staff
assignment from signup. Bootstrap the first owner-controlled account as described in DEPLOYMENT.md.

## Products and orders

Products → select Products, Categories, Product assets or Promotions. Search/filter, choose New
or Edit, and save a draft first. Prices in the editor use NGN; storage uses integer kobo. Upload
licensed product artwork through its image field. Supported images are JPEG, PNG and WebP up to
4 MiB; prepare appropriately sized artwork before upload.

For digital delivery, upload a PDF/ZIP up to 8 MiB through Product assets. Files stay quarantined
unless the configured scanner verifies the exact bytes as clean. Review the scan result, attach
the approved file path to the correct product, and set its optional download limit. A digital
product cannot publish without an approved asset. Existing Stage 2 assets are retained for
compatibility and need an operator's migration review. SVG/executable uploads are rejected.

Publish only approved descriptions/prices/assets. Feature through the featured rank or Settings'
published-product choices. Promotions start inactive; deliberately review their percentage,
expiry, minimum and maximum uses before activating them. Archive preserves historical order
items, prices and eligible download access; archived products cannot be republished through Edit.

Orders & Payments lists real records with filters and details. Reconcile asks Paystack for the
authoritative transaction and checks reference, amount, currency and test mode. There is no
manual Paid button. Fulfillment can be reviewed without rewriting financial amounts. A Super
Administrator's explicit refund request starts a provider workflow; uncertainty/pending status
remains until a verified processed refund notification arrives. Live keys are rejected in this
release. Never create a second reference to resolve an uncertain payment before reconciliation.

## Programmes and registrations

Summit & Events contains programmes, sessions, speakers and registrations. Set programme dates
and IANA timezone first; sessions must fit those dates and have consistent start/end times.
Define capacity, closing time, registration availability, location and private meeting link.
Publish approved programmes and sessions. Editing schedules keeps registrations and queues
change notices. Cancellation requires `CANCEL SESSION`, retains records and queues notices.
Check delivery in System Health; a queued notice is not proof of receipt.

Filter Registrations by session, status and dates. Check in confirmed attendees using their
registration reference, and use permitted CSV export. Capacity cannot fall below reserved seats.
Free waitlists promote automatically on confirmed-seat cancellation; paid waitlist invitations
and paid cancellations require operator review. Never remove registrations to change a schedule.

## Community, stories and support

Community manages group visibility/joining, membership restrictions, post flags and the report
queue. Review the report, enter a note, and hide content or dismiss the report. Hidden posts and
comments disappear from public detail responses. Reporter identity is omitted from this queue.
Featured/announcement flags are stored and visible to staff; public highlighting is a remaining
presentation refinement. Membership requests beyond open/closed self-joining need a future
owner-defined approval policy.

Stories & Content supports drafts, plain-text content, author, category, image upload, slug,
excerpt, reading time, preview and revision history. Publish explicitly. A future publication
timestamp schedules visibility; records remain hidden until that time. Preview is staff-only.
Archive retains revisions and hides the public URL. HTML in article bodies is displayed as text.

Inquiries supports search, status, assignment, notes and follow-up. Internal notes are private.
Newsletter shows pending/confirmed/unsubscribed records. Unsubscribe is permanent until the
subscriber follows a fresh consent/confirmation flow; staff cannot force resubscription.
This release sends transactional messages and consent confirmations, with no campaign sender.

Users & Permissions shows permitted account/history information. Suspension and session
revocation take effect on subsequent requests. Review deletion requests only against approved
privacy and retention rules. Completion requires `DELETE ACCOUNT`, a documented review note,
an existing request, approved retention settings/privacy policy, and no remaining staff roles.
The server deletes the verified Auth identity, preserves financial records and historical
registrations/discussions, masks registration contact details, and revokes purchase access if
required by the approved policy. Financial/contact retention and eventual purging need a
separately documented owner-approved operating procedure; this release does not invent one.

## Settings, reports and health

Settings provides structured fields for hero text/images, controlled ecosystem descriptions,
contact/social/footer links, featured content, site name/logo and announcements. Empty overrides
restore the default content. Save applies changed fields atomically. Credentials are deployment
secrets and are never settings fields. Policy text must come from responsible business/legal
personnel; approval is an explicit action. Unapproved legal URLs return an honest pending notice.

Analytics uses Africa/Lagos dates. Gross payments sum verified receipts by payment time; refunds
are separately processed refund amounts. Neither failed nor pending payments count as revenue.
No measured visitor/conversion/article-engagement source exists, so these values are unavailable.
Charts summarize actual data. Customer dashboards return the latest 100 orders; exports are
bounded to 5,000 rows and selection lists to the first 100 options. Split large date ranges and
use a reviewed operational export for larger datasets.

Security & System Health shows redacted incidents, integration presence, job runs and backup/
restore freshness. Presence is not provider verification. A backup older than 26 hours or no
verified restore in 30 days raises an alert; review email backlog and unresolved incidents too.
Retry failed outbox records after fixing delivery. Resolving an incident records an audited
acknowledgment; it does not repair the underlying service.

On mobile, open the menu to choose a section and scroll tables horizontally. Dialogs support
keyboard focus and Escape. Use the same explicit confirmations on every screen size.
