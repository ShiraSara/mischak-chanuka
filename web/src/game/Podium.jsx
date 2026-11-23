// פודיום לשלוש הראשונות + המהירה ביותר + שאר הדירוג
export default function Podium({ scores, compact = false }) {
  if (!scores) return null;
  const { ranking, fastest } = scores;
  const top = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  // סדר על הפודיום: 2 – 1 – 3
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const place = (p) => ranking.indexOf(p) + 1;
  const medal = ['🥇', '🥈', '🥉'];

  return (
    <div className={`podium-wrap ${compact ? 'compact' : ''}`}>
      <div className="podium">
        {order.map((p) => (
          <div key={p.num} className={`pod pod-${place(p)}`}>
            <div className="pod-name">{p.name}</div>
            <div className="pod-pts">{p.points} נק׳</div>
            <div className="pod-block">
              <span>{medal[place(p) - 1]}</span>
              <b>{place(p)}</b>
            </div>
          </div>
        ))}
      </div>
      <div className="board-side">
        {fastest && (
          <div className="fast-card">
            <span className="bolt">⚡</span>
            <div>
              <small>הכי מהירה</small>
              <b>{fastest.name}</b>
              <small>ממוצע {fastest.avgSec} שניות להצבעה</small>
            </div>
          </div>
        )}
        {rest.length > 0 && (
          <ol className="rank-list" start={4}>
            {rest.map((p) => (
              <li key={p.num}>
                <span>{p.name}</span>
                <b>{p.points}</b>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
