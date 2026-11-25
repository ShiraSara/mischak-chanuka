import { useEffect, useState } from 'react';
import ProfilesShow from './ProfilesShow.jsx';
import Confetti from './Confetti.jsx';
import { playSound } from '../lib/sound.js';
import { printSummary } from '../lib/summaryPdf.js';
import { api } from '../lib/api.js';

const TO_PROFILES_SEC = 10; // כמה שניות המנצחת על המסך לפני "מה למדתי עלייך?"

// סוף המשחק: מסך ניצחון חגיגי, סיכום PDF, ואחרי כמה שניות – מעבר לבד לכרטיסים האישיים
export default function SummaryView({ state, soundOn }) {
  const profilesOn = state.game.settings.profiles !== false;
  const [stage, setStage] = useState('winner'); // winner | profiles
  const [seen, setSeen] = useState(false); // כבר ראו את הכרטיסים – לא עוברים שוב לבד
  const [left, setLeft] = useState(TO_PROFILES_SEC);

  useEffect(() => {
    if (stage === 'winner' && soundOn) playSound('fanfare');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    if (stage !== 'winner' || !profilesOn || seen) return;
    if (left <= 0) return setStage('profiles');
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, left, profilesOn, seen]);

  // סיכום PDF: הדירוג, מי ניצחה בכל שאלה, והכרטיסים של ה-AI (אם כבר נכתבו – נשמרים, בלי פנייה נוספת)
  const pdf = async () => {
    let profiles = null;
    if (profilesOn) profiles = (await api(`/api/games/${state.game.id}/profiles`, { method: 'POST', body: {} }).catch(() => null))?.profiles || null;
    printSummary(state, profiles);
  };

  if (stage === 'profiles')
    return (
      <ProfilesShow
        gameId={state.game.id}
        title={state.game.settings.title}
        onPdf={pdf}
        soundOn={soundOn}
        onClose={() => {
          setSeen(true);
          setStage('winner');
        }}
      />
    );

  const ranking = state.scores?.ranking || [];
  const topPts = ranking[0]?.points || 0;
  const winners = topPts > 0 ? ranking.filter((p) => p.points === topPts) : [];
  const next = ranking.filter((p) => !winners.includes(p) && p.points > 0).slice(0, 2);
  const fastest = state.scores?.fastest;

  return (
    <div className="end-wrap win-stage">
      <Confetti full />
      <div className="end-kicker">🎊 סוף המשחק{state.game.settings.title ? ` · ${state.game.settings.title}` : ''}</div>

      {winners.length ? (
        <div className="win-hero">
          <div className="win-rays" />
          <div className="win-trophy">🏆</div>
          <div className="win-kicker">{winners.length > 1 ? '🎉 תיקו! והמנצחות הן… 🎉' : '🎉 והמנצחת היא… 🎉'}</div>
          <div className={`win-name ${winners.length > 1 ? 'many' : ''}`}>{winners.map((w) => w.name).join(' & ')}</div>
          <div className="win-pts">{topPts} נקודות</div>
        </div>
      ) : (
        <div className="win-hero">
          <div className="win-rays" />
          <div className="win-trophy">🎉</div>
          <div className="win-name many">תודה ששיחקתן!</div>
        </div>
      )}

      {(next.length > 0 || fastest) && (
        <div className="end-more">
          {next.map((p) => (
            <span key={p.num} className="end-pill">
              {p.points === next[0].points ? '🥈' : '🥉'} {p.name} · {p.points}
            </span>
          ))}
          {fastest && <span className="end-pill fast">⚡ הכי מהירה: {fastest.name}</span>}
        </div>
      )}

      <div className="end-actions">
        <button className="btn gold" onClick={pdf}>
          📄 סיכום המשחק (PDF)
        </button>
        {profilesOn && (
          <button className="btn primary" onClick={() => setStage('profiles')}>
            ✨ אז מה למדתי עלייך?
          </button>
        )}
      </div>
      {profilesOn && !seen && <div className="end-next">ממשיכות בעוד {left}…</div>}
    </div>
  );
}
