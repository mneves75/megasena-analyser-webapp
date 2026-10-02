# Cloudflare database failure inventory

## Retained-data migration failures

- Export must reject active databases, journal companions, symlink inputs and changing/corrupt snapshots.
- Unknown columns/types or external user_bets foreign keys must stop export.
- Positive source bet IDs map to negative target IDs; unsupported IDs stop export.
- Divergent existing IDs must fail within their individual SQL statement without overwriting the target.
- Query API has no documented transaction across statements; each batch uses one atomic SQL statement and interruption permits full idempotent replay.
- Private records must stay in restrictive local bundle files and authenticated API calls.
- Tampered files, API errors, partial results, missing rows, duplicate rows or changed fields must fail verification.
- Verification covers every imported column and ID, allowing unrelated new destination rows.
- Freeze old-source writes, complete import/readback verification and resolve the final source delta before DNS cutover.

## Retained-data runbook for the integrator

Official contract confirmed against Cloudflare's installed CLI schema and [official OpenAPI](https://github.com/cloudflare/api-schemas/blob/main/openapi.json), `POST /accounts/{account_id}/workers/durable_objects/namespaces/{id}/query/v2`: `queries: [{sql, params}]`, params are string/number/null; response `result.results[]` contains `columns`, `rows`, `meta`, with optional `result.error` even when HTTP succeeds. Query-by-name requires jurisdiction. No cross-query transaction guarantee is documented.

1. Obtain a `VACUUM INTO` snapshot through the authorized private VPS workflow. Transfer only the finished snapshot, named `*.snapshot.sqlite`, without WAL/SHM/journal companions. This agent did not access live retained records.
2. Prepare a new private bundle, preferably on authorized external storage for large production datasets:

   ```bash
   umask 077
   bun run scripts/cloudflare-retained-data.ts prepare /private/snapshot.snapshot.sqlite /private/new-bundle
   ```

   Save the emitted `manifestSha256` and counts independently. Files contain private records and must stay private. Bundle permissions are 0700, files 0600; paths with symlink components are rejected. The source hash and every output-file/record hash are included in the manifest. Source schemas/FKs are checked. Repo search found no callers or external table references for `user_bets`; runtime rejects snapshot FKs involving that table. Its positive source IDs map to negative target IDs by the manifest formula, reserving positive AUTOINCREMENT IDs for new records.
3. After the integrator verifies `cf auth whoami`, the exact destination account/namespace, backup and authorization, apply manifest import files serially:

   ```bash
   cf durable-objects namespaces query <namespace-id> --durable-object-name megasena --jurisdiction none --queries @/private/new-bundle/import-audit_logs-000001.json > /private/responses/response-import-audit_logs-000001.json
   bun run scripts/cloudflare-retained-data.ts check-import /private/new-bundle /private/responses <trusted-manifest-sha256> import-audit_logs-000001.json
   ```

   Run `check-import` immediately for each file and stop on failure. It rejects partial results and query errors in a nominal success envelope. Do not print private response bodies. Each file contains one parametrized `INSERT ... SELECT FROM json_each(?)` statement, so conflicting rows roll back that entire batch; exact repeats do nothing. No existing row is rewritten. Replaying all import files after an interruption is safe, provided any reported divergence is resolved first.
4. Execute every manifest verification file using the same authenticated command, saving output under its manifest `response` filename. Then:

   ```bash
   bun run scripts/cloudflare-retained-data.ts verify /private/new-bundle /private/responses <trusted-manifest-sha256>
   ```

   This checks all columns, IDs and source counts, not merely totals. Unrelated new target rows are allowed. Run `check-import` without the optional filename to check every import receipt. Keep the final verification receipt and original manifest hash privately.
5. A snapshot taken before DNS cutover does not capture subsequent VPS writes. Quiesce the old writer, take the final snapshot/delta, repeat append/verification against that final snapshot, and only then retire the old service. Preserve the rollback snapshot. Conflicting updates to an already imported `user_bets` row fail closed and require explicit reconciliation; this tool never overwrites them.

