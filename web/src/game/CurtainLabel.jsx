import { BRAND } from '../lib/theme.js';
import Wave from '../lib/Wave.jsx';

// מה שמופיע על ה"דלתות" כשהן סגורות
export default function CurtainLabel({ label, state }) {
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
        <div className="curtain-sub">
          מתקשרות ומצטרפות! קוד משחק: <b>{g.pin}</b>
        </div>
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
  if (label.kind === 'ended')
    return (
      <div className="q-sticker">
        <div className="marquee">🎊 סוף המשחק</div>
        <div className="k" style={{ marginTop: 10 }}>ועכשיו... הסיכום!</div>
      </div>
    );
  return null;
}
