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
INSERT INTO banks (id, name, description, icon, sort) SELECT 1, 'סולידי', 'שאלות עדינות שמתאימות לכל חבורה', '🌸', 1 WHERE NOT EXISTS (SELECT 1 FROM banks);
INSERT INTO banks (name, description, icon, sort) SELECT 'נועז', 'לקבוצות שרוצות ללכת רחוק', '🔥', 2 WHERE (SELECT COUNT(*) FROM banks) = 1;
INSERT INTO banks (name, description, icon, sort) SELECT 'מרחיקי לכת', 'רק למי שבאמת מעזה', '🚀', 3 WHERE (SELECT COUNT(*) FROM banks) = 2;
UPDATE bank SET bank_id = 1 WHERE bank_id IS NULL;
