import { useEffect } from 'react';
import Podium from './Podium.jsx';
import Confetti from './Confetti.jsx';
import { playSound } from '../lib/sound.js';

// מסך "טבלת המובילות" שמופיע כל כמה שאלות
export default function BoardView({ state, soundOn }) {
  const g = state.game;
  useEffect(() => {
    if (soundOn) playSound('fanfare');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <div className="q-counter">
        אחרי {g.qIndex + 1} שאלות מתוך {g.total}
      </div>
      <div className="q-title">🏆 טבלת המובילות</div>
      <Podium scores={state.scores} />
      <p className="score-note">100 נקודות למי שהצביעה כמו הרוב · עד 50 נקודות בונוס על מהירות</p>
      <Confetti />
    </>
  );
}
