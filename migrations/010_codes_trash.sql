-- סל מחזור לקודים: קוד שנמחק מפסיק לעבוד מיד, ונשמר 30 יום לשחזור
ALTER TABLE codes ADD COLUMN deleted_at INTEGER;
