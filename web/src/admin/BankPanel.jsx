import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from './adminApi.js';
import { withId } from '../lib/api.js';
import InlineInput from './InlineInput.jsx';
import EmojiButton from '../lib/EmojiButton.jsx';
import ListPaste from '../lib/ListPaste.jsx';

const NO_TOPIC = 'כללי';
const topicOf = (q) => (q.topic || '').trim() || NO_TOPIC;
const topicValue = (t) => (t === NO_TOPIC ? '' : t);
const norm = (s) => String(s || '').replace(/[?!.,"'״׳\-–]/g, ' ').replace(/\s+/g, ' ').trim();
const incomplete = (q) => !q.text.trim() || (q.type === 'options' && q.options.filter((o) => o.trim()).length < 2);
const SAVE_DELAY = 800;

// ניהול מאגרי השאלות: מאגרים ← נושאים ← שאלות. כל שינוי נשמר לבד.
export default function BankPanel({ pw }) {
  const [banks, setBanks] = useState([]);
  const [all, setAll] = useState({}); // bankId → שאלות
  const allRef = useRef(all);
  allRef.current = all;
  const [sel, setSel] = useState(null);
  const [topic, setTopic] = useState(null);
  const [extraTopics, setExtraTopics] = useState({}); // נושאים חדשים שעוד אין בהם שאלות
  const [status, setStatus] = useState('idle'); // idle | pending | saving | saved | error
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(null); // 'bank' | 'topic'
  const [renaming, setRenaming] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: 'topic' | 'bank', name }
  const [pasting, setPasting] = useState(false);
  const [note, setNote] = useState('');
  const [undo, setUndo] = useState(null);
  const [flash, setFlash] = useState(null);
  const [drag, setDrag] = useState(null); // { kind: 'q' | 'topic', id }
  const [dropOn, setDropOn] = useState(null);

  // ---------- טעינה ----------
  const loadBanks = useCallback(async () => {
    const r = await adminApi('/api/admin/banks', pw);
    setBanks(r.banks);
    return r.banks;
  }, [pw]);
  const loadQuestions = useCallback(
    async (id) => {
      const r = await adminApi(`/api/admin/banks/${id}/questions`, pw);
      const list = r.questions.map((q) => withId(q));
      setAll((a) => ({ ...a, [id]: list }));
      return list;
    },
    [pw]
  );
  useEffect(() => {
    loadBanks().then(async (b) => {
      await Promise.all(b.map((x) => loadQuestions(x.id)));
      if (b[0]) setSel((s) => s ?? b[0].id);
    });
  }, [loadBanks, loadQuestions]);

  // ---------- שמירה אוטומטית ----------
  const timers = useRef({});
  const chain = useRef(Promise.resolve());
  const pendingCount = useRef(0);
  const saveNow = useCallback(
    (bankId) => {
      chain.current = chain.current.then(async () => {
        setStatus('saving');
        try {
          const list = (allRef.current[bankId] || []).filter((q) => !incomplete(q));
          const r = await adminApi(`/api/admin/banks/${bankId}/questions`, pw, 'PUT', { questions: list });
          setBanks((bs) => bs.map((b) => (b.id === bankId ? { ...b, count: r.questions.length } : b)));
          pendingCount.current = Math.max(0, pendingCount.current - 1);
          if (!pendingCount.current) setStatus('saved');
        } catch {
          setStatus('error');
          setTimeout(() => saveNow(bankId), 3000); // מנסים שוב
        }
      });
    },
    [pw]
  );
  const scheduleSave = (bankId) => {
    if (!timers.current[bankId]) pendingCount.current += 1;
    clearTimeout(timers.current[bankId]);
    setStatus('pending');
    timers.current[bankId] = setTimeout(() => {
      timers.current[bankId] = null;
      saveNow(bankId);
    }, SAVE_DELAY);
  };
  // לא לסגור את הדף באמצע שמירה
  useEffect(() => {
    const warn = (e) => {
      if (status === 'pending' || status === 'saving' || status === 'error') (e.preventDefault(), (e.returnValue = ''));
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  const qs = all[sel] || [];
  const setQs = (list, bankId = sel) => {
    setAll((a) => ({ ...a, [bankId]: list }));
    allRef.current = { ...allRef.current, [bankId]: list };
    scheduleSave(bankId);
  };

  // ---------- נושאים ----------
  const topics = useMemo(() => {
    const t = [...new Set(qs.map(topicOf))];
    for (const x of extraTopics[sel] || []) if (!t.includes(x)) t.push(x);
    return t;
  }, [qs, extraTopics, sel]);
  const current = topics.includes(topic) ? topic : topics[0] ?? null;
  const inTopic = qs.filter((q) => topicOf(q) === current);

  // מקום להכניס שאלה בסוף נושא
  const insertAtTopicEnd = (list, items, t) => {
    const last = list.map(topicOf).lastIndexOf(t);
    return last < 0 ? [...list, ...items] : [...list.slice(0, last + 1), ...items, ...list.slice(last + 1)];
  };

  const addQuestion = () => {
    if (!current) return;
    const q = withId({ text: '', type: 'names', options: [], topic: topicValue(current), isNew: true });
    setQs(insertAtTopicEnd(qs, [q], current));
  };
  const update = (id, patch) => setQs(qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const remove = (id) => {
    const i = qs.findIndex((q) => q.id === id);
    setUndo({ bankId: sel, q: qs[i], i });
    setQs(qs.filter((q) => q.id !== id));
  };
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo]);
  const doUndo = () => {
    const list = [...(allRef.current[undo.bankId] || [])];
    list.splice(undo.i, 0, undo.q);
    setQs(list, undo.bankId);
    setUndo(null);
  };
  const moveTo = (id, t) => {
    const q = qs.find((x) => x.id === id);
    const rest = qs.filter((x) => x.id !== id);
    setQs(insertAtTopicEnd(rest, [{ ...q, topic: topicValue(t) }], t));
  };

  const addTopic = (name) => {
    setAdding(null);
    if (!name) return;
    if (!topics.includes(name)) setExtraTopics((x) => ({ ...x, [sel]: [...(x[sel] || []), name] }));
    setTopic(name);
  };
  const renameTopic = (t, name) => {
    setRenaming(null);
    if (!name || name === t) return;
    setExtraTopics((x) => ({ ...x, [sel]: (x[sel] || []).map((e) => (e === t ? name : e)) }));
    if (qs.some((q) => topicOf(q) === t)) setQs(qs.map((q) => (topicOf(q) === t ? { ...q, topic: topicValue(name) } : q)));
    setTopic(name);
  };
  const deleteTopic = (t) => {
    setConfirm(null);
    setExtraTopics((x) => ({ ...x, [sel]: (x[sel] || []).filter((e) => e !== t) }));
    if (qs.some((q) => topicOf(q) === t)) setQs(qs.filter((q) => topicOf(q) !== t));
    setNote(`הנושא "${t}" נמחק`);
  };
  const reorderTopics = (from, to) => {
    if (from === to) return;
    const order = topics.filter((t) => t !== from);
    order.splice(order.indexOf(to), 0, from);
    const rank = (q) => order.indexOf(topicOf(q));
    setQs([...qs].sort((a, b) => rank(a) - rank(b)));
  };

  // ---------- גרירה ----------
  const dropOnQuestion = (targetId) => {
    if (drag?.kind !== 'q' || drag.id === targetId) return;
    const q = qs.find((x) => x.id === drag.id);
    const target = qs.find((x) => x.id === targetId);
    const rest = qs.filter((x) => x.id !== drag.id);
    const at = rest.findIndex((x) => x.id === targetId);
    const from = qs.findIndex((x) => x.id === drag.id);
    const to = qs.findIndex((x) => x.id === targetId);
    rest.splice(from < to ? at + 1 : at, 0, { ...q, topic: target.topic });
    setQs(rest);
  };
  const dropOnTopic = (t) => {
    if (drag?.kind === 'q') {
      moveTo(drag.id, t);
      setNote(`השאלה הועברה ל"${t}"`);
    } else if (drag?.kind === 'topic') reorderTopics(drag.id, t);
  };
  const dragProps = (kind, id) => ({
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(id));
      setDrag({ kind, id });
    },
    onDragEnd: () => (setDrag(null), setDropOn(null)),
  });
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

  // ---------- כפילויות וחיפוש (בכל המאגרים) ----------
  const index = useMemo(() => {
    const m = new Map();
    for (const b of banks)
      for (const q of all[b.id] || []) {
        const k = norm(q.text);
        if (!k) continue;
        if (!m.has(k)) m.set(k, []);
        m.get(k).push({ bank: b, q });
      }
    return m;
  }, [all, banks]);
  const dupOf = (q) => {
    const others = (index.get(norm(q.text)) || []).filter((x) => x.q.id !== q.id);
    if (!others.length) return null;
    const o = others[0];
    return o.bank.id === sel ? `כבר קיימת בנושא "${topicOf(o.q)}"` : `כבר קיימת במאגר "${o.bank.name}"`;
  };
  const s = norm(search);
  const results = s
    ? banks.flatMap((b) => (all[b.id] || []).filter((q) => norm(q.text).includes(s)).map((q) => ({ bank: b, q }))).slice(0, 60)
    : [];
  const openResult = ({ bank, q }) => {
    setSel(bank.id);
    setTopic(topicOf(q));
    setSearch('');
    setFlash(q.id);
    setTimeout(() => document.getElementById('q-' + q.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
    setTimeout(() => setFlash(null), 2200);
  };

  // ---------- מאגרים ----------
  const bank = banks.find((b) => b.id === sel);
  const openBank = (id) => {
    setSel(id);
    setTopic(null);
    setConfirm(null);
    setRenaming(null);
    setPasting(false);
  };
  const newBank = async (name) => {
    setAdding(null);
    if (!name) return;
    const r = await adminApi('/api/admin/banks', pw, 'POST', { name, icon: '📚' });
    await loadBanks();
    await loadQuestions(r.id);
    openBank(r.id);
  };
  const duplicateBank = async () => {
    const r = await adminApi('/api/admin/banks', pw, 'POST', { name: `${bank.name} (עותק)`, icon: bank.icon, description: bank.description });
    await adminApi(`/api/admin/banks/${r.id}/questions`, pw, 'PUT', { questions: qs.filter((q) => !incomplete(q)) });
    await adminApi(`/api/admin/banks/${r.id}`, pw, 'PATCH', { active: false });
    await loadBanks();
    await loadQuestions(r.id);
    openBank(r.id);
    setNote('✓ נוצר עותק של המאגר (מוסתר מהלקוחות עד שתפעילי אותו)');
  };
  const patchBank = async (patch) => {
    setBanks((bs) => bs.map((b) => (b.id === sel ? { ...b, ...patch } : b)));
    await adminApi(`/api/admin/banks/${sel}`, pw, 'PATCH', patch);
    setStatus('saved');
  };
  const deleteBank = async () => {
    setConfirm(null);
    await adminApi(`/api/admin/banks/${sel}`, pw, 'DELETE');
    const b = await loadBanks();
    openBank(b[0]?.id ?? null);
  };

  const pasteAdd = (items) => {
    const list = items.map((q) => withId({ ...q, topic: topicValue(current) }));
    setPasting(false);
    if (!list.length) return;
    setQs(insertAtTopicEnd(qs, list, current));
    setNote(`✓ נוספו ${list.length} שאלות לנושא "${current}"`);
  };

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(''), 4000);
    return () => clearTimeout(t);
  }, [note]);

  const drafts = qs.filter(incomplete).length;

  return (
    <div className="su-card bp">
      <div className="su-card-head bp-head">
        <div>
          <h2>📚 מאגרי שאלות</h2>
          <p>כל שינוי נשמר לבד. גוררים שאלות כדי לסדר אותן או להעביר לנושא אחר.</p>
        </div>
        <SaveBadge status={status} drafts={drafts} />
      </div>

      <div className="bp-search">
        <span className="ic">🔍</span>
        <input type="search" placeholder="חיפוש שאלה בכל המאגרים…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {s ? (
        <div className="bp-results">
          <div className="muted">{results.length ? `נמצאו ${results.length} שאלות` : 'לא נמצאו שאלות'}</div>
          {results.map((r) => (
            <button key={r.q.id} className="bp-result" onClick={() => openResult(r)}>
              <span className="where">
                {r.bank.icon} {r.bank.name} · 📂 {topicOf(r.q)}
              </span>
              <b>{r.q.text}</b>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="bank-pick">
            {banks.map((b) => (
              <button key={b.id} className={`bank-card ${b.id === sel ? 'on' : ''} ${b.active ? '' : 'off'}`} onClick={() => openBank(b.id)}>
                <span className="ic">{b.icon || '📚'}</span>
                <b>{b.name}</b>
                <small>{b.description}</small>
                <span className="cnt">
                  {b.count} שאלות{b.active ? '' : ' · מוסתר'}
                </span>
              </button>
            ))}
            {adding === 'bank' ? (
              <div className="bank-card add editing">
                <b>שם המאגר החדש</b>
                <InlineInput placeholder="למשל: נועז" width={150} saveText="יצירה" onSave={newBank} onCancel={() => setAdding(null)} />
              </div>
            ) : (
              <button className="bank-card add" onClick={() => setAdding('bank')}>
                <span className="ic">➕</span>
                <b>מאגר חדש</b>
              </button>
            )}
          </div>

          {!banks.length && <div className="note">עוד אין מאגרים. לוחצים "מאגר חדש", נותנים לו שם – והוא נפתח עם 2 שאלות לדוגמה.</div>}

          {bank && (
            <>
              <div className="bank-meta">
                <label>
                  אייקון
                  <input type="text" defaultValue={bank.icon} key={'i' + bank.id} maxLength={4} style={{ width: 70, textAlign: 'center' }} onBlur={(e) => e.target.value !== bank.icon && patchBank({ icon: e.target.value })} />
                </label>
                <label className="grow">
                  שם המאגר
                  <input type="text" defaultValue={bank.name} key={'n' + bank.id} onBlur={(e) => e.target.value.trim() && e.target.value !== bank.name && patchBank({ name: e.target.value.trim() })} />
                </label>
                <label style={{ flex: 2 }}>
                  תיאור קצר (מוצג ללקוחות)
                  <input type="text" defaultValue={bank.description} key={'d' + bank.id} onBlur={(e) => e.target.value !== (bank.description || '') && patchBank({ description: e.target.value })} />
                </label>
                <div className="row bp-bank-actions">
                  <button className="btn small" onClick={() => patchBank({ active: !bank.active })}>
                    {bank.active ? '🙈 הסתרה מלקוחות' : '👁️ הצגה ללקוחות'}
                  </button>
                  <button className="btn small" onClick={duplicateBank}>
                    📑 שכפול
                  </button>
                  {confirm?.kind === 'bank' ? (
                    <span className="bp-confirm">
                      למחוק את המאגר וכל השאלות שבו?
                      <button className="btn small danger" onClick={deleteBank}>
                        כן, למחוק
                      </button>
                      <button className="btn small ghost" onClick={() => setConfirm(null)}>
                        ביטול
                      </button>
                    </span>
                  ) : (
                    <button className="btn small danger" onClick={() => setConfirm({ kind: 'bank' })}>
                      מחיקת מאגר
                    </button>
                  )}
                </div>
              </div>

              <div className="bp-layout">
                {/* נושאים */}
                <aside className="bp-topics">
                  <div className="bp-topics-title">📂 נושאים</div>
                  {topics.map((t) => {
                    const n = qs.filter((q) => topicOf(q) === t).length;
                    return (
                      <div
                        key={t}
                        className={`bp-topic ${t === current ? 'on' : ''} ${dropOn === 't:' + t ? 'drop' : ''}`}
                        onClick={() => (setTopic(t), setPasting(false))}
                        {...dragProps('topic', t)}
                        {...dropProps('t:' + t, () => dropOnTopic(t))}
                      >
                        {renaming === t ? (
                          <InlineInput initial={topicValue(t)} placeholder="שם הנושא" width={120} onSave={(name) => renameTopic(t, name)} onCancel={() => setRenaming(null)} />
                        ) : (
                          <>
                            <span className="grip" title="גרירה לשינוי הסדר">⋮⋮</span>
                            <span className="name">{t}</span>
                            <span className="n">{n}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {adding === 'topic' ? (
                    <div className="bp-topic editing">
                      <InlineInput placeholder="שם הנושא" width={120} saveText="הוספה" onSave={addTopic} onCancel={() => setAdding(null)} />
                    </div>
                  ) : (
                    <button className="bp-topic add" onClick={() => setAdding('topic')}>
                      + נושא חדש
                    </button>
                  )}
                  <p className="bp-tip">💡 אפשר לגרור שאלה ולשחרר על נושא כדי להעביר אותה</p>
                </aside>

                {/* שאלות הנושא */}
                <section className="bp-main">
                  {current ? (
                    <>
                      <div className="bp-main-head">
                        <h3>📂 {current}</h3>
                        <span className="muted">{inTopic.length} שאלות</span>
                        <span className="grow" />
                        {renaming !== current && (
                          <button className="btn small ghost" onClick={() => setRenaming(current)}>
                            ✏️ שינוי שם
                          </button>
                        )}
                        {confirm?.kind === 'topic' && confirm.name === current ? (
                          <span className="bp-confirm">
                            {inTopic.length ? `למחוק את הנושא ואת ${inTopic.length} השאלות שבו?` : 'למחוק את הנושא?'}
                            <button className="btn small danger" onClick={() => deleteTopic(current)}>
                              כן
                            </button>
                            <button className="btn small ghost" onClick={() => setConfirm(null)}>
                              לא
                            </button>
                          </span>
                        ) : (
                          <button className="btn small ghost" onClick={() => setConfirm({ kind: 'topic', name: current })}>
                            🗑️ מחיקת נושא
                          </button>
                        )}
                      </div>

                      <div className="admin-qs">
                        {inTopic.map((q) => (
                          <AdminQuestion
                            key={q.id}
                            q={q}
                            topics={topics}
                            current={current}
                            dup={dupOf(q)}
                            flash={flash === q.id}
                            dragging={drag?.kind === 'q' && drag.id === q.id}
                            dropping={dropOn === 'q:' + q.id}
                            dragProps={dragProps('q', q.id)}
                            dropProps={dropProps('q:' + q.id, () => dropOnQuestion(q.id))}
                            onChange={(patch) => update(q.id, patch)}
                            onRemove={() => remove(q.id)}
                            onMove={(t) => (moveTo(q.id, t), setNote(`השאלה הועברה ל"${t}"`))}
                          />
                        ))}
                        {!inTopic.length && <div className="su-empty">הנושא ריק. מוסיפים שאלה, או מדביקים כמה בבת אחת 👇</div>}
                      </div>

                      {pasting ? (
                        <ListPaste title={`📋 הוספת רשימת שאלות לנושא "${current}"`} onAdd={pasteAdd} onCancel={() => setPasting(false)} />
                      ) : (
                        <div className="bp-add">
                          <button className="btn primary" onClick={addQuestion}>
                            + שאלה
                          </button>
                          <button className="btn" onClick={() => setPasting(true)}>
                            📋 הוספת רשימת שאלות
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="su-empty">המאגר ריק. מתחילים ב"+ נושא חדש" מימין.</div>
                  )}
                </section>
              </div>
            </>
          )}
        </>
      )}

      {(note || undo) && (
        <div className="bp-toast">
          {undo ? (
            <>
              השאלה נמחקה
              <button className="btn small" onClick={doUndo}>
                ↩ ביטול
              </button>
            </>
          ) : (
            note
          )}
        </div>
      )}
    </div>
  );
}

function SaveBadge({ status, drafts }) {
  const map = {
    idle: ['', ''],
    pending: ['…', 'pending'],
    saving: ['💾 שומר…', 'pending'],
    saved: ['✓ כל השינויים נשמרו', 'ok'],
    error: ['⚠️ אין חיבור – מנסה לשמור שוב', 'err'],
  };
  const [text, cls] = map[status];
  return (
    <div className="bp-status">
      {text && <span className={`bp-save ${cls}`}>{text}</span>}
      {drafts > 0 && <span className="bp-save draft">✏️ {drafts === 1 ? 'שאלה אחת לא גמורה – לא תישמר עד שתושלם' : `${drafts} שאלות לא גמורות – לא יישמרו עד שיושלמו`}</span>}
    </div>
  );
}

// שאלה אחת: נוסח, סוג, תשובות, העברה לנושא
function AdminQuestion({ q, topics, current, dup, flash, dragging, dropping, dragProps, dropProps, onChange, onRemove, onMove }) {
  const [draft, setDraft] = useState('');
  const textRef = useRef(null);
  const addAnswer = () => {
    const v = draft.trim();
    if (!v) return;
    onChange({ options: [...q.options, v] });
    setDraft('');
  };
  const setType = (type) => onChange({ type, options: type === 'options' ? (q.options.length ? q.options : ['כן', 'לא']) : [] });
  const bad = incomplete(q) && !q.isNew;

  return (
    <div id={'q-' + q.id} className={`aq ${dragging ? 'dragging' : ''} ${dropping ? 'drop' : ''} ${flash ? 'flash' : ''} ${bad ? 'bad' : ''}`} {...dropProps}>
      <div className="aq-grip" title="גרירה לשינוי הסדר או להעברה לנושא אחר" {...dragProps}>
        ⋮⋮
      </div>
      <div className="aq-body">
        <div className="su-q-textrow">
          <input ref={textRef} className="aq-text" type="text" value={q.text} placeholder="נוסח השאלה…" autoFocus={q.isNew} onChange={(e) => onChange({ text: e.target.value, isNew: false })} />
          <EmojiButton inputRef={textRef} value={q.text} onChange={(text) => onChange({ text, isNew: false })} />
        </div>
        {dup && <div className="aq-dup">⚠️ {dup}</div>}
        <div className="aq-row">
          <div className="su-seg aq-type">
            <button className={q.type === 'names' ? 'on' : ''} onClick={() => setType('names')}>
              👥 שמות המשתתפות
            </button>
            <button className={q.type === 'options' ? 'on' : ''} onClick={() => setType('options')}>
              🔘 תשובות קבועות
            </button>
          </div>
          {topics.length > 1 && (
            <select className="aq-move-to" value="" onChange={(e) => e.target.value && onMove(e.target.value)} title="העברה לנושא אחר">
              <option value="">📂 העברה לנושא…</option>
              {topics
                .filter((t) => t !== current)
                .map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
            </select>
          )}
        </div>
        <div className="aq-answers">
          <span className="muted">{q.type === 'names' ? 'תשובות נוספות מעבר לשמות (לא חובה):' : 'התשובות:'}</span>
          {q.options.map((o, i) => (
            <span className={`su-chip ${q.type === 'names' ? 'extra' : ''}`} key={i}>
              {q.type === 'options' && <b>{i + 1}</b>}
              <input className="aq-answer" value={o} size={Math.max(4, o.length)} onChange={(e) => onChange({ options: q.options.map((x, j) => (j === i ? e.target.value : x)) })} />
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