Batch policy: up to 1,000 rows and 1 MiB of decoded row JSON per statement; rows above 64 KiB require explicit review. Verification IDs use a single JSON binding too. These are tooling limits, not claimed API ceilings; OpenAPI lists no maxItems for queries. For 600,000 typical rows, approximately 600 import plus 600 readback calls, with a few additional table-boundary batches; the byte cap can increase this count. Files comprise payload plus small SQL/manifest overhead, rather than duplicating an SQL template per row. Avoid parallel calls; start at one request per second and measure actual responses. That is about 20 minutes of pacing for 1,200 requests, plus CLI/network/SQL time. On 429 honor Retry-After; on transient transport/5xx failures retry the same idempotent batch at most five times with exponential waits (2, 4, 8, 16, 32 seconds, jitter). Stop after that budget; SQL/data conflicts are never retried automatically. Preserve receipts and resume with the same trusted manifest. Live API limits and real production-volume timing still require staging proof.

Red-first evidence: missing migration module/export, altered trusted manifest, per-batch receipt lookup, rejected larger batch before the new policy, and divergent atomic-batch rollback controls were observed failing before their corrections. `bun run tests/cloudflare/retained-data-runtime.ts` now passes on real Bun SQLite and real workerd with 1,003 synthetic rows, 1,000-row batches, replay/interruption, whole-batch rollback, full-content hashes and API partial-failure controls. Evidence: `.scratch/cloudflare-database/retained-runtime-result.json`.

`bun run tests/cloudflare/database-persistence-runtime.ts` uses exclusive temporary storage, disposes the first Miniflare/workerd process and starts a second against the same directory. It verifies 3,065 fixture draws (one explicitly synthetic), audit/log rows and rate-limit remaining 99→98 survive. The first test failed when legacy Miniflare persistence options were ignored; explicit Miniflare 5 `resourcePersistencePath` fixed the fixture. Evidence: `.scratch/cloudflare-database/persistence-runtime-result.json`.

- An unscoped request must not access another object's database.
- Concurrent asynchronous request scopes must retain their own adapter.
- A failed nested cache rebuild must roll back all draws and caches in its outer transaction.
- SQLite DO storage rejects SQL transaction commands; use transactionSync, never simulated BEGIN.
- Asynchronous transaction callbacks must fail before mutations can commit.
- Migration failure must roll back SQL and its applied-version marker together.
- CAIXA outages, malformed draws, wrong contest numbers and invalid dates must fail without a success status.
- Network waits must occur outside writer transactions.
- Daily ingestion must be bounded, append-only, retryable and idempotent; backlog is explicit incomplete status.
- Concurrent refreshes must share one in-flight refresh per object.
- Public requests must not expose import/refresh RPC administration.
- Seed imports must validate all records, reject conflicts and commit caches atomically.

## Verified evidence

- Tests were introduced before their associated changes. Native Bun regression went red when its transaction factory was mistaken for an adapter hook; fixed with explicit `transactionSync`.
- Workerd initially rejected migration 001's 60-way UNION and eight analytics queries' six-way UNION. Recursive initialization and nested final UNION branches preserve Bun output under DO's five-term limit.
- `bun run tests/cloudflare/database-runtime.ts`: PASS, real workerd SQL, ten migrations, migration rollback, nested draw/cache rollback, eight analytics families, scoped object isolation, validated public seed bootstrap (3,064), duplicate imports, API health with persisted audit/log, bounded alarm retries, and retention during CAIXA outage controls.
- `bun x vitest tests/lib/cloudflare-database.test.ts tests/lib/analytics --run`: 41 passed, 12 skipped (real-SQL-only cases).
- `bun run test:sqlite`: 12 real Bun SQLite delay cases passed.
- `bun x vitest tests/lib/api/caixa-worker-budget.test.ts tests/lib/api/caixa-client.test.ts --run`: 16 passed. Worker uses at most three 10-second requests and two capped 10-second waits per fetch, at most six fetches per refresh (five minutes worst case, plus SQL).
- Focused ESLint and project typecheck passed. Root owns full repository gates and public deployment verification.
- Evidence: `.scratch/cloudflare-database/runtime-result.json` (ignored). Local failure control replaces outbound CAIXA calls; this proves failure handling, not official upstream availability.
