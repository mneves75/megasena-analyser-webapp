-- ============================================================================
-- 006_remove_deleted_at.sql
-- Remove deleted_at from audit_logs and log_events per no-soft-delete exception.
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs_new (
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
  metadata_json TEXT
);

INSERT INTO audit_logs_new (
  id,
  timestamp,
  event,
  request_id,
  route,
  method,
  status_code,
  success,
  duration_ms,
  client_id_hash,
  user_agent,
  metadata_json
)
SELECT
  id,
  timestamp,
  event,
  request_id,
  route,
  method,
  status_code,
  success,
  duration_ms,
  client_id_hash,
  user_agent,
  metadata_json
FROM audit_logs;

DROP TABLE audit_logs;
ALTER TABLE audit_logs_new RENAME TO audit_logs;

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_route ON audit_logs(route);

CREATE TABLE IF NOT EXISTS log_events_new (
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
  error_json TEXT
);

INSERT INTO log_events_new (
  id,
  timestamp,
  level,
  event,
  request_id,
  session_id,
  user_id,
  route,
  user_agent,
  launch_stage,
  duration_ms,
  status_code,
  metadata_json,
  error_json
)
SELECT
  id,
  timestamp,
  level,
  event,
  request_id,
  session_id,
  user_id,
  route,
  user_agent,
  launch_stage,
  duration_ms,
  status_code,
  metadata_json,
  error_json
FROM log_events;

DROP TABLE log_events;
ALTER TABLE log_events_new RENAME TO log_events;

CREATE INDEX IF NOT EXISTS idx_log_events_timestamp ON log_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_log_events_event ON log_events(event);
CREATE INDEX IF NOT EXISTS idx_log_events_request_id ON log_events(request_id);
CREATE INDEX IF NOT EXISTS idx_log_events_level ON log_events(level);
