-- קריאת שאלות מתמונה: מונה שימוש חודשי לכל קוד
ALTER TABLE codes ADD COLUMN ai_used INTEGER DEFAULT 0;
ALTER TABLE codes ADD COLUMN ai_month TEXT;
ALTER TABLE codes ADD COLUMN ai_limit INTEGER;
