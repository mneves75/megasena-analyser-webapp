# Project memory

This public file contains durable technical conventions only. Personal information,
account/resource identifiers, operational URLs, server access, deployment receipts,
private telemetry and backup inventories belong in private, untracked storage.

- [AGENTS.md](AGENTS.md) owns architecture, safety and acceptance requirements.
- [README.md](README.md) owns setup and documented commands. Use pnpm for packages
  and Bun for the local API and SQLite tooling.
- The Worker adapter shares API contracts with Bun; the Durable Object owns
  transactional SQLite storage and daily CAIXA ingestion.
- Preserve existing data during migration. Use consistent SQLite snapshots,
  append-only imports, full readback and a verified recovery path.
- Browser acceptance uses Argent. A successful build does not prove deployment,
  public-domain cutover, scheduled ingestion or genuine crawler access.
- Lottery statistics describe past draws; they do not predict future results.
- Deployment procedures belong in [docs/DEPLOY.md](docs/DEPLOY.md). Do not add
  session transcripts or account-specific status to public documentation.
