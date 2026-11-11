-- ============================================================================
-- 011_drop_unread_log_indexes.sql
-- Drop the secondary indexes on audit_logs and log_events that no query reads.
--
-- Every API request writes to both tables, and each index is one more write per
-- row. No query in lib/, cloudflare/, scripts/, server.ts or app/ filters or
-- sorts these tables by event, route, level or request_id (privacy:subject's
-- request_id match is a rare operator scan over at most 30 days of log_events).
-- The timestamp indexes stay: retention deletes by `timestamp < ?`.
-- Rolling back to 1.20.0 is safe: its runners skip migration names they do not
-- list, and its schema checks read columns, not indexes.
-- ============================================================================

DROP INDEX IF EXISTS idx_audit_logs_event;
DROP INDEX IF EXISTS idx_audit_logs_request_id;
DROP INDEX IF EXISTS idx_audit_logs_route;
DROP INDEX IF EXISTS idx_log_events_event;
DROP INDEX IF EXISTS idx_log_events_request_id;
DROP INDEX IF EXISTS idx_log_events_level;
