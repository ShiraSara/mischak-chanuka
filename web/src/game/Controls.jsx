import { useState } from 'react';
import ThemePicker from '../lib/ThemePicker.jsx';

// כפתורי השליטה בתחתית המסך – משתנים לפי שלב המשחק
export default function Controls({ game, soundOn, onAction }) {
  const [palette, setPalette] = useState(false);
  const last = game.qIndex + 1 >= game.total;
  const B = (a, label, cls = '') => (
    <button key={a} className={`btn ${cls}`} onClick={() => onAction(a)}>
      {label}
    </button>
  );
  let main = [];
  if (game.phase === 'lobby') main = [B('start', 'מתחילות! ▶', 'primary big'), B('setup', 'חזרה להכנה', 'ghost')];
  else if (game.phase === 'question')
    main = [
      B('reveal', 'הצגת התוצאות', 'primary big'),
      game.qIndex > 0 && B('prev', '→ שאלה קודמת'),
      B('next', 'דילוג'),
      B('end', 'סיום המשחק', 'danger'),
    ];
  else if (game.phase === 'results')
    main = [
      B('next', last ? 'סיום וסיכום 🎊' : 'השאלה הבאה ←', 'primary big'),
      game.qIndex > 0 && B('prev', '→ שאלה קודמת'),
      B('reopen', 'פתיחה מחדש להצבעה'),
      B('restart_question', 'איפוס ההצבעות'),
      B('end', 'סיום המשחק', 'danger'),
    ];
  else if (game.phase === 'board')
    main = [B('next', 'השאלה הבאה ←', 'primary big'), B('prev', '→ חזרה לתוצאות'), B('end', 'סיום המשחק', 'danger')];
  else main = [B('setup', 'משחק חדש', 'primary big')];

  return (
    <div className="controls">
      {main}
      <span style={{ position: 'relative' }}>
        <button className={`btn ${palette ? 'gold' : 'ghost'}`} onClick={() => setPalette(!palette)}>
          🎨 צבעים
        </button>
        {palette && (
          <div className="palette-pop">
            <div className="ttl">בחרי צבעים למשחק</div>
            <ThemePicker compact />
          </div>
        )}
      </span>
      {B('sound', soundOn ? '🔊' : '🔇', 'ghost')}
      {B('fullscreen', '⛶ מסך מלא', 'ghost')}
      {B('sim', '📱 סימולטור', 'ghost')}
    </div>
  );
}
