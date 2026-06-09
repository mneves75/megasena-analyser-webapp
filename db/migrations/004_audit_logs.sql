-- ============================================================================
-- 004_audit_logs.sql
-- Append-only audit trail table for significant actions.
--
-- Goals:
-- - Append-only inserts (immutability by convention; no UPDATE/DELETE in app code)
-- - Privacy-first: store hashed client identifiers (no raw IP), sanitize user agent
-- - Soft delete via deleted_at for retention/compliance workflows
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  event TEXT NOT NULL,
  request_id TEXT,
  route TEXT,
  method TEXT,
  status_code INTEGER,
  success INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER,
  client_id_hash TEXT,
  user_agent TEXT,
  metadata_json TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_route ON audit_logs(route);
CREATE INDEX IF NOT EXISTS idx_audit_logs_active ON audit_logs(timestamp DESC) WHERE deleted_at IS NULL;

