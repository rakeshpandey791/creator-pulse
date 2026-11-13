# REL-02 backup, restore and operations runbook

This runbook protects CreatorPulse before production data is accepted. MongoDB
is the system of record. Redis contains queues, rate limits and cache state;
its snapshot is retained for recovery evidence, but queue jobs are replayed
from durable operation/source records rather than treating Redis as the source
of truth.

## Backup policy

Run an encrypted MongoDB logical backup daily and before every migration or
release. Keep seven daily copies, four weekly copies and three monthly copies
in a separate account or bucket with object versioning and deletion protection.
Use customer-managed KMS encryption for the storage location and restrict
backup read/delete access to the release operator and recovery role. Never put
`MONGODB_URI`, Redis credentials, encryption keys or raw provider payloads in a
backup manifest or CI log.

Create and verify a local backup with:

```sh
BACKUP_ENCRYPTION_KEY="$BACKUP_KEY" npm run backup:create
BACKUP_ENCRYPTION_KEY="$BACKUP_KEY" npm run backup:verify
```

The utility encrypts MongoDB and Redis artifacts with AES-256-GCM and records
only checksums and metadata in `manifest.json`. Store `BACKUP_ENCRYPTION_KEY`
in the deployment secret manager, not in `.env` or the repository.

## Restore drill

At least monthly, restore the newest backup into an isolated MongoDB database
or temporary Compose project. Do not restore over production. Use:

```sh
BACKUP_ENCRYPTION_KEY="$BACKUP_KEY" npm run backup:verify
BACKUP_ENCRYPTION_KEY="$BACKUP_KEY" npm run backup:restore-mongo
npm run test:db
```

The restore is successful only when validators, indexes, reference seeds,
unique constraints and seed counts pass. Record the backup timestamp, restore
duration, artifact checksums, migration version and operator in the recovery
evidence. Redis restoration is performed during a maintenance window by
replacing the disposable Redis data directory; queued work is then reconciled
using the procedure below.

## Migration and forward recovery

1. Confirm the release is backward-compatible with the deployed API and take a
   verified backup.
2. Run `npm run db:migrate` against the target database and capture the output.
3. Run `npm run db:seed` only for idempotent reference/demo data where required.
4. Run the integrity suite and health checks before routing traffic.
5. If the application image must be rolled back, keep the migration in place
   and deploy the previous image only when its schema contract remains valid.
   Use a forward migration for incompatible changes; never run an unreviewed
   destructive down migration against production.

## Queue replay and reconciliation

After Redis loss or a worker outage, inspect BullMQ waiting, active, failed and
delayed jobs. Recreate only deterministic job IDs, replay research jobs with
their original `jobId`, and let ingestion idempotency prevent duplicate source
documents/signals. For generation jobs, compare `ai_operations` with the
durable asset and credit-ledger records; retry only queued/failed operations,
settle successful operations once, and release/refund abandoned reservations.
Record skipped, replayed and reconciled job IDs in the incident evidence.

## Retention and deletion

- Expired sessions and password-reset records use TTL indexes.
- Source documents and ideas follow their `expiresAt`/retention policy; retain
  provenance metadata when the source text is removed.
- Audit logs and credit ledger entries are retained for operational and billing
  obligations; restrict access rather than deleting them during routine cleanup.
- A creator deletion request soft-deletes or anonymizes creator-owned profiles,
  saves, feedback and assets, removes associated embeddings, and revokes active
  sessions. Verify no password hash, refresh token or provider payload remains
  in exported data.

## Provider outage

Set provider mode to `mock`/disabled or pause the affected queue, keep existing
research evidence available, and show a safe retry state. Do not publish
partial or unsafe generated output. Reconcile in-flight operations and release
or refund credits exactly once. Resume the queue only after provider health,
quota and safety checks pass; record the outage window and affected operation
IDs.

## Incident response

Declare an incident for data loss, suspected credential exposure, repeated
credit inconsistency, unsafe output, or database/Redis unavailability. Preserve
logs and request/operation IDs, restrict access, rotate exposed credentials,
pause publishing/generation when needed, restore into isolation first, and
document customer impact and recovery evidence. The release owner signs off
the restore result before traffic is returned.
