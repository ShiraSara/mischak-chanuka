import { BRAND } from '../lib/theme.js';
import Wave from '../lib/Wave.jsx';

// מה שמופיע על ה"דלתות" כשהן סגורות
export default function CurtainLabel({ label, state, phone }) {
  if (!label) return null;
  if (label.kind === 'lobby' && state) {
    const g = state.game;
    const conn = state.players.filter((p) => p.connected).length;
    return (
      <>
        <div className="lobby-brand">
          <div className="marquee">{BRAND}</div>
          <Wave />
        </div>
        {phone && (
          <div className="lobby-phone">
            <span>☎ מתקשרות למספר</span>
            <b>{phone}</b>
          </div>
        )}
        <div className="lobby-chips">
          {state.players.map((p) => (
            <span key={p.num} className={`lchip ${p.connected ? 'on' : ''}`}>
              <b>{p.num}</b>
              {p.name}
            </span>
          ))}
        </div>
        <div className="curtain-sub small">
          {conn} מתוך {state.players.length} מחוברות · {g.total} שאלות מחכות לכן
        </div>
        {g.settings.boardEvery > 0 && (
          <div className="curtain-sub small">🏆 מי שמצביעה כמו הרוב – וגם מהר – צוברת נקודות!</div>
        )}
      </>
    );
  }
  if (label.kind === 'question')
    return (
      <div className="q-sticker">
        <div className="k">שאלה</div>
        <div className="marquee big">{label.index + 1}</div>
        <div className="k">מתוך {label.total}</div>
      </div>
    );
  if (label.kind === 'board')
    return (
      <div className="q-sticker">
        <div className="marquee">🏆</div>
        <div className="k" style={{ marginTop: 6, fontSize: '2.2rem', fontWeight: 900 }}>טבלת המובילות</div>
      </div>
    );
  if (label.kind === 'ended')
    return (
      <div className="q-sticker">
        <div className="marquee">🎊 סוף המשחק</div>
        <div className="k" style={{ marginTop: 10 }}>ועכשיו... הסיכום!</div>
      </div>
    );
  return null;
}
