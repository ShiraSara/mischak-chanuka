import { useCallback, useEffect, useState } from 'react';
import { adminApi } from './adminApi.js';
import InlineInput from './InlineInput.jsx';

const fmt = (t) => (t ? new Date(t).toLocaleDateString('he-IL') : '');
const DAYS = [[1, '24 שעות'], [7, 'שבוע'], [30, 'חודש'], [0, 'ללא הגבלה']];
const GAMES = [[1, '1'], [3, '3'], [5, '5'], [10, '10'], [0, 'ללא הגבלה']];

// בחירה בלחיצה + אפשרות להקליד מספר אחר
function Pick({ value, options, onChange, unit }) {
  const preset = options.some(([v]) => v === Number(value));
  return (
    <div className="ad-pick">
      {options.map(([v, label]) => (
        <button type="button" key={v} className={Number(value) === v ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
      <input
        type="number"
        min="0"
        placeholder={'אחר (' + unit + ')'}
        value={preset ? '' : value}
        onChange={(e) => onChange(e.target.value === '' ? options[0][0] : Number(e.target.value))}
      />
    </div>
  );
}

// יצירת קודים ללקוחות וניהול הקודים הקיימים
export default function CodesPanel({ pw }) {
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState({ label: '', code: '', days: 30, maxGames: 1 });
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // { code, field }

  const load = useCallback(() => adminApi('/api/admin/codes', pw).then((r) => setCodes(r.codes)), [pw]);
  useEffect(() => {
    load();
  }, [load]);

  const set = (k, v) => setForm({ ...form, [k]: v });

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const r = await adminApi('/api/admin/codes', pw, 'POST', form);
      setCreated(r.code);
      setCopied(false);
      setForm({ ...form, label: '', code: '' });
      load();
    } catch (er) {
      setError(er.message);
    }
  };

  const message = created ? `שלום! הקישור למשחק: ${location.origin}\nקוד הכניסה שלך: ${created}` : '';
  const copy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
  };

  // עריכה בתוך השורה (ימים / משחקים / מכסת תמונות)
  const saveEdit = async (c, field, d) => {
    setEditing(null);
    const url = '/api/admin/codes/' + c.code;
    try {
      if (field === 'days') await adminApi(url, pw, 'PATCH', { addDays: Number(d) || 0 });
      if (field === 'games') await adminApi(url, pw, 'PATCH', { maxGames: Number(d) || 0 });
      if (field === 'ai') await adminApi(url, pw, 'PATCH', { aiLimit: d === '' ? null : Number(d) });
      load();
    } catch (er) {
      alert(er.message);
    }
  };

  const action = async (c, a) => {
    const url = '/api/admin/codes/' + c.code;
    try {
      if (a === 'toggle') await adminApi(url, pw, 'PATCH', { active: !c.active });
      if (['days', 'games', 'ai'].includes(a)) return setEditing({ code: c.code, field: a });
      if (a === 'del') {
        if (!confirm('למחוק את הקוד ' + c.code + '?')) return;
        await adminApi(url, pw, 'DELETE');
      }
      load();
    } catch (er) {
      alert(er.message);
    }
  };

  const q = search.trim();
  const shown = codes.filter((c) => !q || c.code.includes(q) || (c.label || '').includes(q));

  return (
    <>
      <div className="su-card">
        <div className="su-card-head">
          <div>
            <h2>יצירת קוד ללקוחה</h2>
            <p>אחרי שקיבלת העברה בנקאית – יוצרים קוד ושולחים ללקוחה יחד עם הקישור.</p>
          </div>
        </div>
        <form className="ad-form" onSubmit={create}>
          <div className="full">
            <label className="ad-label">
              שם הלקוחה / הערה <small>למשל: רחל כהן – שולם 23/11</small>
            </label>
            <input type="text" value={form.label} onChange={(e) => set('label', e.target.value)} />
          </div>
          <div className="full">
            <label className="ad-label">
              קוד <small>אפשר להשאיר ריק – ייווצר מספר אקראי</small>
            </label>
            <input type="text" className="ltr" style={{ maxWidth: 320 }} value={form.code} onChange={(e) => set('code', e.target.value)} />
          </div>
          <div className="full">
            <label className="ad-label">תוקף</label>
            <Pick value={form.days} options={DAYS} unit="ימים" onChange={(v) => set('days', v)} />
          </div>
          <div className="full">
            <label className="ad-label">כמה משחקים אפשר ליצור עם הקוד</label>
            <Pick value={form.maxGames} options={GAMES} unit="משחקים" onChange={(v) => set('maxGames', v)} />
          </div>
          <div className="ad-submit">
            <button className="btn primary big">יצירת קוד ✨</button>
          </div>
        </form>
        <p className="error">{error}</p>

        {created && (
          <div className="ad-created">
            <div>
              ✓ נוצר הקוד <span className="code">{created}</span>
            </div>
            <textarea rows="3" readOnly value={message} onClick={(e) => e.target.select()} />
            <div className="row">
              <button className="btn gold" onClick={copy}>
                {copied ? '✓ הועתק' : '📋 העתקת ההודעה ללקוחה'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="su-card">
        <div className="su-card-head">
          <div>
            <h2>הקודים</h2>
            <p>{codes.length} קודים</p>
          </div>
        </div>
        <div className="su-search ad-search">
          <span className="ic">🔍</span>
          <input type="text" placeholder="חיפוש לפי קוד או שם…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="ad-codes">
          {shown.map((c) => {
            const expired = c.expires_at && c.expires_at < Date.now();
            return (
              <div key={c.code} className={`ad-code ${c.active && !expired ? '' : 'off'}`}>
                <div className="c">{c.code}</div>
                <div>
                  <div className="lbl">{c.label || <span className="muted">ללא שם</span>}</div>
                  <div className="meta">
                    <span>🎮 {c.games_used}{c.max_games ? ` מתוך ${c.max_games}` : ''} משחקים</span>
                    <span>📅 {c.expires_at ? (expired ? 'פג תוקף ב-' : 'בתוקף עד ') + fmt(c.expires_at) : 'ללא הגבלת זמן'}</span>
                    <span>📷 {c.ai_used} מתוך {c.ai_limit_effective} קריאות החודש</span>
                    <span>נוצר {fmt(c.created_at)}</span>
                    {!c.active && <span className="tag opt">מושבת</span>}
                  </div>
                </div>
                <div className="acts">
                  {editing?.code === c.code && (
                    <InlineInput
                      type="number"
                      width={90}
                      label={{ days: 'כמה ימים להוסיף? (0 = ללא הגבלה)', games: `מספר משחקים כולל (0 = ללא הגבלה), נוצלו ${c.games_used}`, ai: 'קריאות תמונה בחודש (ריק = ברירת מחדל)' }[editing.field]}
                      initial={{ days: 30, games: c.max_games || 0, ai: c.ai_limit ?? '' }[editing.field]}
                      onSave={(d) => saveEdit(c, editing.field, d)}
                      onCancel={() => setEditing(null)}
                    />
                  )}
                  <button className="btn small" onClick={() => action(c, 'days')}>+ימים</button>
                  <button className="btn small" onClick={() => action(c, 'games')}>משחקים</button>
                  <button className="btn small" onClick={() => action(c, 'ai')}>📷 מכסה</button>
                  <button className="btn small" onClick={() => action(c, 'toggle')}>{c.active ? 'השבתה' : 'הפעלה'}</button>
                  <button className="btn small danger" onClick={() => action(c, 'del')}>מחיקה</button>
                </div>
              </div>
            );
          })}
          {!shown.length && <div className="su-empty">אין קודים להצגה</div>}
        </div>
      </div>
    </>
  );
}
