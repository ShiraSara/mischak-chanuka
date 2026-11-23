import { useState } from 'react';
import { adminApi } from './adminApi.js';

// בדיקת החיבור ל-Gemini: אילו דגמים זמינים למפתח, ובדיקה קצרה
export default function AiCheckPanel({ pw }) {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState(null);
  const run = async () => {
    setBusy(true);
    setR(null);
    try {
      setR(await adminApi('/api/admin/ai-check', pw, 'POST'));
    } catch (er) {
      setR({ ok: false, error: er.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="su-card">
      <div className="su-card-head">
        <div>
          <h2>🔌 חיבור ל-AI (קריאת תמונות וקריין)</h2>
          <p>בודק את המפתח של Gemini, אילו דגמים זמינים, ושולח שאלת בדיקה קצרה.</p>
        </div>
        <button className="btn primary" onClick={run} disabled={busy}>
          {busy ? 'בודקת…' : 'בדיקת חיבור'}
        </button>
      </div>
      {r && (
        <div className="ai-check">
          <div className={`ai-status ${r.ok ? 'ok' : 'bad'}`}>
            {r.ok ? `✓ עובד! ${r.test.model} ענה תוך ${(r.test.ms / 1000).toFixed(1)} שניות: "${r.test.answer}"` : '✕ לא עובד כרגע'}
          </div>
          {r.error && <p className="error">{r.error}</p>}
          {r.primary && (
            <p>
              דגם ראשי: <code>{r.primary}</code> {r.primaryAvailable === false ? '– ⚠️ לא זמין למפתח הזה' : r.primaryAvailable ? '– זמין' : ''}
            </p>
          )}
          {r.order && (
            <p>
              סדר הניסיונות: <code>{r.order.join(' → ') || '—'}</code>
            </p>
          )}
          {r.flashModels && (
            <p className="muted">
              דגמי Flash זמינים למפתח: <code>{r.flashModels.join(', ') || 'אין'}</code>
            </p>
          )}
          {r.listError && <p className="error">שגיאה ברשימת הדגמים: {r.listError}</p>}
          {'ttsOk' in r && (
            <div className={`ai-status ${r.ttsOk ? 'ok' : 'bad'}`} style={{ marginTop: 6 }}>
              🎙️ קריין AI: {r.ttsOk ? `עובד (${(r.ttsMs / 1000).toFixed(1)} שניות)` : `לא עובד – ${r.ttsError}`}
            </div>
          )}
          {r.ttsModels && (
            <p className="muted">
              דגמי קול זמינים: <code>{r.ttsModels.join(', ') || 'אין'}</code>
            </p>
          )}
          {r.ttsListError && <p className="error">שגיאה ברשימת דגמי הקול: {r.ttsListError}</p>}
          {r.failures && (
            <ul className="muted">
              {r.failures.map((f, i) => (
                <li key={i}>
                  <code>{f}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
