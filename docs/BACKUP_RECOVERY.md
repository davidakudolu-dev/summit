# Backup and recovery runbook

Production backups remain disabled until the owner approves retention, storage, recipients and
recovery responsibilities. The local recovery test is a separate, disposable PostgreSQL database;
it does not establish an existing hosted backup or successful Supabase Storage restoration.

## Provision and verify

Use a dedicated runner with Node 24 and PostgreSQL 17 tools, trusted TLS roots and reviewed
network access. Supply the names in `backup.env.example` securely. Keep the database connection
and service-role key on the server. Create a private S3-compatible bucket with TLS, least-privilege
credentials, versioning and restricted administrative deletion. Apply an enabled lifecycle rule
with prefix `1751/backups/` and exactly the owner-approved `BACKUP_RETENTION_DAYS`. The runner
checks this rule before copying data. It does not silently choose a retention period.

Create an RSA public/private keypair of at least 3072 bits in an approved key-management process.
Only the public encryption key belongs on the backup runner. Store the private key and its
recovery procedure independently of the hosting/backup account, securely with authorized owners.
Do not commit either key or place private keys in downloadable configuration. Keep deployment
secret values in an independent encrypted secret manager; the backup manifest contains only
nonsecret deployment flags. Rotate keys through a reviewed recovery exercise.

Run `node scripts/backup.mjs`. It dumps public/auth schemas, including ACLs, fetches private
digital products, public site media and quarantine objects, hashes each file, then encrypts the
entire bundle with AES-256-GCM and RSA-OAEP-SHA256 before remote upload. PostgreSQL TLS uses
`verify-full`; custom roots require `PGSSLROOTCERT`. Upload metadata verifies length/checksum.
The script reports a redacted run through the JOB_SECRET-protected endpoint. Independently retain
the artifact key and SHA256 in a trusted operations record; do not trust a checksum supplied
only alongside an untrusted downloaded artifact.

The included GitHub workflow runs at 02:17 Africa/Lagos daily only when `BACKUPS_ENABLED=true`,
using the dedicated `backup` environment's settings. Authorize and test that runner before
enabling it. Copying data is currently bounded to 256 MiB raw content and 10,000 objects; a larger
site requires streaming backups or the provider's supported managed backup solution. Quarantined
objects must remain quarantined after restoration. Database and Storage snapshots are sequential;
for a launch restore drill, pause writes or provide a reconciled provider snapshot so uploaded
files and recorded assets match. Agree recovery point/time targets with the owner.

## Restore into isolated staging

1. Download the encrypted object from the approved private bucket through authenticated tooling.
   Verify its SHA256 against the independent trusted health/operations record.
2. Provision an isolated staging database/project and Storage buckets. Confirm neither database
   nor Storage target is the source. The application must have no real mail/payment credentials.
   Prepare Supabase's managed roles/auth facilities and check provider-supported Auth restore
   constraints with the operator; do not replace a shared managed Auth schema blindly.
3. Supply target `DATABASE_URL`, `SUPABASE_URL`, service key, private-key path and trusted
   `EXPECTED_BACKUP_SHA256`. Set `APP_ENV=staging` and
   `RESTORE_CONFIRMATION=ISOLATED STAGING TARGET`.
4. Run `node scripts/restore.mjs /secure/path/backup.enc`. This deliberately cleans/restores the
   isolated target in one PostgreSQL transaction, preserves grants, verifies GCM/file hashes,
   and restores object bytes. It refuses production/source targets. Operators must still verify
   object delivery, bucket policies and managed Auth behavior; flags cannot establish isolation
   on their own.
5. Check paid orders/items/payments/entitlements, registrations/capacity, profiles, revisions and
   immutable audit relationships. Verify all RLS flags and authenticated/anon denial of tables
   and privileged RPCs. Confirm service-only RPCs still work. Test private signed downloads,
   auth recovery, clean/quarantine separation and the nonsecret deployment manifest. Never
   restore live secrets into a public fixture environment or send restored outbox messages.
6. Record evidence, elapsed time, checksum and operator sign-off. Only then report a verified
   restore using POST `/api/jobs/report` with kind `restore`, status `ok`, verified true and the
   artifact SHA256, authenticated with JOB_SECRET. The restore script never automatically
   declares acceptance merely because pg_restore exited successfully.

## Incident operation

Disable indexing on staging. Preserve incident/audit evidence and stop automated writes that
could worsen corruption. Prefer recovery into a new target and reconcile provider transactions
before switching application credentials. Seek explicit production cutover approval with a
concrete verified result. Prevent replaying customer email outbox entries or duplicating payment
fulfillment during recovery. Rotate exposed credentials and revoke sessions when appropriate.

The monitor alerts for missing/stale encrypted verified backups (26 hours), staging restore
verification (30 days), mail backlog and unresolved incidents. It uses the same transactional
email channel: configure independent external uptime/job failure alerts as a launch gate so
total database/email outages are detectable outside the application.
