import { useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { compressImage, parsePastedQuestions } from '../lib/image.js';

const MAX_IMAGES = 3;

// חלון ייבוא שאלות: מתמונה של דף (Claude קורא אותה) או מהדבקת טקסט
export default function ImportDialog({ ai, onClose, onAdd, onUsed }) {
  const [tab, setTab] = useState(ai?.enabled ? 'image' : 'text');
  const [images, setImages] = useState([]);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { questions: [...{on}], note }
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  const addFiles = async (files) => {
    setError('');
    const list = [...files].slice(0, MAX_IMAGES - images.length);
    try {
      const next = [];
      for (const f of list) next.push(await compressImage(f));
      setImages([...images, ...next]);
    } catch (er) {
      setError(er.message || 'לא הצלחתי לפתוח את התמונה');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const readImages = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/ai/import', {
        method: 'POST',
        body: { images: images.map(({ mediaType, data }) => ({ mediaType, data })) },
      });
      onUsed?.(r.left);
      if (!r.questions.length) setError(r.note || 'לא נמצאו שאלות בתמונה');
      else setResult({ questions: r.questions.map((q) => ({ ...q, on: true })), note: r.note });
    } catch (er) {
      setError(er.message);
    } finally {
      setBusy(false);
    }
  };

  const readText = () => {
    const qs = parsePastedQuestions(pasted);
    if (!qs.length) return setError('לא נמצאו שאלות בטקסט');
    setResult({ questions: qs.map((q) => ({ ...q, on: true })), note: '' });
  };

  const upd = (i, patch) => setResult({ ...result, questions: result.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const chosen = result?.questions.filter((q) => q.on && q.text.trim()) || [];

  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal">
        <div className="su-card-head">
          <div>
            <h2>📥 ייבוא שאלות</h2>
            <p>מצלמים דף עם שאלות או מדביקים רשימה – והשאלות נכנסות למשחק.</p>
          </div>
          <button className="su-x" title="סגירה" onClick={onClose} disabled={busy}>
            ✕
          </button>
        </div>

        {!result && (
          <>
            <div className="su-seg" style={{ marginBottom: 16 }}>
              <button className={tab === 'image' ? 'on' : ''} onClick={() => (setTab('image'), setError(''))}>
                📷 מתמונה
              </button>
              <button className={tab === 'text' ? 'on' : ''} onClick={() => (setTab('text'), setError(''))}>
                📋 הדבקת טקסט
              </button>
            </div>

            {tab === 'image' && !ai?.enabled && <div className="note">קריאת תמונות עוד לא הופעלה באתר. בינתיים אפשר להדביק טקסט.</div>}

            {tab === 'image' && ai?.enabled && (
              <>
                <div
                  className={`su-import ${drag ? 'drag' : ''}`}
                  style={{ marginTop: 0, cursor: 'pointer' }}
                  onClick={() => images.length < MAX_IMAGES && fileRef.current.click()}
                  onDragOver={(e) => (e.preventDefault(), setDrag(true))}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => (e.preventDefault(), setDrag(false), addFiles(e.dataTransfer.files))}
                >
                  <span className="big-ic">📷</span>
                  <div className="txt">
                    <b>צלמי או בחרי תמונה של הדף</b>
                    <span>
                      עד {MAX_IMAGES} תמונות. מודפס או בכתב יד – עדיף צילום ישר ומואר. נשארו החודש: <span style={{ fontWeight: 800, color: "var(--ink)" }}>{ai.left}</span> קריאות
                    </span>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    multiple
                    accept="image/*"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </div>
                {images.length > 0 && (
                  <div className="imp-thumbs">
                    {images.map((img, i) => (
                      <div className="imp-thumb" key={i}>
                        <img src={img.preview} alt={`תמונה ${i + 1}`} />
                        <button className="su-x" title="הסרה" onClick={() => setImages(images.filter((_, j) => j !== i))} disabled={busy}>
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === 'text' && (
              <>
                <textarea
                  rows="9"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder={'הדביקי כאן – כל שורה היא שאלה. למשל:\nמי הכי מצחיקה?\nמי תגיע אחרונה לחתונה?\nקפה או תה? | קפה, תה, שניהם'}
                />
                <p className="muted" style={{ fontSize: '.9rem', margin: '6px 0 0' }}>
                  לשאלה עם תשובות קבועות: אחרי השאלה כותבים <b>|</b> ואת התשובות מופרדות בפסיק.
                </p>
              </>
            )}

            <p className="error">{error}</p>
            <div className="row" style={{ justifyContent: 'flex-start' }}>
              {tab === 'image' ? (
                <button className="btn primary big" onClick={readImages} disabled={busy || !images.length || !ai?.enabled}>
                  {busy ? '🔍 קוראת את הדף…' : '✨ קריאת השאלות'}
                </button>
              ) : (
                <button className="btn primary big" onClick={readText} disabled={!pasted.trim()}>
                  המשך ←
                </button>
              )}
              {busy && <span className="muted">זה לוקח כמה שניות…</span>}
            </div>
          </>
        )}

        {result && (
          <>
            {result.note && <div className="note" style={{ marginBottom: 12 }}>ℹ️ {result.note}</div>}
            <p className="muted" style={{ marginTop: 0 }}>
              נמצאו {result.questions.length} שאלות. אפשר לתקן נוסח ולבטל סימון לפני ההוספה.
            </p>
            <div className="su-qlist" style={{ maxHeight: '48vh' }}>
              {result.questions.map((q, i) => (
                <div key={i} className={`su-q ${q.on ? 'on' : ''}`} style={{ gridTemplateColumns: '38px 1fr' }}>
                  <button className="su-tick" onClick={() => upd(i, { on: !q.on })}>
                    {q.on ? '✓' : ''}
                  </button>
                  <div>
                    <input className="su-q-text" type="text" value={q.text} onChange={(e) => upd(i, { text: e.target.value })} />
                    <div className="su-q-meta">
                      <span className={`su-type ${q.type === 'options' ? 'opt' : ''}`}>
                        {q.type === 'names' ? '👥 שמות המשתתפות' : '🔘 ' + q.options.join(' · ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <button
                className="btn primary big"
                disabled={!chosen.length}
                onClick={() => onAdd(chosen.map(({ text, type, options }) => ({ text: text.trim(), type, options })))}
              >
                הוספת {chosen.length} שאלות למשחק ✓
              </button>
              <button className="btn ghost" onClick={() => setResult(null)}>
                → חזרה
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
