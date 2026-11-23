import { useState } from 'react';
import { api, shuffle, withId } from '../lib/api.js';
import ImportDialog from './ImportDialog.jsx';
import { FEATURES } from '../lib/features.js';

const NO_TOPIC = 'כללי';
const topicOf = (q) => (q.topic || '').trim() || NO_TOPIC;

// שלב 2: בחירת מאגר, בחירת שאלות לפי נושאים, עריכה והוספה
export default function QuestionsEditor({ questions, setQuestions, banks, bankId, onPickBank, onBanksChanged, ai, setAi }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | on
  const [randomN, setRandomN] = useState(15);
  const [msg, setMsg] = useState('');
  const [importing, setImporting] = useState(false);

  const update = (id, patch) => setQuestions(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const remove = (id) => setQuestions(questions.filter((q) => q.id !== id));
  const setAll = (on, topic) => setQuestions(questions.map((q) => (topic == null || topicOf(q) === topic ? { ...q, on } : q)));
  const pickRandom = () => {
    const n = Math.max(1, Number(randomN) || 10);
    const chosen = new Set(shuffle(questions.map((q) => q.id)).slice(0, n));
    setQuestions(questions.map((q) => ({ ...q, on: chosen.has(q.id) })));
  };
  // שאלה חדשה – בסוף הנושא שבחרו (או בראש הרשימה)
  const add = (topic = '') => {
    setSearch('');
    setFilter('all');
    const q = withId({ text: '', type: 'names', options: [], topic: topic === NO_TOPIC ? '' : topic, on: true, isNew: true });
    if (!topic) return setQuestions([q, ...questions]);
    const last = questions.map(topicOf).lastIndexOf(topic);
    setQuestions([...questions.slice(0, last + 1), q, ...questions.slice(last + 1)]);
  };

  const pick = async (id) => {
    if (id === bankId) return;
    const edited = questions.some((q) => q.isNew || q.edited);
    if (edited && !confirm('השינויים שעשית ברשימה הנוכחית לא יישמרו. לעבור מאגר?')) return;
    setMsg('');
    await onPickBank(id);
  };

  const saveMine = async () => {
    try {
      await api('/api/questions', { method: 'PUT', body: { questions } });
      await onBanksChanged('mine');
      setMsg('✓ נשמר! הרשימה מופיעה עכשיו כמאגר "השאלות שלי"');
    } catch (er) {
      alert(er.message);
    }
  };
  const deleteMine = async () => {
    if (!confirm('למחוק את הרשימה השמורה "השאלות שלי"?')) return;
    await api('/api/questions', { method: 'DELETE' });
    setMsg('');
    await onBanksChanged();
  };

  const topics = [...new Set(questions.map(topicOf))];
  const onCount = questions.filter((q) => q.on).length;
  const s = search.trim();
  const visible = (q) => (filter === 'all' || q.on) && (!s || q.text.includes(s) || q.isNew);

  return (
    <div className="su-card">
      <div className="su-card-head">
        <div>
          <h2>אילו שאלות במשחק?</h2>
          <p>בוחרים מאגר, ומסמנים את השאלות שרוצים. אפשר ללחוץ על כל שאלה ולשנות את הנוסח.</p>
        </div>
        <span className="su-count">{onCount} נבחרו</span>
      </div>

      {!banks.length && (
        <div className="note" style={{ marginBottom: 16 }}>
          עוד אין מאגרי שאלות מוכנים. אפשר להוסיף שאלות בעצמך בכפתור "+ שאלה חדשה".
        </div>
      )}
      {/* בחירת מאגר */}
      <div className="bank-pick">
        {banks.map((b) => (
          <button key={b.id} className={`bank-card ${b.id === bankId ? 'on' : ''}`} onClick={() => pick(b.id)}>
            <span className="ic">{b.icon || '📚'}</span>
            <b>{b.name}</b>
            <small>{b.description}</small>
            <span className="cnt">{b.count} שאלות</span>
          </button>
        ))}
      </div>

      <div className="su-qbar">
        <div className="su-search">
          <span className="ic">🔍</span>
          <input type="text" placeholder="חיפוש שאלה…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="su-seg">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            הכל ({questions.length})
          </button>
          <button className={filter === 'on' ? 'on' : ''} onClick={() => setFilter('on')}>
            נבחרו ({onCount})
          </button>
        </div>
        {/* ייבוא מתמונה / טקסט – כבוי כרגע (lib/features.js) */}
        {FEATURES.imageImport && (
          <button className="btn gold" onClick={() => setImporting(true)}>
            📥 ייבוא מתמונה / טקסט
          </button>
        )}
        <button className="btn primary" onClick={() => add()}>
          + שאלה חדשה
        </button>
      </div>

      <div className="su-qtools">
        <button className="btn small" onClick={() => setAll(true)}>סימון הכל</button>
        <button className="btn small" onClick={() => setAll(false)}>ניקוי הסימון</button>
        <span className="muted" style={{ marginInlineStart: 8 }}>🎲 בחירה אקראית של</span>
        <input type="number" min="1" value={randomN} onChange={(e) => setRandomN(e.target.value)} style={{ width: 70, padding: '6px 8px' }} />
        <button className="btn small" onClick={pickRandom}>שאלות</button>
      </div>

      <datalist id="topics-list">
        {topics.filter((t) => t !== NO_TOPIC).map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <div className="su-qlist">
        {topics.map((t) => {
          const inTopic = questions.filter((q) => topicOf(q) === t);
          const shown = inTopic.filter(visible);
          if (!shown.length) return null;
          const on = inTopic.filter((q) => q.on).length;
          return (
            <section key={t} className="topic-group">
              <div className="topic-head">
                <b>📂 {t}</b>
                <span className="muted">
                  {on} / {inTopic.length}
                </span>
                <span className="grow" />
                <button className="btn small" onClick={() => setAll(on < inTopic.length, t)}>
                  {on < inTopic.length ? 'סימון כל הנושא' : 'ביטול הנושא'}
                </button>
                <button className="btn small ghost" onClick={() => add(t)}>
                  + שאלה בנושא
                </button>
              </div>
              {shown.map((q) => (
                <QuestionRow key={q.id} q={q} onChange={(patch) => update(q.id, { ...patch, edited: true })} onRemove={() => remove(q.id)} />
              ))}
            </section>
          );
        })}
        {!questions.some(visible) && <div className="su-empty">{filter === 'on' ? 'עוד לא נבחרו שאלות' : 'לא נמצאו שאלות'}</div>}
      </div>

      {importing && (
        <ImportDialog
          ai={ai}
          onClose={() => setImporting(false)}
          onUsed={(left) => setAi?.({ ...ai, left })}
          onAdd={(list) => {
            setSearch('');
            setFilter('all');
            setQuestions([...list.map((q) => withId({ ...q, on: true })), ...questions]);
            setImporting(false);
            setMsg(`✓ נוספו ${list.length} שאלות לראש הרשימה`);
          }}
        />
      )}

      <div className="su-qfoot">
        <span className="grow" style={{ flex: 1 }} />
        {msg && <span className="msg">{msg}</span>}
        <button className="btn small" onClick={saveMine}>💾 שמירה כ"השאלות שלי"</button>
        {banks.some((b) => b.id === 'mine') && (
          <button className="btn small ghost" onClick={deleteMine}>
            מחיקת "השאלות שלי"
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionRow({ q, onChange, onRemove }) {
  const [draft, setDraft] = useState('');

  const addOption = () => {
    const v = draft.trim();
    if (!v) return;
    onChange({ options: [...q.options, v] });
    setDraft('');
  };
  const toggleType = () => {
    const type = q.type === 'names' ? 'options' : 'names';
    // לשאלת שמות מתחילים בלי תשובות נוספות; לשאלה עם תשובות קבועות – כן/לא כהתחלה
    onChange({ type, options: type === 'options' ? (q.options.length ? q.options : ['כן', 'לא']) : [] });
  };

  return (
    <div className={`su-q ${q.on ? 'on' : ''}`}>
      <button className="su-tick" title={q.on ? 'להוציא מהמשחק' : 'לכלול במשחק'} onClick={() => onChange({ on: !q.on })}>
        {q.on ? '✓' : ''}
      </button>
      <div>
        <input
          className="su-q-text"
          type="text"
          value={q.text}
          placeholder="כתבי כאן את השאלה…"
          autoFocus={q.isNew}
          onChange={(e) => onChange({ text: e.target.value, isNew: false })}
        />
        <div className="su-q-meta">
          <button className={`su-type ${q.type === 'options' ? 'opt' : ''}`} onClick={toggleType} title="לחצי להחלפה">
            {q.type === 'names' ? '👥 התשובות: שמות המשתתפות' : '🔘 התשובות: אפשרויות קבועות'}
          </button>
          <div className="su-chips">
            {q.type === 'names' && q.options.length > 0 && <span className="muted" style={{ fontSize: '.85rem' }}>+ בנוסף לשמות:</span>}
            {q.options.map((o, i) => (
              <span className={`su-chip ${q.type === 'names' ? 'extra' : ''}`} key={i}>
                {q.type === 'options' && <b style={{ fontWeight: 900 }}>{i + 1}</b>} {o}
                <button title="הסרה" onClick={() => onChange({ options: q.options.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              </span>
            ))}
            <input
              className="su-chip-input"
              type="text"
              value={draft}
              placeholder={q.type === 'names' ? '+ תשובה נוספת, למשל "אף אחת"' : '+ תשובה (Enter)'}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
              onBlur={addOption}
            />
          </div>
          <input
            className="su-topic-input"
            type="text"
            list="topics-list"
            value={q.topic || ''}
            placeholder="📂 נושא"
            title="הנושא של השאלה"
            onChange={(e) => onChange({ topic: e.target.value })}
          />
        </div>
      </div>
      <button className="su-x" title="מחיקת השאלה" onClick={onRemove}>
        🗑️
      </button>
    </div>
  );
}
