import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { playSound } from '../lib/sound.js';
import Confetti from './Confetti.jsx';

const AUTO_MS = 9000;

// "ועכשיו… מי את בעצם?" – כרטיס אישי לכל משתתפת
export default function ProfilesShow({ gameId, soundOn, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    api(`/api/games/${gameId}/profiles`, { method: 'POST', body: {} })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [gameId]);

  const list = data?.profiles || [];
  const p = list[i];

  // צליל וקונפטי לכל כרטיס, ומעבר אוטומטי
  useEffect(() => {
    if (!p) return;
    if (soundOn) playSound('fanfare');
    if (!auto || i >= list.length - 1) return;
    const t = setTimeout(() => setI((x) => x + 1), AUTO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, data, auto]);

  // חיצים במקלדת
  useEffect(() => {
    const on = (e) => {
      if (e.key === 'ArrowLeft') (setAuto(false), setI((x) => Math.min(list.length - 1, x + 1)));
      if (e.key === 'ArrowRight') (setAuto(false), setI((x) => Math.max(0, x - 1)));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [list.length, onClose]);

  if (error)
    return (
      <div className="pf-wrap">
        <div className="pf-loading">😕 {error}</div>
        <button className="btn" onClick={onClose}>חזרה לסיכום</button>
      </div>
    );
  if (!data)
    return (
      <div className="pf-wrap">
        <div className="q-title">✨ ועכשיו… מי את בעצם?</div>
        <div className="pf-loading">
          ✍️ כותבות עליכן משהו<span className="dots" />
        </div>
      </div>
    );

  return (
    <div className="pf-wrap">
      <div className="pf-top">
        <span className="q-counter">
          ✨ מי את בעצם? · {i + 1} מתוך {list.length}
        </span>
        <span className="grow" />
        <button className="btn small ghost pf-btn" onClick={() => setAuto(!auto)}>
          {auto ? '⏸ עצירה' : '▶ אוטומטי'}
        </button>
        <button className="btn small ghost pf-btn" onClick={onClose}>
          ✕ חזרה לסיכום
        </button>
      </div>

      {p && (
        <div className="pf-card" key={p.num}>
          <div className="pf-name">{p.name}</div>
          {p.titles.length > 0 ? (
            <div className="pf-titles">
              {p.titles.map((t) => (
                <span key={t} className="pf-title">
                  👑 {t}
                </span>
              ))}
            </div>
          ) : (
            <div className="pf-titles">
              <span className="pf-title soft">🕵️‍♀️ אלופת ההפתעות</span>
            </div>
          )}
          <div className="pf-sentence">“{p.sentence}”</div>
          <Confetti />
        </div>
      )}

      <div className="pf-nav">
        <button className="btn" disabled={i === 0} onClick={() => (setAuto(false), setI(i - 1))}>
          → הקודמת
        </button>
        <div className="pf-dots">
          {list.map((x, j) => (
            <span key={x.num} className={j === i ? 'on' : ''} onClick={() => (setAuto(false), setI(j))} />
          ))}
        </div>
        {i < list.length - 1 ? (
          <button className="btn primary" onClick={() => (setAuto(false), setI(i + 1))}>
            הבאה ←
          </button>
        ) : (
          <button className="btn primary" onClick={onClose}>
            סיום 🎉
          </button>
        )}
      </div>
      {!data.ai && <p className="pf-note">הסיכומים נכתבו בלי AI (השירות לא היה זמין)</p>}
    </div>
  );
}
