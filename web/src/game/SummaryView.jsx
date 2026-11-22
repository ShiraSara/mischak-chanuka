export default function SummaryView({ state }) {
  return (
    <>
      <div className="q-title">🏆 הסיכום הגדול 🏆</div>
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
