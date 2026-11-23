import { useState } from 'react';
import Podium from './Podium.jsx';
import ProfilesShow from './ProfilesShow.jsx';

export default function SummaryView({ state, soundOn }) {
  const [show, setShow] = useState(false);
  if (show) return <ProfilesShow gameId={state.game.id} soundOn={soundOn} onClose={() => setShow(false)} />;
  return (
    <>
      <div className="q-title">🏆 הסיכום הגדול 🏆</div>
      {state.game.settings.title && <div className="q-counter" style={{ marginBottom: 10 }}>{state.game.settings.title}</div>}
      {state.game.settings.profiles !== false && (
        <div className="pf-cta">
          <button className="btn gold big" onClick={() => setShow(true)}>
            ✨ ועכשיו… מי את בעצם?
          </button>
        </div>
      )}
      {state.game.settings.boardEvery > 0 && <Podium scores={state.scores} compact />}
      <h3 className="sum-head">ומי ניצחה בכל שאלה?</h3>
      <div className="summary">
        {(state.summary || []).map((r, i) => (
          <div className="sum-row" key={i} style={{ animationDelay: i * 0.08 + 's' }}>
            <span>{r.text}</span>
            <span>
              {r.winners.length ? (
                <>
                  <b>{r.winners.join(' · ')}</b> <small>({r.top})</small>
                </>
              ) : (
                <small>אין הצבעות</small>
              )}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
