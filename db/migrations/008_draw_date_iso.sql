-- Normalize draw dates from CAIXA's DD/MM/YYYY format to ISO 8601.
UPDATE draws
SET draw_date = substr(draw_date, 7, 4) || '-' || substr(draw_date, 4, 2) || '-' || substr(draw_date, 1, 2)
WHERE draw_date LIKE '__/__/____';
