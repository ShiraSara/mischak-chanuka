import { useEffect, useState } from 'react';
import AutoBadge from './AutoBadge.jsx';

// כפתורי השליטה בתחתית המסך – משתנים לפי שלב המשחק
import { FEATURES } from '../lib/features.js';

// פעולות שצריך לאשר – אישור קטן בתוך הסרגל (בלי חלון קופץ)
const CONFIRM = {
  end: 'לסיים את המשחק?',
  restart_question: 'למחוק את כל ההצבעות לשאלה הזו?',
  setup: 'לחזור למסך ההכנה? המשחק יישאר פתוח עד שתיצרי משחק חדש.',
};

export default function Controls({ game, soundOn, audio, onAction, clockOffset }) {
  const [ask, setAsk] = useState(null);
  useEffect(() => setAsk(null), [game.phase, game.qIndex]);
  const last = game.qIndex + 1 >= game.total;
  const needsConfirm = (a) => CONFIRM[a] && !(a === 'setup' && (game.phase === 'ended' || game.phase === 'lobby'));
  // כפתור ראשי גדול, כל השאר קטנים – שהכל ייכנס בשורה אחת
  const B = (a, label, cls = '', title) => (
    <button key={a} title={title} className={`btn ${cls.includes('big') ? cls : cls + ' small'}`} onClick={() => (needsConfirm(a) ? setAsk(a) : onAction(a))}>
      {label}
    </button>
  );
  if (ask)
    return (
      <div className="controls">
        <b className="ctl-ask">{CONFIRM[ask]}</b>
        <button className="btn danger" onClick={() => (setAsk(null), onAction(ask))}>
          כן
        </button>
        <button className="btn ghost" onClick={() => setAsk(null)}>
          ביטול
        </button>
      </div>
    );
  let main = [];
  if (game.phase === 'lobby') main = [B('start', 'START ▶', 'primary big'), B('setup', 'חזרה להכנה', 'ghost')];
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

  // עצירה / המשך בכל רגע (+ ספירה למעבר האוטומטי)
  const live = game.phase !== 'lobby' && game.phase !== 'ended';
  const autoCtl = live && (
    <span className="auto-ctl" key="auto">
      {game.autoAt && <AutoBadge at={game.autoAt} clockOffset={clockOffset} />}
      {game.pausedAt ? B('resume', '▶ המשך', 'gold') : B('pause', '⏸ עצירה')}
    </span>
  );

  return (
    <div className="controls">
      {main}
      {autoCtl}
      {B('open_settings', '⚙️ הגדרות', '', 'הגדרות המשחק')}
      {B('music', '🎵', audio?.music ? 'ghost' : 'ghost off', audio?.music ? 'כיבוי מנגינה' : 'הפעלת מנגינה')}
      {/* קריין וסימולטור – כבויים כרגע (lib/features.js) */}
      {FEATURES.narrator && B('narrator', '🎙️', audio?.narrator ? 'ghost' : 'ghost off', audio?.narrator ? 'כיבוי קריין' : 'הפעלת קריין')}
      {B('sound', soundOn ? '🔊' : '🔇', 'ghost', 'צלילי משחק')}
      {B('fullscreen', '⛶', 'ghost', 'מסך מלא')}
      {FEATURES.simulator && B('sim', '📱', 'ghost', 'סימולטור טלפון (בדיקה)')}
    </div>
  );
}
