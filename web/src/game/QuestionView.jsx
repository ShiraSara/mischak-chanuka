import TimerRing from './TimerRing.jsx';

export default function QuestionView({ state, clockOffset, soundOn }) {
  const g = state.game;
  const q = state.question;
  return (
    <>
      <div className="q-head">
        <div className="q-counter">
          שאלה {g.qIndex + 1} מתוך {g.total}
        </div>
        {g.settings.timerSec > 0 && (
          <TimerRing key={g.qIndex + '-' + g.qStartedAt} startedAt={g.qStartedAt} seconds={g.settings.timerSec} clockOffset={clockOffset} soundOn={soundOn} />
        )}
      </div>
      <div className="q-title">{q.text}</div>
      <div className="options">
        {q.options.map((o, i) => (
          <div className={`opt tone${i % 4}`} key={o.n}>
            <span className="n">{o.n}</span>
            <span className="lbl">{o.label}</span>
          </div>
        ))}
      </div>
      <div className="status-line">
        <span className="vote-count">
          הצביעו <b>{state.votesCount}</b> מתוך {state.players.length}
        </span>
        <span className="hint">מקישים את המספר ואחריו סולמית #</span>
      </div>
      {g.settings.showVoters && (
        <div className="voters">
          {state.players.map((p) => (
            <span key={p.num} className={`chip ${p.voted ? 'on' : ''}`}>
              {p.name}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
