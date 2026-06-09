-- ============================================================================
-- 005_log_events.sql
-- Durable structured log events (console + SQLite sink).
--
-- Goals:
-- - Append-only inserts (immutability by convention; no UPDATE/DELETE in app code)
-- - Privacy-first: user identifiers should be hashed upstream when needed
-- - Retention via deleted_at to support purge workflows
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  event TEXT NOT NULL,
  request_id TEXT,
  session_id TEXT,
  user_id TEXT,
  route TEXT,
  user_agent TEXT,
  launch_stage TEXT,
  duration_ms INTEGER,
  status_code INTEGER,
  metadata_json TEXT,
  error_json TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_log_events_timestamp ON log_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_log_events_event ON log_events(event);
CREATE INDEX IF NOT EXISTS idx_log_events_request_id ON log_events(request_id);
CREATE INDEX IF NOT EXISTS idx_log_events_level ON log_events(level);
CREATE INDEX IF NOT EXISTS idx_log_events_active ON log_events(timestamp DESC) WHERE deleted_at IS NULL;
