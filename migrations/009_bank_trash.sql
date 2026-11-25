-- סל מחזור לשאלות שנמחקו ממאגר (נשמרות 30 יום)
CREATE TABLE IF NOT EXISTS bank_trash (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bank_id INTEGER,
  q TEXT,              -- JSON של השאלה (נוסח, סוג, תשובות, נושא, זמנים)
  deleted_at INTEGER
);
