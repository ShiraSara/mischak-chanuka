import { useState } from 'react';
import { api, shuffle, withId } from '../lib/api.js';

// רשימת השאלות: בחירה, עריכה, הוספה, מחיקה ושמירה כמאגר אישי
export default function QuestionsEditor({ questions, setQuestions, custom, setCustom }) {
  const [randomN, setRandomN] = useState(15);
  const [savedMsg, setSavedMsg] = useState('');

  const update = (i, patch) => setQuestions(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const setAll = (on) => setQuestions(questions.map((q) => ({ ...q, on })));
  const pickRandom = () => {
    const n = Math.max(1, Number(randomN) || 10);
    const chosen = new Set(shuffle(questions.map((_, i) => i)).slice(0, n));
    setQuestions(questions.map((q, i) => ({ ...q, on: chosen.has(i) })));
  };
  const add = () => setQuestions([withId({ text: '', type: 'names', options: [], on: true, isNew: true }), ...questions]);
  const remove = (i) => setQuestions(questions.filter((_, j) => j !== i));

  const save = async () => {
    try {
      const r = await api('/api/questions', { method: 'PUT', body: { questions } });
      const onTexts = new Set(questions.filter((q) => q.on).map((q) => q.text.trim()));
      setQuestions(r.questions.map((q) => withId({ ...q, on: onTexts.has(q.text) })));
      setCustom(true);
      setSavedMsg('✓ השאלות נשמרו. בפעם הבאה שתיכנסי עם הקוד הן יופיעו כך.');
    } catch (er) {
      alert(er.message);
    }
  };
  const reset = async () => {
    if (!confirm('להחזיר את מאגר השאלות הכללי? השינויים ששמרת יימחקו.')) return;
    const r = await api('/api/questions', { method: 'DELETE' });
    setQuestions(r.questions.map((q) => withId({ ...q, on: true })));
    setCustom(false);
    setSavedMsg('');
  };

  const onCount = questions.filter((q) => q.on).length;

  return (
    <div className="card">
      <h2>
        <span className="step">2</span>השאלות
      </h2>
      <div className="row q-tools">
        <button className="btn small" onClick={() => setAll(true)}>סימון הכל</button>
        <button className="btn small" onClick={() => setAll(false)}>ביטול הכל</button>
        <button className="btn small" onClick={pickRandom}>בחירה אקראית של</button>
        <input type="number" value={randomN} min="1" style={{ width: 80 }} onChange={(e) => setRandomN(e.target.value)} />
        <button className="btn small" onClick={add}>+ הוספת שאלה</button>
        <span className="grow" />
        <button className="btn small" onClick={save}>שמירת השאלות שלי</button>
        <button className="btn small ghost" onClick={reset}>החזרת מאגר ברירת המחדל</button>
      </div>
      <p className="muted" style={{ margin: '0 0 8px' }}>
        נבחרו {onCount} מתוך {questions.length} שאלות
      </p>
      <div className="q-list">
        {questions.map((q, i) => (
          <QuestionRow key={q.id} q={q} onChange={(patch) => update(i, patch)} onRemove={() => remove(i)} />
        ))}
      </div>
      <p className="muted" style={{ margin: '8px 0 0' }}>
        {savedMsg || (custom ? 'מוצג המאגר האישי ששמרת.' : 'מוצג מאגר השאלות הכללי.')}
      </p>
    </div>
  );
}

function QuestionRow({ q, onChange, onRemove }) {
  // שדה האפשרויות נשמר כטקסט חופשי בזמן ההקלדה, ומפוצל לפי פסיקים
  const [optText, setOptText] = useState(q.options.join(', '));

  const setType = (type) => {
    const options = type === 'options' && !q.options.length ? ['כן', 'לא'] : q.options;
    setOptText(options.join(', '));
    onChange({ type, options });
  };

  return (
    <div className={`q-item ${q.on ? '' : 'off'}`}>
      <input type="checkbox" checked={q.on} title="לכלול במשחק" onChange={(e) => onChange({ on: e.target.checked })} />
      <div className="q-edit">
        <input type="text" value={q.text} autoFocus={q.isNew} onChange={(e) => onChange({ text: e.target.value, isNew: false })} />
        <div className="row">
          <select value={q.type} style={{ width: 'auto' }} onChange={(e) => setType(e.target.value)}>
            <option value="names">התשובות: שמות המשתתפות</option>
            <option value="options">התשובות: אפשרויות קבועות</option>
          </select>
          {q.type === 'options' && (
            <input
              type="text"
              className="grow"
              style={{ width: 'auto' }}
              value={optText}
              placeholder="אפשרויות מופרדות בפסיק: קפה, תה, שניהם"
              onChange={(e) => {
                setOptText(e.target.value);
                onChange({ options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) });
              }}
            />
          )}
        </div>
      </div>
      <button className="btn small danger" title="מחיקה" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}
