-- טיימר וזמן תוצאות לכל שאלה במאגר (NULL = לפי הגדרות המשחק)
ALTER TABLE bank ADD COLUMN timer_sec INTEGER;
ALTER TABLE bank ADD COLUMN results_sec INTEGER;
