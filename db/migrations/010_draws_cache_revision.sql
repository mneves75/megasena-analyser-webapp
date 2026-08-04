CREATE TABLE cache_revisions (
  name TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0
);

INSERT INTO cache_revisions (name, revision) VALUES ('draws', 0);

CREATE TRIGGER draws_cache_revision_insert
AFTER INSERT ON draws
BEGIN
  INSERT INTO cache_revisions (name, revision) VALUES ('draws', 1)
  ON CONFLICT(name) DO UPDATE SET revision = revision + 1;
END;

CREATE TRIGGER draws_cache_revision_update
AFTER UPDATE ON draws
BEGIN
  INSERT INTO cache_revisions (name, revision) VALUES ('draws', 1)
  ON CONFLICT(name) DO UPDATE SET revision = revision + 1;
END;

CREATE TRIGGER draws_cache_revision_delete
AFTER DELETE ON draws
BEGIN
  INSERT INTO cache_revisions (name, revision) VALUES ('draws', 1)
  ON CONFLICT(name) DO UPDATE SET revision = revision + 1;
END;
