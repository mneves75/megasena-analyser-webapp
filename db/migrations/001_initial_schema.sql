-- Mega-Sena Draws Table
CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY,
  contest_number INTEGER UNIQUE NOT NULL,
  draw_date TEXT NOT NULL,
  number_1 INTEGER NOT NULL CHECK(number_1 BETWEEN 1 AND 60),
  number_2 INTEGER NOT NULL CHECK(number_2 BETWEEN 1 AND 60),
  number_3 INTEGER NOT NULL CHECK(number_3 BETWEEN 1 AND 60),
  number_4 INTEGER NOT NULL CHECK(number_4 BETWEEN 1 AND 60),
  number_5 INTEGER NOT NULL CHECK(number_5 BETWEEN 1 AND 60),
  number_6 INTEGER NOT NULL CHECK(number_6 BETWEEN 1 AND 60),
  prize_sena REAL,
  winners_sena INTEGER DEFAULT 0,
  prize_quina REAL,
  winners_quina INTEGER DEFAULT 0,
  prize_quadra REAL,
  winners_quadra INTEGER DEFAULT 0,
  total_collection REAL,
  accumulated BOOLEAN DEFAULT 0,
  accumulated_value REAL DEFAULT 0,
  next_estimated_prize REAL,
  special_draw BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_draws_contest_number ON draws(contest_number);
CREATE INDEX idx_draws_draw_date ON draws(draw_date);

-- Number Frequency Cache Table
CREATE TABLE IF NOT EXISTS number_frequency (
  number INTEGER PRIMARY KEY CHECK(number BETWEEN 1 AND 60),
  frequency INTEGER DEFAULT 0,
  last_drawn_contest INTEGER,
  last_drawn_date TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Initialize frequency table with all numbers
INSERT INTO number_frequency (number)
WITH RECURSIVE numbers(value) AS (
  SELECT 1 UNION ALL SELECT value + 1 FROM numbers WHERE value < 60
)
SELECT value FROM numbers WHERE NOT EXISTS (SELECT 1 FROM number_frequency);

-- User Bets Table (for future tracking)
CREATE TABLE IF NOT EXISTS user_bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bet_numbers TEXT NOT NULL,
  bet_date TEXT DEFAULT CURRENT_TIMESTAMP,
  contest_number INTEGER,
  strategy TEXT,
  cost REAL,
  result TEXT,
  hits INTEGER,
  prize_won REAL DEFAULT 0,
  notes TEXT
);

CREATE INDEX idx_user_bets_contest ON user_bets(contest_number);
CREATE INDEX idx_user_bets_date ON user_bets(bet_date);
