import { useEffect, useRef, useState } from 'react';
import { adminApi } from './adminApi.js';

const mb = (n) => (n / 1024 / 1024).toFixed(1) + 'MB';

// מנגינות למשחק: מעלים קבצי שמע, והם מופיעים לבחירה בהגדרות של כל משחק
export default function MusicPanel({ pw }) {
  const [tracks, setTracks] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [ask, setAsk] = useState(null);
  const fileRef = useRef(null);

  const load = () => adminApi('/api/admin/music', pw).then((d) => setTracks(d.tracks));
  useEffect(() => {
    load().catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = async (files) => {
    setErr('');
    for (const f of files) {
      if (!f.type.startsWith('audio/')) {
        setErr(`"${f.name}" אינו קובץ שמע`);
        continue;
      }
      setBusy(`מעלה את "${f.name}"…`);
      const name = f.name.replace(/\.[^.]+$/, '');
      const r = await fetch('/api/admin/music?name=' + encodeURIComponent(name), {
        method: 'POST',
        headers: { 'content-type': f.type, 'x-admin-password': pw },
        body: f,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error || 'ההעלאה נכשלה');
      else setTracks(d.tracks);
    }
    setBusy('');
    fileRef.current.value = '';
  };
  const rename = async (t, name) => {
    if (!name.trim() || name === t.name) return;
    const d = await adminApi('/api/admin/music/' + t.id, pw, 'PATCH', { name });
    setTracks(d.tracks);
  };
  const remove = async (t) => {
    setAsk(null);
    const d = await adminApi('/api/admin/music/' + t.id, pw, 'DELETE');
    setTracks(d.tracks);
  };

  return (
    <div className="su-card">
      <div className="su-card-head">
        <div>
          <h2>🎵 מנגינות למשחק</h2>
          <p>מעלים קבצי שמע (mp3), והם מופיעים לבחירה בהגדרות של כל משחק – בהכנה ובפאנל ⚙️ במשחק עצמו.</p>
        </div>
        <button className="btn primary" disabled={!!busy} onClick={() => fileRef.current.click()}>
          ⬆️ העלאת מנגינה
        </button>
        <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={(e) => upload([...e.target.files])} />
      </div>
      {busy && <div className="note">{busy}</div>}
      {err && <p className="error">⚠️ {err}</p>}
      <div className="mu-list">
        {tracks.map((t) => (
          <div className="mu-row" key={t.id}>
            <span className="ic">🎶</span>
            <input type="text" defaultValue={t.name} onBlur={(e) => rename(t, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
            <span className="muted">{mb(t.size)}</span>
            <audio
              controls
              preload="metadata"
              src={'/music/' + t.id}
              onPlay={() => setErr('')}
              onError={(e) => setErr(`הדפדפן לא הצליח לנגן את "${t.name}" (קוד ${e.currentTarget.error?.code ?? '?'}). נסי לרענן עם Ctrl+F5 או בדפדפן אחר.`)}
            />
            {ask === t.id ? (
              <span className="bp-confirm">
                למחוק?
                <button className="btn small danger" onClick={() => remove(t)}>
                  כן
                </button>
                <button className="btn small ghost" onClick={() => setAsk(null)}>
                  לא
                </button>
              </span>
            ) : (
              <button className="su-x" title="מחיקה" onClick={() => setAsk(t.id)}>
                🗑️
              </button>
            )}
          </div>
        ))}
        {!tracks.length && !busy && <div className="su-empty">עוד אין מנגינות. לוחצים "העלאת מנגינה" ובוחרים קובץ mp3.</div>}
      </div>
      <p className="muted mu-note">💡 חשוב: להעלות רק מוזיקה שמותר להשתמש בה במשחק מסחרי (בלי זכויות יוצרים, או ברישיון). עד 20MB לקובץ.</p>
    </div>
  );
}
