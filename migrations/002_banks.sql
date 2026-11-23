-- מאגרי שאלות מרובים, וחלוקה לנושאים
CREATE TABLE IF NOT EXISTS banks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);
ALTER TABLE bank ADD COLUMN bank_id INTEGER;
ALTER TABLE bank ADD COLUMN topic TEXT;
-- שאלות קיימות (מלפני שהיו מאגרים) עוברות למאגר אחד בשם "מאגר ראשי"
INSERT INTO banks (id, name, description, icon, sort) SELECT 1, 'מאגר ראשי', '', '📚', 1 WHERE NOT EXISTS (SELECT 1 FROM banks) AND EXISTS (SELECT 1 FROM bank);
UPDATE bank SET bank_id = 1 WHERE bank_id IS NULL;
