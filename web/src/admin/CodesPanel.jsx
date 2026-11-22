import { useCallback, useEffect, useState } from 'react';
import { adminApi } from './adminApi.js';

const fmt = (t) => (t ? new Date(t).toLocaleDateString('he-IL') : '—');

// יצירת קודים ללקוחות וניהול הקודים הקיימים
export default function CodesPanel({ pw }) {
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState({ label: '', code: '', days: 30, maxGames: 1 });
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const load = useCallback(() => adminApi('/api/admin/codes', pw).then((r) => setCodes(r.codes)), [pw]);
  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const r = await adminApi('/api/admin/codes', pw, 'POST', form);
      setCreated(r.code);
      setForm({ ...form, label: '', code: '' });
      load();
    } catch (er) {
      setError(er.message);
    }
  };

  const action = async (c, a) => {
    const url = '/api/admin/codes/' + c.code;
    try {
      if (a === 'toggle') await adminApi(url, pw, 'PATCH', { active: !c.active });
      if (a === 'days') {
        const d = prompt('כמה ימים להוסיף? (0 = ללא הגבלה)', '30');
        if (d === null) return;
        await adminApi(url, pw, 'PATCH', { addDays: Number(d) });
      }
      if (a === 'games') {
        const d = prompt('מספר משחקים כולל (0 = ללא הגבלה). כרגע נוצלו ' + c.games_used, c.max_games || 0);
        if (d === null) return;
        await adminApi(url, pw, 'PATCH', { maxGames: Number(d) });
      }
      if (a === 'del') {
        if (!confirm('למחוק את הקוד ' + c.code + '?')) return;
        await adminApi(url, pw, 'DELETE');
      }
      load();
    } catch (er) {
      alert(er.message);
    }
  };

  const field = (k, label, props = {}) => (
    <label style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      {label}
      <input {...props} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </label>
  );

  return (
    <>
      <div className="card">
        <h2>יצירת קוד ללקוחה</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          אחרי שקיבלת העברה בנקאית – צרי קוד ושלחי ללקוחה יחד עם הקישור לאתר.
        </p>
        <form className="settings-grid" onSubmit={create}>
          {field('label', 'שם / הערה (למשל: רחל כהן – שולם 23/11)', { type: 'text' })}
          {field('code', 'קוד (ריק = מספר אקראי)', { type: 'text', className: 'ltr' })}
          {field('days', 'תוקף בימים (0 = ללא הגבלה)', { type: 'number', min: 0 })}
          {field('maxGames', 'מספר משחקים (0 = ללא הגבלה)', { type: 'number', min: 0 })}
          <div style={{ alignSelf: 'end' }}>
            <button className="btn primary">יצירת קוד</button>
          </div>
        </form>
        <p className="error">{error}</p>
        {created && (
          <div className="note">
            ✓ נוצר הקוד <span className="code-txt">{created}</span>
            <br />
            טקסט לשליחה ללקוחה:
            <br />
            <textarea
              rows="3"
              readOnly
              onClick={(e) => e.target.select()}
              value={`שלום! הקישור למשחק: ${location.origin}\nקוד הכניסה שלך: ${created}`}
            />
          </div>
        )}
      </div>

      <div className="card">
        <h2>הקודים</h2>
        <div style={{ overflow: 'auto' }}>
          <table className="admin">
            <thead>
              <tr>
                <th>קוד</th><th>שם / הערה</th><th>נוצר</th><th>בתוקף עד</th><th>משחקים</th><th>מצב</th><th />
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const expired = c.expires_at && c.expires_at < Date.now();
                return (
                  <tr key={c.code}>
                    <td><span className="code-txt">{c.code}</span></td>
                    <td>{c.label}</td>
                    <td>{fmt(c.created_at)}</td>
                    <td>
                      {c.expires_at ? fmt(c.expires_at) : 'ללא הגבלה'}{' '}
                      {expired && <span className="tag" style={{ background: '#fbeaea', color: '#c93c3c' }}>פג</span>}
                    </td>
                    <td>{c.games_used}{c.max_games ? ' / ' + c.max_games : ''}</td>
                    <td>{c.active ? <span className="tag">פעיל</span> : <span className="tag opt">מושבת</span>}</td>
                    <td className="row">
                      <button className="btn small" onClick={() => action(c, 'toggle')}>{c.active ? 'השבתה' : 'הפעלה'}</button>
                      <button className="btn small" onClick={() => action(c, 'days')}>+ימים</button>
                      <button className="btn small" onClick={() => action(c, 'games')}>שינוי משחקים</button>
                      <button className="btn small danger" onClick={() => action(c, 'del')}>מחיקה</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
