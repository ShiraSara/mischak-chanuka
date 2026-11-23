import { useState } from 'react';
import ThemePicker from '../lib/ThemePicker.jsx';
import AutoBadge from './AutoBadge.jsx';

// כפתורי השליטה בתחתית המסך – משתנים לפי שלב המשחק
export default function Controls({ game, soundOn, onAction, clockOffset }) {
  const [palette, setPalette] = useState(false);
  const last = game.qIndex + 1 >= game.total;
  // כפתור ראשי גדול, כל השאר קטנים – שהכל ייכנס בשורה אחת
  const B = (a, label, cls = '', title) => (
    <button key={a} title={title} className={`btn ${cls.includes('big') ? cls : cls + ' small'}`} onClick={() => onAction(a)}>
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
      B('reopen', 'פתיחה מחדש'),
      B('restart_question', 'איפוס'),
      B('end', 'סיום המשחק', 'danger'),
    ];
  else if (game.phase === 'board')
    main = [B('next', 'השאלה הבאה ←', 'primary big'), B('prev', '→ חזרה לתוצאות'), B('end', 'סיום המשחק', 'danger')];
  else main = [B('setup', 'משחק חדש', 'primary big')];

  // מצב אוטומטי: ספירה + עצירה / הפעלה מחדש
  const auto = game.settings.autoPlay;
  const live = game.phase !== 'lobby' && game.phase !== 'ended';
  const autoCtl = live && (
    <span className="auto-ctl" key="auto">
      {auto && game.autoAt && <AutoBadge at={game.autoAt} clockOffset={clockOffset} />}
      {auto ? B('auto_off', '⏸ עצירה') : B('auto_on', '⏩ אוטומטי')}
    </span>
  );

  return (
    <div className="controls">
      {main}
      {autoCtl}
      <span style={{ position: 'relative' }}>
        <button className={`btn small ${palette ? 'gold' : 'ghost'}`} onClick={() => setPalette(!palette)}>
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
      {B('fullscreen', '⛶', 'ghost', 'מסך מלא')}
      {B('sim', '📱', 'ghost', 'סימולטור טלפון (בדיקה)')}
    </div>
  );
}
