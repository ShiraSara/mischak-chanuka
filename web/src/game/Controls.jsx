// כפתורי השליטה בתחתית המסך – משתנים לפי שלב המשחק
export default function Controls({ game, soundOn, onAction }) {
  const last = game.qIndex + 1 >= game.total;
  const B = (a, label, cls = '') => (
    <button key={a} className={`btn ${cls}`} onClick={() => onAction(a)}>
      {label}
    </button>
  );
  let main = [];
  if (game.phase === 'lobby') main = [B('start', 'הרמת המסך ▶', 'primary big'), B('setup', 'חזרה להכנה', 'ghost')];
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
  else main = [B('setup', 'משחק חדש', 'primary big')];

  return (
    <div className="controls">
      {main}
      {B('sound', soundOn ? '🔊' : '🔇', 'ghost')}
      {B('fullscreen', '⛶ מסך מלא', 'ghost')}
      {B('sim', '📱 סימולטור', 'ghost')}
    </div>
  );
}
