-- בלי מאגרים מובנים: מוחקים את המאגרים הריקים שנוצרו אוטומטית,
-- ומשאירים את השאלות הקיימות במאגר אחד בשם ניטרלי (אפשר לשנות בניהול).
DELETE FROM banks WHERE name IN ('נועז', 'מרחיקי לכת') AND NOT EXISTS (SELECT 1 FROM bank WHERE bank.bank_id = banks.id);
UPDATE banks SET name = 'מאגר ראשי', description = '', icon = '📚' WHERE name = 'סולידי';
-- הנושאים שהמערכת שייכה אוטומטית לשאלות ברירת המחדל – מתאפסים
UPDATE bank SET topic = NULL WHERE topic IN ('אופי', 'הרגלים', 'כישרונות', 'טעמים');
