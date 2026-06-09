-- Performance Indexes for Number Frequency Queries
-- These indexes significantly improve frequency calculation performance

CREATE INDEX IF NOT EXISTS idx_draws_number_1 ON draws(number_1);
CREATE INDEX IF NOT EXISTS idx_draws_number_2 ON draws(number_2);
CREATE INDEX IF NOT EXISTS idx_draws_number_3 ON draws(number_3);
CREATE INDEX IF NOT EXISTS idx_draws_number_4 ON draws(number_4);
CREATE INDEX IF NOT EXISTS idx_draws_number_5 ON draws(number_5);
CREATE INDEX IF NOT EXISTS idx_draws_number_6 ON draws(number_6);

-- Composite index for accumulated draws queries
CREATE INDEX IF NOT EXISTS idx_draws_accumulated ON draws(accumulated);

-- Index for prize queries
CREATE INDEX IF NOT EXISTS idx_draws_prize_sena ON draws(prize_sena) WHERE prize_sena > 0;
