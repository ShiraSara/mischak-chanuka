import { useRef, useState } from 'react';
import { api, shuffle, withId } from '../lib/api.js';
import { countForMinutes, estimateMinutes, fmtMinutes } from '../lib/gameLength.js';
import ImportDialog from './ImportDialog.jsx';
import EmojiButton from '../lib/EmojiButton.jsx';
import ListPaste from '../lib/ListPaste.jsx';
import TimerSelect from '../lib/TimerSelect.jsx';
import { FEATURES } from '../lib/features.js';

const NO_TOPIC = 'כללי';
const topicOf = (q) => (q.topic || '').trim() || NO_TOPIC;

// שלב 2: בחירת גרסה, בחירת שאלות לפי נושאים, עריכה, סידור בגרירה וסל מחזור
export default function QuestionsEditor({ questions, setQuestions, trash, setTrash, settings = {}, banks, bankId, onPickBank, onBanksChanged, ai, setAi }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | on
  const [msg, setMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const [askPick, setAskPick] = useState(null); // גרסה שרוצים לעבור אליה (מחכה לאישור)
  const [askDelete, setAskDelete] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [length, setLength] = useState({ minutes: 0, count: null }); // 0 = כל השאלות שסימנתי
  const [topicTimes, setTopicTimes] = useState(null); // נושא שפתוחים בו הזמנים

  // משך המשחק: "כל השאלות" או זמן – המערכת מסמנת באקראי כמה שאלות שנכנסות בזמן
  const pickForTime = (minutes, count) => {
    if (!minutes) {
      setLength({ minutes: 0, count: null });
      return setQuestions(questions.map((q) => ({ ...q, on: !!q.text.trim() })));
    }
    const pool = questions.filter((q) => q.text.trim()).map((q) => q.id);
    const want = Math.max(1, count ?? countForMinutes(minutes, settings).count);
    const n = Math.min(want, pool.length);
    const chosen = new Set(shuffle(pool).slice(0, n));
    setQuestions(questions.map((q) => ({ ...q, on: chosen.has(q.id) })));
    setLength({ minutes, count: n, short: want > pool.length ? want : 0 });
  };
  const setTopicTime = (topic, patch) =>
    setQuestions(questions.map((q) => (topicOf(q) === topic ? { ...q, ...patch, edited: true } : q)));
  const [drag, setDrag] = useState(null);
  const [dropOn, setDropOn] = useState(null);

  const update = (id, patch) => setQuestions(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  // מחיקה → לסל המחזור (אפשר לשחזר)
  const remove = (id) => {
    const i = questions.findIndex((q) => q.id === id);
    setTrash([{ q: questions[i], i }, ...trash]);
    setQuestions(questions.filter((q) => q.id !== id));
  };
  const restore = (item) => {
    const list = [...questions];
    list.splice(Math.min(item.i, list.length), 0, item.q);
    setQuestions(list);
    setTrash(trash.filter((t) => t !== item));
  };
  const restoreAll = () => {
    const list = [...questions];
    [...trash].reverse().forEach((t) => list.splice(Math.min(t.i, list.length), 0, t.q));
    setQuestions(list);
    setTrash([]);
    setShowTrash(false);
  };
  const setAll = (on, topic) => setQuestions(questions.map((q) => (topic == null || topicOf(q) === topic ? { ...q, on } : q)));
  // שאלה חדשה – בסוף הנושא שבחרו (או בראש הרשימה)
  const add = (topic = '') => {
    setSearch('');
    setFilter('all');
    const q = withId({ text: '', type: 'names', options: [], topic: topic === NO_TOPIC ? '' : topic, on: true, isNew: true });
    if (!topic) return setQuestions([q, ...questions]);
    const last = questions.map(topicOf).lastIndexOf(topic);
    setQuestions([...questions.slice(0, last + 1), q, ...questions.slice(last + 1)]);
  };

  // גרירה: על שאלה אחרת – משנה מקום (ומצטרפת לנושא שלה); על כותרת נושא – עוברת לסוף הנושא
  const dropOnQuestion = (targetId) => {
    if (!drag || drag === targetId) return;
    const q = questions.find((x) => x.id === drag);
    const target = questions.find((x) => x.id === targetId);
    const from = questions.findIndex((x) => x.id === drag);
    const to = questions.findIndex((x) => x.id === targetId);
    const rest = questions.filter((x) => x.id !== drag);
    const at = rest.findIndex((x) => x.id === targetId);
    rest.splice(from < to ? at + 1 : at, 0, { ...q, topic: target.topic, edited: true });
    setQuestions(rest);
  };
  const dropOnTopic = (t) => {
    if (!drag) return;
    const q = questions.find((x) => x.id === drag);
    const rest = questions.filter((x) => x.id !== drag);
    const last = rest.map(topicOf).lastIndexOf(t);
    rest.splice(last + 1, 0, { ...q, topic: t === NO_TOPIC ? '' : t, edited: true });
    setQuestions(rest);
  };
  const dropProps = (key, onDrop) => ({
    onDragOver: (e) => {
      if (!drag) return;
      e.preventDefault();
      if (dropOn !== key) setDropOn(key);
    },
    onDragLeave: () => dropOn === key && setDropOn(null),
    onDrop: (e) => {
      e.preventDefault();
      onDrop();
      setDrag(null);
      setDropOn(null);
    },
  });

  const pick = async (id, sure = false) => {
    if (id === bankId) return;
    const edited = questions.some((q) => q.isNew || q.edited) || trash.length > 0;
    if (edited && !sure) return setAskPick(id);
    setAskPick(null);
    setMsg('');
    await onPickBank(id);
  };

  const saveMine = async () => {
    try {
      await api('/api/questions', { method: 'PUT', body: { questions } });
      await onBanksChanged('mine');
      setMsg('✓ נשמר! הרשימה מופיעה עכשיו כגרסה "השאלות שלי"');
    } catch (er) {
      setMsg('⚠️ ' + er.message);
    }
  };
  const deleteMine = async () => {
    setAskDelete(false);
    await api('/api/questions', { method: 'DELETE' });
    setMsg('');
    await onBanksChanged();
  };

  const topics = [...new Set(questions.map(topicOf))];
  const onCount = questions.filter((q) => q.on).length;
  const s = search.trim();
  const visible = (q) => (filter === 'all' || q.on) && (!s || q.text.includes(s) || q.isNew);
  const canDrag = !s && filter === 'all';

  return (
    <div className="su-card">
      <div className="su-card-head">
        <div>
          <h2>אילו שאלות במשחק?</h2>
          <p>בוחרים גרסה ומסמנים ✓ על השאלות שרוצים. אפשר לשנות כל נוסח, ולגרור שאלות בסימן ⋮⋮ כדי לשנות את הסדר.</p>
        </div>
        <span className="su-count">{onCount} נבחרו</span>
      </div>

      {!banks.length && (
        <div className="note" style={{ marginBottom: 16 }}>
          עוד אין גרסאות מוכנות. אפשר להוסיף שאלות בעצמך בכפתור "+ שאלה חדשה".
        </div>
      )}
      {banks.length > 0 && <div className="su-label">בחירת גרסה</div>}
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
      {askPick != null && (
        <div className="su-ask">
          השינויים שעשית ברשימה הנוכחית לא יישמרו. לעבור גרסה?
          <button className="btn small danger" onClick={() => pick(askPick, true)}>
            כן, לעבור
          </button>
          <button className="btn small ghost" onClick={() => setAskPick(null)}>
            ביטול
          </button>
        </div>
      )}

      <div className="su-length">
        <b>⏱ כמה זמן משחקים?</b>
        <div className="su-seg">
          {[[0, '📚 כל השאלות'], [30, '30 דק׳'], [60, 'שעה'], [90, 'שעה וחצי']].map(([m, l]) => (
            <button key={m} className={length.minutes === m ? 'on' : ''} onClick={() => pickForTime(m)}>
              {l}
            </button>
          ))}
        </div>
        {length.minutes > 0 && (
          <span className="su-length-n">
            🎲 נבחרו באקראי
            <input
              type="number"
              min="1"
              value={length.count ?? ''}
              title="אפשר לשנות את מספר השאלות"
              onChange={(e) => e.target.value && pickForTime(length.minutes, Number(e.target.value))}
            />
            שאלות
            {length.short > 0 && <small className="muted"> (בגרסה יש רק {length.count} – לזמן הזה צריך כ-{length.short})</small>}
          </span>
        )}
        <span className="muted su-length-est">
          משך משוער: {fmtMinutes(estimateMinutes(questions.filter((q) => q.on && q.text.trim()), settings))}
          {length.minutes > 0 && ` (כ-${countForMinutes(length.minutes, settings).perSec} שניות לשאלה)`}
        </span>
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
        <button className="btn" onClick={() => setPasting(!pasting)}>
          📋 הוספת רשימה
        </button>
        <button className="btn primary" onClick={() => add()}>
          + שאלה חדשה
        </button>
      </div>

      {pasting && (
        <ListPaste
          title="📋 הוספת רשימת שאלות"
          topicInput
          onCancel={() => setPasting(false)}
          onAdd={(items, topic) => {
            setSearch('');
            setFilter('all');
            setQuestions([...items.map((q) => withId({ ...q, topic, on: true, edited: true })), ...questions]);
            setPasting(false);
            setMsg(`✓ נוספו ${items.length} שאלות לראש הרשימה – וכבר מסומנות למשחק`);
          }}
        />
      )}

      <div className="su-qtools">
        <button className="btn small" onClick={() => setAll(true)}>סימון הכל</button>
        <button className="btn small" onClick={() => setAll(false)}>ניקוי הסימון</button>
        <span className="grow" />
        <button className={`btn small ${showTrash ? 'on' : 'ghost'}`} disabled={!trash.length} onClick={() => setShowTrash(!showTrash)}>
          🗑️ סל מחזור{trash.length ? ` (${trash.length})` : ''}
        </button>
      </div>

      {showTrash && trash.length > 0 && (
        <div className="su-trash">
          <div className="su-trash-head">
            <b>🗑️ שאלות שהורדת</b>
            <span className="grow" />
            <button className="btn small" onClick={restoreAll}>
              ↩ שחזור הכל
            </button>
          </div>
          {trash.map((t) => (
            <div className="su-trash-row" key={t.q.id}>
              <span>{t.q.text || '(שאלה בלי נוסח)'}</span>
              <button className="btn small" onClick={() => restore(t)}>
                ↩ שחזור
              </button>
            </div>
          ))}
        </div>
      )}

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
              <div className={`topic-head ${dropOn === 't:' + t ? 'drop' : ''}`} {...dropProps('t:' + t, () => dropOnTopic(t))}>
                <b>📂 {t}</b>
                <span className="muted">
                  {on} / {inTopic.length}
                </span>
                <span className="grow" />
                <button className="btn small" onClick={() => setAll(on < inTopic.length, t)}>
                  {on < inTopic.length ? 'סימון כל הנושא' : 'ביטול הנושא'}
                </button>
                <button className="btn small ghost" onClick={() => setTopicTimes(topicTimes === t ? null : t)} title="זמנים לכל השאלות בנושא">
                  ⏱ זמנים לנושא
                </button>
                <button className="btn small ghost" onClick={() => add(t)}>
                  + שאלה בנושא
                </button>
              </div>
              {topicTimes === t && (
                <TimesPanel
                  title={`⏱ זמנים לכל השאלות בנושא "${t}"`}
                  q={inTopic.every((q) => q.timerSec === inTopic[0].timerSec && q.resultsSec === inTopic[0].resultsSec) ? inTopic[0] : {}}
                  settings={settings}
                  onChange={(patch) => setTopicTime(t, patch)}
                  onClose={() => setTopicTimes(null)}
                />
              )}
              {shown.map((q) => (
                <QuestionRow
                  key={q.id}
                  q={q}
                  settings={settings}
                  canDrag={canDrag}
                  dragging={drag === q.id}
                  dropping={dropOn === 'q:' + q.id}
                  onDragStart={() => setDrag(q.id)}
                  onDragEnd={() => (setDrag(null), setDropOn(null))}
                  dropProps={dropProps('q:' + q.id, () => dropOnQuestion(q.id))}
                  onChange={(patch) => update(q.id, { ...patch, edited: true })}
                  onRemove={() => remove(q.id)}
                />
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
        {banks.some((b) => b.id === 'mine') &&
          (askDelete ? (
            <span className="su-ask inline">
              למחוק את "השאלות שלי"?
              <button className="btn small danger" onClick={deleteMine}>
                כן
              </button>
              <button className="btn small ghost" onClick={() => setAskDelete(false)}>
                לא
              </button>
            </span>
          ) : (
            <button className="btn small ghost" onClick={() => setAskDelete(true)}>
              מחיקת "השאלות שלי"
            </button>
          ))}
      </div>
    </div>
  );
}

function QuestionRow({ q, settings, canDrag, dragging, dropping, onDragStart, onDragEnd, dropProps, onChange, onRemove }) {
  const [draft, setDraft] = useState('');
  const [times, setTimes] = useState(false);
  const textRef = useRef(null);

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
    <div className={`su-q ${q.on ? 'on' : ''} ${dragging ? 'dragging' : ''} ${dropping ? 'drop' : ''}`} {...dropProps}>
      <div className="su-q-side">
        <button className="su-tick" title={q.on ? 'להוציא מהמשחק' : 'לכלול במשחק'} onClick={() => onChange({ on: !q.on })}>
          {q.on ? '✓' : ''}
        </button>
        {canDrag && (
          <span
            className="su-grip"
            title="גרירה לשינוי הסדר"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(q.id));
              onDragStart();
            }}
            onDragEnd={onDragEnd}
          >
            ⋮⋮
          </span>
        )}
      </div>
      <div>
        <div className="su-q-textrow">
          <input
            ref={textRef}
            className="su-q-text"
            type="text"
            value={q.text}
            placeholder="כתבי כאן את השאלה…"
            autoFocus={q.isNew}
            onChange={(e) => onChange({ text: e.target.value, isNew: false })}
          />
          <EmojiButton inputRef={textRef} value={q.text} onChange={(text) => onChange({ text, isNew: false })} />
          <button className={`su-times-btn ${q.timerSec != null || q.resultsSec != null ? 'set' : ''}`} title="זמנים לשאלה הזו" onClick={() => setTimes(!times)}>
            ⚙️
          </button>
        </div>
        {q.resultsSec != null && !times && (
          <div className="su-times-badge" onClick={() => setTimes(true)}>
            <span>📊 תוצאות {q.resultsSec} שנ׳</span>
          </div>
        )}
        {times && <TimesPanel title="⏱ זמנים לשאלה הזו" q={q} settings={settings} onChange={onChange} onClose={() => setTimes(false)} />}
        <div className="su-q-meta">
          <TimerSelect value={q.timerSec} def={Number(settings.timerSec) || 0} onChange={(timerSec) => onChange({ timerSec })} />
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
      <button className="su-x" title="הורדת השאלה (אפשר לשחזר מסל המחזור)" onClick={onRemove}>
        🗑️
      </button>
    </div>
  );
}

// בחירת זמן לשאלה / לנושא: "רגיל" = לפי הגדרות המשחק
const Q_TIMES = [0, 10, 15, 20, 30, 45, 60, 90];
const R_TIMES = [3, 5, 8, 12, 20];
function TimesPanel({ title, q, settings, onChange, onClose }) {
  const chip = (cur, v, label, patch) => (
    <button key={label} className={cur === v ? 'on' : ''} onClick={() => onChange(patch)}>
      {label}
    </button>
  );
  return (
    <div className="su-times">
      <div className="su-times-head">
        <b>{title}</b>
        <button className="btn small ghost" onClick={onClose}>
          ✓ סגירה
        </button>
      </div>
      <div className="su-times-row">
        <span>כמה זמן לשאלה</span>
        <div className="su-timer">
          {chip(q.timerSec, undefined, `רגיל (${settings.timerSec ? settings.timerSec + ' שנ׳' : 'בלי'})`, { timerSec: undefined })}
          {Q_TIMES.map((t) => chip(q.timerSec, t, t ? `${t}` : 'בלי', { timerSec: t }))}
        </div>
      </div>
      <div className="su-times-row">
        <span>כמה זמן לתוצאות</span>
        <div className="su-timer">
          {chip(q.resultsSec, undefined, `רגיל (${settings.resultsSec || 5} שנ׳)`, { resultsSec: undefined })}
          {R_TIMES.map((t) => chip(q.resultsSec, t, `${t}`, { resultsSec: t }))}
        </div>
      </div>
    </div>
  );
}
