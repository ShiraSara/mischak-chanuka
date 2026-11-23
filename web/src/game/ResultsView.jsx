import { useEffect, useState } from 'react';
import Confetti from './Confetti.jsx';
import { playSound } from '../lib/sound.js';
import { resultsCaption } from './captions.js';

// תוצאות: כתר למנצחת, עמודות שגדלות, קונפטי ותרועה
export default function ResultsView({ state, soundOn }) {
  const g = state.game;
  const res = state.results || [];
  const top = res[0]?.count || 0;
  const winners = top ? res.filter((r) => r.count === top) : [];
  const max = Math.max(1, top);
  const [grown, setGrown] = useState(false);
  const [party, setParty] = useState(top > 0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    if (top > 0 && soundOn) playSound('fanfare');
    const t = setTimeout(() => setParty(false), 4500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // רק בפעם הראשונה שהתוצאות של השאלה מוצגות
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zero = res.filter((r) => r.count === 0);
  return (
    <>
      <div className="q-counter">
        שאלה {g.qIndex + 1} מתוך {g.total} · {state.votesCount} הצבעות
      </div>
      <div className="q-title small">{state.question.text}</div>
      <div className="winner-banner">
        {winners.length === 0 ? (
          <span className="no-winner">אף אחת לא הצביעה 🤷‍♀️</span>
        ) : (
          <span className={`winner-sticker ${winners.length > 1 ? 'tie' : ''}`}>
            <span className="crown">👑</span>
            <span className="wname">
              {winners.length === 1 ? winners[0].label : 'תיקו! ' + winners.map((w) => w.label).join(' · ')}
            </span>
          </span>
        )}
      </div>
      {(() => {
        const c = resultsCaption({ results: res, votes: state.votesCount, type: state.question.type, qIndex: g.qIndex });
        return c ? <div className="fun-caption results">{c}</div> : null;
      })()}
      <div className="bars">
        {res
          .filter((r) => r.count > 0)
          .map((r, i) => (
            <div key={r.n} className={`bar-row tone${i % 4} ${r.count === top ? 'win' : ''}`}>
              <span className="lbl">{r.label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: grown ? (r.count / max) * 100 + '%' : 0 }} />
              </div>
              <span className="cnt">{r.count}</span>
            </div>
          ))}
      </div>
      {zero.length > 0 && <p className="no-votes">ללא קולות: {zero.map((r) => r.label).join(' · ')}</p>}
      {party && <Confetti />}
    </>
  );
}
