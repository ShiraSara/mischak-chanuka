import { useCallback, useEffect, useState } from 'react';
import { adminApi } from './adminApi.js';
import { withId } from '../lib/api.js';

const NO_TOPIC = 'כללי';
const topicOf = (q) => (q.topic || '').trim() || NO_TOPIC;

// ניהול מאגרי השאלות: מאגרים, נושאים ושאלות
export default function BankPanel({ pw }) {
  const [banks, setBanks] = useState([]);
  const [sel, setSel] = useState(null);
  const [qs, setQs] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');

  const loadBanks = useCallback(async () => {
    const r = await adminApi('/api/admin/banks', pw);
    setBanks(r.banks);
    return r.banks;
  }, [pw]);

  const open = async (id) => {
    if (dirty && !confirm('יש שינויים שלא נשמרו. לעבור בכל זאת?')) return;
    setSel(id);
    setMsg('');
    setDirty(false);
    const r = await adminApi(`/api/admin/banks/${id}/questions`, pw);
    setQs(r.questions.map((q) => withId(q)));
  };

  useEffect(() => {
    loadBanks().then((b) => b[0] && open(b[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadBanks]);

  const bank = banks.find((b) => b.id === sel);
  const change = (list) => {
    setQs(list);
    setDirty(true);
    setMsg('');
  };
  const update = (id, patch) => change(qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const addQuestion = (topic = '') => {
    const q = withId({ text: '', type: 'names', options: [], topic: topic === NO_TOPIC ? '' : topic, isNew: true });
    const last = qs.map(topicOf).lastIndexOf(topic || NO_TOPIC);
    change(last < 0 ? [...qs, q] : [...qs.slice(0, last + 1), q, ...qs.slice(last + 1)]);
  };
  const addTopic = () => {
    const name = prompt('שם הנושא החדש:');
    if (name?.trim()) change([...qs, withId({ text: '', type: 'names', options: [], topic: name.trim(), isNew: true })]);
  };
  const renameTopic = (t) => {
    const name = prompt('שם חדש לנושא:', t === NO_TOPIC ? '' : t);
    if (name == null) return;
    change(qs.map((q) => (topicOf(q) === t ? { ...q, topic: name.trim() } : q)));
  };
  const move = (id, dir) => {
    const i = qs.findIndex((q) => q.id === id);
    const j = i + dir;
    if (j < 0 || j >= qs.length || topicOf(qs[j]) !== topicOf(qs[i])) return;
    const next = [...qs];
    [next[i], next[j]] = [next[j], next[i]];
    change(next);
  };

  const save = async () => {
    const bad = qs.find((q) => q.text.trim() && q.type === 'options' && q.options.length < 2);
    if (bad) return setMsg(`⚠️ בשאלה "${bad.text}" צריך לפחות 2 תשובות`);
    const r = await adminApi(`/api/admin/banks/${sel}/questions`, pw, 'PUT', { questions: qs.filter((q) => q.text.trim()) });
    setQs(r.questions.map((q) => withId(q)));
    setDirty(false);
    setMsg(`✓ נשמרו ${r.questions.length} שאלות`);
    loadBanks();
  };

  const newBank = async () => {
    const name = prompt('שם המאגר החדש (למשל: נועז):');
    if (!name?.trim()) return;
    const r = await adminApi('/api/admin/banks', pw, 'POST', { name: name.trim(), icon: '📚' });
    await loadBanks();
    setDirty(false);
    open(r.id);
  };
  const patchBank = async (patch) => {
    await adminApi(`/api/admin/banks/${sel}`, pw, 'PATCH', patch);
    loadBanks();
  };
  const deleteBank = async () => {
    if (!confirm(`למחוק את המאגר "${bank.name}" וכל השאלות שבו?`)) return;
    await adminApi(`/api/admin/banks/${sel}`, pw, 'DELETE');
    setDirty(false);
    const b = await loadBanks();
    if (b[0]) open(b[0].id);
  };

  const topics = [...new Set(qs.map(topicOf))];

  return (
    <div className="su-card">
      <div className="su-card-head">
        <div>
          <h2>📚 מאגרי שאלות</h2>
          <p>כל מאגר עם השאלות שלו, מחולק לנושאים. הלקוחות בוחרות מאגר במסך הכנת המשחק.</p>
        </div>
      </div>

      {!banks.length && <div className="note" style={{ marginBottom: 14 }}>עוד אין מאגרים. לוחצים "מאגר חדש", נותנים לו שם – והוא נפתח עם 2 שאלות לדוגמה.</div>}
      <div className="bank-pick">
        {banks.map((b) => (
          <button key={b.id} className={`bank-card ${b.id === sel ? 'on' : ''} ${b.active ? '' : 'off'}`} onClick={() => open(b.id)}>
            <span className="ic">{b.icon || '📚'}</span>
            <b>{b.name}</b>
            <small>{b.description}</small>
            <span className="cnt">
              {b.count} שאלות{b.active ? '' : ' · מוסתר'}
            </span>
          </button>
        ))}
        <button className="bank-card add" onClick={newBank}>
          <span className="ic">➕</span>
          <b>מאגר חדש</b>
        </button>
      </div>

      {bank && (
        <>
          <div className="bank-meta">
            <label>
              אייקון
              <input type="text" defaultValue={bank.icon} key={'i' + bank.id} maxLength={4} style={{ width: 70, textAlign: 'center' }} onBlur={(e) => patchBank({ icon: e.target.value })} />
            </label>
            <label className="grow">
              שם המאגר
              <input type="text" defaultValue={bank.name} key={'n' + bank.id} onBlur={(e) => e.target.value.trim() && patchBank({ name: e.target.value })} />
            </label>
            <label style={{ flex: 2 }}>
              תיאור קצר (מוצג ללקוחות)
              <input type="text" defaultValue={bank.description} key={'d' + bank.id} onBlur={(e) => patchBank({ description: e.target.value })} />
            </label>
            <div className="row" style={{ alignSelf: 'end' }}>
              <button className="btn small" onClick={() => patchBank({ active: !bank.active })}>
                {bank.active ? '🙈 הסתרה מלקוחות' : '👁️ הצגה ללקוחות'}
              </button>
              <button className="btn small danger" onClick={deleteBank}>
                מחיקת מאגר
              </button>
            </div>
          </div>

          <datalist id="admin-topics">
            {topics.filter((t) => t !== NO_TOPIC).map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>

          <div className="admin-qs">
            {topics.map((t) => (
              <section key={t} className="topic-group">
                <div className="topic-head">
                  <b>📂 {t}</b>
                  <span className="muted">{qs.filter((q) => topicOf(q) === t).length} שאלות</span>
                  <button className="btn small ghost" onClick={() => renameTopic(t)}>
                    ✏️ שינוי שם
                  </button>
                  <span className="grow" />
                  <button className="btn small" onClick={() => addQuestion(t)}>
                    + שאלה בנושא
                  </button>
                </div>
                {qs
                  .filter((q) => topicOf(q) === t)
                  .map((q) => (
                    <AdminQuestion
                      key={q.id}
                      q={q}
                      onChange={(patch) => update(q.id, patch)}
                      onRemove={() => change(qs.filter((x) => x.id !== q.id))}
                      onMove={(d) => move(q.id, d)}
                    />
                  ))}
              </section>
            ))}
            {!qs.length && <div className="su-empty">המאגר ריק. מוסיפים נושא ושאלות 👇</div>}
          </div>

          <div className="admin-save">
            <button className="btn" onClick={addTopic}>
              + נושא חדש
            </button>
            <button className="btn" onClick={() => addQuestion()}>
              + שאלה
            </button>
            <span className="grow" />
            {msg && <span className="muted">{msg}</span>}
            {dirty && <span className="su-warn">יש שינויים שלא נשמרו</span>}
            <button className="btn primary big" onClick={save} disabled={!dirty}>
              💾 שמירת המאגר
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// שאלה אחת: נוסח, סוג, תשובות (כל תשובה בנפרד), נושא
function AdminQuestion({ q, onChange, onRemove, onMove }) {
  const [draft, setDraft] = useState('');
  const addAnswer = () => {
    const v = draft.trim();
    if (!v) return;
    onChange({ options: [...q.options, v] });
    setDraft('');
  };
  const setType = (type) => onChange({ type, options: type === 'options' ? (q.options.length ? q.options : ['כן', 'לא']) : [] });

  return (
    <div className="aq">
      <div className="aq-move">
        <button title="למעלה" onClick={() => onMove(-1)}>▲</button>
        <button title="למטה" onClick={() => onMove(1)}>▼</button>
      </div>
      <div className="aq-body">
        <input className="aq-text" type="text" value={q.text} placeholder="נוסח השאלה…" autoFocus={q.isNew} onChange={(e) => onChange({ text: e.target.value, isNew: false })} />
        <div className="aq-row">
          <div className="su-seg aq-type">
            <button className={q.type === 'names' ? 'on' : ''} onClick={() => setType('names')}>
              👥 שמות המשתתפות
            </button>
            <button className={q.type === 'options' ? 'on' : ''} onClick={() => setType('options')}>
              🔘 תשובות קבועות
            </button>
          </div>
          <input
            className="su-topic-input"
            type="text"
            list="admin-topics"
            value={q.topic || ''}
            placeholder="📂 נושא"
            onChange={(e) => onChange({ topic: e.target.value })}
          />
        </div>
        <div className="aq-answers">
          <span className="muted">{q.type === 'names' ? 'תשובות נוספות מעבר לשמות (לא חובה):' : 'התשובות:'}</span>
          {q.options.map((o, i) => (
            <span className={`su-chip ${q.type === 'names' ? 'extra' : ''}`} key={i}>
              {q.type === 'options' && <b>{i + 1}</b>}
              <input
                className="aq-answer"
                value={o}
                size={Math.max(4, o.length)}
                onChange={(e) => onChange({ options: q.options.map((x, j) => (j === i ? e.target.value : x)) })}
              />
              <button title="הסרה" onClick={() => onChange({ options: q.options.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </span>
          ))}
          <input
            className="su-chip-input"
            type="text"
            value={draft}
            placeholder={q.type === 'names' ? '+ למשל "אף אחת"' : '+ תשובה (Enter)'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAnswer())}
            onBlur={addAnswer}
          />
        </div>
      </div>
      <button className="su-x" title="מחיקת השאלה" onClick={onRemove}>
        🗑️
      </button>
    </div>
  );
}
