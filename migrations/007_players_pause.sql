-- מגבלת משתתפות לכל קוד (NULL = ברירת המחדל, 15)
ALTER TABLE codes ADD COLUMN max_players INTEGER;
-- כמה משתתפות היו כשהשאלה התחילה (כדי שמספרי התשובות לא יזוזו כשמוסיפים משתתפת באמצע)
ALTER TABLE rounds ADD COLUMN players INTEGER;
