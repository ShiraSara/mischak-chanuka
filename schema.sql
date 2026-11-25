CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,
  label TEXT,
  created_at INTEGER,
  expires_at INTEGER,          -- NULL = ללא תפוגה
  max_games INTEGER,           -- NULL = ללא הגבלה
  games_used INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  questions TEXT,              -- JSON: מאגר השאלות האישי של הלקוחה (NULL = מאגר ברירת המחדל)
  ai_used INTEGER DEFAULT 0,   -- כמה קריאות תמונה נוצלו החודש
  ai_month TEXT,               -- החודש של המונה (YYYY-MM)
  ai_limit INTEGER,            -- מגבלה חודשית (NULL = ברירת המחדל)
  max_players INTEGER          -- מגבלת משתתפות במשחק (NULL = 15)
);
CREATE TABLE IF NOT EXISTS banks (     -- מאגרי שאלות (סולידי / נועז / ...)
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS bank (      -- השאלות במאגרים
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'names',   -- names | options
  options TEXT,                         -- JSON array: תשובות קבועות / תשובות נוספות לשמות
  sort INTEGER DEFAULT 0,
  bank_id INTEGER,
  topic TEXT,
  timer_sec INTEGER,                    -- טיימר לשאלה (NULL = לפי הגדרות המשחק)
  results_sec INTEGER                   -- זמן תוצאות לשאלה (NULL = לפי הגדרות המשחק)
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  pin TEXT NOT NULL,
  created_at INTEGER,
  updated_at INTEGER,
  status TEXT DEFAULT 'lobby',     -- lobby | live | ended
  q_index INTEGER DEFAULT -1,
  phase TEXT DEFAULT 'lobby',      -- lobby | question | results | ended
  q_started_at INTEGER,
  paused_at INTEGER,           -- עצירה באמצע שאלה: הטיימר קפוא מהרגע הזה
  settings TEXT,                   -- JSON
  questions TEXT,                  -- JSON
  profiles TEXT                    -- JSON: סיכום אישי לכל משתתפת (נוצר בסוף המשחק)
);
CREATE TABLE IF NOT EXISTS players (
  game_id INTEGER NOT NULL,
  num INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  last_seen INTEGER,
  PRIMARY KEY (game_id, num)
);
CREATE INDEX IF NOT EXISTS players_phone ON players(phone);
CREATE TABLE IF NOT EXISTS calls (
  call_id TEXT PRIMARY KEY,
  game_id INTEGER,
  num INTEGER,
  stage TEXT,
  step INTEGER DEFAULT 0,
  last_key TEXT,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS votes (
  game_id INTEGER NOT NULL,
  q_index INTEGER NOT NULL,
  num INTEGER NOT NULL,
  choice INTEGER NOT NULL,
  at INTEGER,
  PRIMARY KEY (game_id, q_index, num)
);
-- מתי התחילה כל שאלה (לחישוב בונוס מהירות)
CREATE TABLE IF NOT EXISTS rounds (
  game_id INTEGER NOT NULL,
  q_index INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  players INTEGER,             -- כמה משתתפות היו כשהשאלה התחילה
  PRIMARY KEY (game_id, q_index)
);
-- סל מחזור לשאלות שנמחקו ממאגר (נשמרות 30 יום)
CREATE TABLE IF NOT EXISTS bank_trash (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bank_id INTEGER,
  q TEXT,              -- JSON של השאלה (נוסח, סוג, תשובות, נושא, זמנים)
  deleted_at INTEGER
);
