-- Pair Frequency Cache Table
-- Tracks how often number pairs appear together in the same draw
CREATE TABLE IF NOT EXISTS number_pair_frequency (
  number_1 INTEGER NOT NULL CHECK(number_1 BETWEEN 1 AND 60),
  number_2 INTEGER NOT NULL CHECK(number_2 BETWEEN 1 AND 60 AND number_2 > number_1),
  frequency INTEGER DEFAULT 0,
  last_occurred_contest INTEGER,
  last_occurred_date TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (number_1, number_2)
);

CREATE INDEX idx_pair_frequency ON number_pair_frequency(frequency DESC);
CREATE INDEX idx_pair_last_contest ON number_pair_frequency(last_occurred_contest);

