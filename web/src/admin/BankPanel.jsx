import { useEffect, useState } from 'react';
import { adminApi } from './adminApi.js';

const toText = (qs) => qs.map((q) => (q.type === 'options' ? `${q.text} | ${q.options.join(', ')}` : q.text)).join('\n');
const fromText = (t) =>
  t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [text, opts] = l.split('|');
      return opts
        ? { text: text.trim(), type: 'options', options: opts.split(',').map((s) => s.trim()).filter(Boolean) }
        : { text: text.trim(), type: 'names' };
    });

// עריכת מאגר השאלות הכללי – שורה לכל שאלה
export default function BankPanel({ pw }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    adminApi('/api/admin/bank', pw).then((r) => setText(toText(r.questions)));
  }, [pw]);

  const save = async () => {
    try {
      const r = await adminApi('/api/admin/bank', pw, 'PUT', { questions: fromText(text) });
      setText(toText(r.questions));
      setMsg(`✓ נשמרו ${r.questions.length} שאלות`);
    } catch (er) {
      alert(er.message);
    }
  };

  return (
    <div className="card">
      <h2>מאגר השאלות הכללי</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        זה המאגר שכל לקוחה רואה כברירת מחדל. שורה לכל שאלה. לשאלה עם תשובות קבועות (לא שמות) כתבי בסוף:{' '}
        <code>| תשובה1, תשובה2, תשובה3</code>
      </p>
      <textarea rows="20" style={{ fontSize: '1rem', lineHeight: 1.7 }} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={save}>שמירת המאגר</button>
        <span className="muted">{msg}</span>
      </div>
    </div>
  );
}
