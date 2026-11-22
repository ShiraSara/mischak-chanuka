export const MAX_PLAYERS = 15;

export function loadSavedPlayers() {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem('seker_players')) || [];
  } catch {
    /* ignore */
  }
  return Array.from({ length: MAX_PLAYERS }, (_, i) => ({ name: saved[i]?.name || '', phone: saved[i]?.phone || '' }));
}

// טבלת המשתתפות – נשמרת בדפדפן לפעם הבאה
export default function PlayersEditor({ players, setPlayers }) {
  const update = (i, field, value) => {
    const next = players.map((p, j) => (j === i ? { ...p, [field]: value } : p));
    setPlayers(next);
    localStorage.setItem('seker_players', JSON.stringify(next));
  };
  const clear = () => {
    if (!confirm('לנקות את כל השמות והטלפונים?')) return;
    localStorage.removeItem('seker_players');
    setPlayers(loadSavedPlayers());
  };
  const count = players.filter((p) => p.name.trim()).length;

  return (
    <div className="card">
      <h2>
        <span className="step">1</span>המשתתפות (עד {MAX_PLAYERS})
      </h2>
      <p className="muted" style={{ marginTop: 0 }}>
        כל משתתפת מקבלת מספר. בטלפון היא תקיש את המספר של מי שהיא בוחרת. טלפון: מומלץ, כדי שהמערכת תזהה אותה אוטומטית כשהיא מתקשרת.
      </p>
      <div className="players-grid">
        <div className="head" />
        <div className="head">שם</div>
        <div className="head ph">טלפון</div>
        {players.map((p, i) => (
          <PlayerRow key={i} i={i} p={p} update={update} />
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn small" onClick={clear}>
          ניקוי הרשימה
        </button>
        <span className="muted">{count} משתתפות</span>
      </div>
    </div>
  );
}

function PlayerRow({ i, p, update }) {
  return (
    <>
      <div className="num">{i + 1}</div>
      <input type="text" value={p.name} placeholder={`שם משתתפת ${i + 1}`} onChange={(e) => update(i, 'name', e.target.value)} />
      <input
        type="tel"
        className="ltr phone-cell"
        value={p.phone}
        placeholder="050-0000000"
        onChange={(e) => update(i, 'phone', e.target.value)}
      />
    </>
  );
}
