-- Reject historical or future draw rows that violate Mega-Sena invariants.
CREATE TABLE draw_integrity_guard (
  ok INTEGER NOT NULL CHECK(ok = 1)
);

INSERT INTO draw_integrity_guard (ok)
SELECT 0
WHERE EXISTS (
  SELECT 1
  FROM draws
  WHERE
    number_1 = number_2 OR number_1 = number_3 OR number_1 = number_4 OR number_1 = number_5 OR number_1 = number_6 OR
    number_2 = number_3 OR number_2 = number_4 OR number_2 = number_5 OR number_2 = number_6 OR
    number_3 = number_4 OR number_3 = number_5 OR number_3 = number_6 OR
    number_4 = number_5 OR number_4 = number_6 OR
    number_5 = number_6
);

DROP TABLE draw_integrity_guard;

CREATE TRIGGER IF NOT EXISTS draws_unique_numbers_insert
BEFORE INSERT ON draws
WHEN
  NEW.number_1 = NEW.number_2 OR NEW.number_1 = NEW.number_3 OR NEW.number_1 = NEW.number_4 OR NEW.number_1 = NEW.number_5 OR NEW.number_1 = NEW.number_6 OR
  NEW.number_2 = NEW.number_3 OR NEW.number_2 = NEW.number_4 OR NEW.number_2 = NEW.number_5 OR NEW.number_2 = NEW.number_6 OR
  NEW.number_3 = NEW.number_4 OR NEW.number_3 = NEW.number_5 OR NEW.number_3 = NEW.number_6 OR
  NEW.number_4 = NEW.number_5 OR NEW.number_4 = NEW.number_6 OR
  NEW.number_5 = NEW.number_6
BEGIN
  SELECT RAISE(ABORT, 'draw numbers must be unique');
END;

CREATE TRIGGER IF NOT EXISTS draws_unique_numbers_update
BEFORE UPDATE OF number_1, number_2, number_3, number_4, number_5, number_6 ON draws
WHEN
  NEW.number_1 = NEW.number_2 OR NEW.number_1 = NEW.number_3 OR NEW.number_1 = NEW.number_4 OR NEW.number_1 = NEW.number_5 OR NEW.number_1 = NEW.number_6 OR
  NEW.number_2 = NEW.number_3 OR NEW.number_2 = NEW.number_4 OR NEW.number_2 = NEW.number_5 OR NEW.number_2 = NEW.number_6 OR
  NEW.number_3 = NEW.number_4 OR NEW.number_3 = NEW.number_5 OR NEW.number_3 = NEW.number_6 OR
  NEW.number_4 = NEW.number_5 OR NEW.number_4 = NEW.number_6 OR
  NEW.number_5 = NEW.number_6
BEGIN
  SELECT RAISE(ABORT, 'draw numbers must be unique');
END;
