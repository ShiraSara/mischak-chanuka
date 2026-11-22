import { useEffect, useRef, useState } from 'react';
import { api, getToken } from '../lib/api.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

// מפרק את התשובה של השרת (בפורמט של ימות המשיח) לטקסט שאפשר להציג
function parseResponse(text) {
  const lines = [];
  let varName = null;
  let maxDigits = 99;
  let hangup = false;
  const speak = (m) => m.split('.').map((x) => x.replace(/^[tn]-/, '')).join(' ');
  for (const part of text.split('&').filter(Boolean)) {
    const [cmd, ...rest] = part.split('=');
    if (cmd === 'id_list_message') lines.push(speak(rest.join('=')));
    if (cmd === 'read') {
      lines.push(speak(rest[0]));
      const opts = rest[1].split(',');
      varName = opts[0];
      maxDigits = Number(opts[2]) || 99;
    }
    if (cmd === 'go_to_folder' && rest[0] === 'hangup') hangup = true;
  }
  if (hangup) lines.push('— השיחה נותקה —');
  return { lines, varName, maxDigits, hangup };
}

// סימולטור טלפון: מדמה שיחה לימות המשיח בדיוק כמו טלפון כשר
export default function SimApp() {
  const gameId = new URLSearchParams(location.search).get('game');
  const [players, setPlayers] = useState([]);
  const [who, setWho] = useState('');
  const [screen, setScreen] = useState(['לחצי "חיוג" כדי להתחיל']);
  const [typed, setTyped] = useState('');
  const [raw, setRaw] = useState('');
  const call = useRef(null); // { vals, varName, maxDigits }

  useEffect(() => {
    if (!getToken() || !gameId) return setScreen(['צריך לפתוח את הסימולטור מתוך מסך המשחק']);
    api(`/api/games/${gameId}`).then((s) => {
      setPlayers(s.players);
      const first = s.players.find((p) => p.hasPhone);
      setWho(first ? String(first.num) : '');
    });
  }, [gameId]);

  const send = async () => {
    const c = call.current;
    try {
      const r = await api(`/api/games/${gameId}/sim`, {
        method: 'POST',
        body: { params: c.vals, simPlayer: who ? Number(who) : null },
      });
      setRaw(r.response);
      const p = parseResponse(r.response);
      setScreen(p.lines);
      setTyped('');
      if (p.hangup) call.current = null;
      else Object.assign(c, { varName: p.varName, maxDigits: p.maxDigits });
    } catch (er) {
      setScreen([er.message]);
    }
  };

  const dial = () => {
    call.current = { vals: { ApiCallId: 'sim-' + Math.random().toString(36).slice(2), ApiDID: '0770000000', ApiExtension: '1' } };
    send();
  };
  const hang = async () => {
    if (!call.current) return;
    call.current.vals.hangup = 'yes';
    await send();
    setScreen(['— השיחה נותקה —']);
    call.current = null;
  };
  const submit = (value) => {
    const c = call.current;
    if (!c?.varName) return;
    c.vals[c.varName] = value;
    send();
  };
  const press = (k) => {
    if (!call.current?.varName) return;
    if (k === '#') return submit(typed);
    const next = k === '*' ? '' : typed + k;
    setTyped(next);
    // ימות המשיח מסיימת אוטומטית כשמגיעים למספר הספרות המקסימלי
    if (next.length >= call.current.maxDigits) submit(next);
  };

  return (
    <div className="wrap" style={{ maxWidth: 520 }}>
      <h1 className="brand-title" style={{ fontSize: '1.8rem' }}>סימולטור טלפון</h1>
      <p className="sub">מדמה שיחה למערכת הטלפונית בדיוק כמו טלפון כשר. אפשר לפתוח כמה לשוניות כדי לדמות כמה משתתפות.</p>
      <div className="card">
        <label>
          מתקשרת מהמספר:
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            {players.map((p) => (
              <option key={p.num} value={p.hasPhone ? String(p.num) : ''} disabled={!p.hasPhone}>
                {p.num}. {p.name}
                {p.hasPhone ? '' : ' (אין טלפון רשום)'}
              </option>
            ))}
            <option value="">מספר לא מזוהה / חסוי</option>
          </select>
        </label>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={dial}>📞 חיוג</button>
          <button className="btn danger" onClick={hang}>ניתוק</button>
        </div>
      </div>
      <div className="phone">
        <div className="screen">
          {screen.map((l, i) => (
            <div className="say" key={i}>🔊 {l}</div>
          ))}
          <div className="typed">{typed}</div>
        </div>
        <div className="keys">
          {KEYS.map((k) => (
            <button key={k} onClick={() => press(k)}>{k}</button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10, justifyContent: 'center' }}>
          <button className="btn small" title="מדמה מצב שלא הקישו כלום עד שנגמר זמן ההמתנה" onClick={() => submit('None')}>
            ⌛ לא הקשתי (המתנה)
          </button>
        </div>
      </div>
      <details>
        <summary className="muted">מה השרת שולח לימות המשיח (לבדיקה טכנית)</summary>
        <div className="raw">{raw}</div>
      </details>
    </div>
  );
}
