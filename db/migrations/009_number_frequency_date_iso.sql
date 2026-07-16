-- Normalize number_frequency.last_drawn_date from CAIXA's DD/MM/YYYY format to ISO 8601.
-- Companion to 008_draw_date_iso.sql: the frequency cache table stores dates copied
-- from draws at ingestion time and must follow the same format.
UPDATE number_frequency
SET last_drawn_date = substr(last_drawn_date, 7, 4) || '-' || substr(last_drawn_date, 4, 2) || '-' || substr(last_drawn_date, 1, 2)
WHERE last_drawn_date LIKE '__/__/____';
