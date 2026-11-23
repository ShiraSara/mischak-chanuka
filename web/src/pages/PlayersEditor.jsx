import { useRef, useState } from 'react';
import { readPlayersFile, downloadTemplate } from '../lib/importPlayers.js';

export const MAX_PLAYERS = 15;
const START_ROWS = 5;

export const emptyPlayers = () => Array.from({ length: START_ROWS }, () => ({ name: '', phone: '' }));

const phoneDigits = (p) => p.replace(/\D/g, '');
const phoneBad = (p) => p.trim() && (phoneDigits(p).length < 9 || phoneDigits(p).length > 12);

// שלב 1: רשימת המשתתפות – מתחילה ב-5 שורות, אפשר להוסיף עד 15 או לייבא מאקסל
export default function PlayersEditor({ players, setPlayers }) {
  const [drag, setDrag] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef(null);
  const rowsRef = useRef(null);

  const update = (i, field, value) => setPlayers(players.map((p, j) => (j === i ? { ...p, [field]: value } : p)));
  const remove = (i) => {
    const next = players.filter((_, j) => j !== i);
    setPlayers(next.length ? next : emptyPlayers());
  };
  const add = () => {
    if (players.length >= MAX_PLAYERS) return;
    setPlayers([...players, { name: '', phone: '' }]);
    setTimeout(() => rowsRef.current?.querySelector('.su-player:last-child input')?.focus(), 0);
  };

  // Enter בשם → טלפון, Enter בטלפון → השורה הבאה (או שורה חדשה)
  const onKey = (e, i, field) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = [...rowsRef.current.querySelectorAll('input')];
    const idx = i * 2 + (field === 'phone' ? 1 : 0);
    if (field === 'phone' && i === players.length - 1) return add();
    inputs[idx + 1]?.focus();
  };

  const importFile = async (file) => {
    if (!file) return;
    setImportMsg('');
    try {
      const list = await readPlayersFile(file);
      if (!list.length) return setImportMsg('⚠️ לא נמצאו שמות בקובץ');
      const filled = players.filter((p) => p.name.trim() || p.phone.trim());
      if (filled.length && !confirm(`להחליף את ${filled.length} המשתתפות שכבר הוקלדו ברשימה מהקובץ?`)) return;
      const cut = list.slice(0, MAX_PLAYERS);
      setPlayers(cut);
      setImportMsg(
        `✓ יובאו ${cut.length} משתתפות` + (list.length > MAX_PLAYERS ? ` (בקובץ היו ${list.length} – נלקחו ${MAX_PLAYERS} הראשונות)` : '')
      );
    } catch (er) {
      setImportMsg('⚠️ ' + (er.message || 'לא הצלחתי לקרוא את הקובץ'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const named = players.filter((p) => p.name.trim()).length;
  const phones = players.map((p) => phoneDigits(p.phone)).filter(Boolean);
  const dup = phones.find((d, i) => phones.indexOf(d) !== i);

  return (
    <div className="su-card">
      <div className="su-card-head">
        <div>
          <h2>מי משתתפת?</h2>
          <p>כל אחת מקבלת מספר. הטלפון לא חובה, אבל איתו המערכת מזהה אותה לבד כשהיא מתקשרת.</p>
        </div>
        <span className="su-count">
          {named} / {MAX_PLAYERS}
        </span>
      </div>

      <div className="su-players" ref={rowsRef}>
        {players.map((p, i) => (
          <div className="su-player" key={i}>
            <span className="num">{i + 1}</span>
            <div className="su-field">
              <span className="ic">👤</span>
              <input
                type="text"
                value={p.name}
                placeholder="שם"
                onChange={(e) => update(i, 'name', e.target.value)}
                onKeyDown={(e) => onKey(e, i, 'name')}
              />
            </div>
            <div className={`su-field phone ${phoneBad(p.phone) ? 'bad' : ''}`}>
              <span className="ic">📞</span>
              <input
                type="tel"
                className="ltr"
                value={p.phone}
                placeholder="טלפון (לא חובה)"
                onChange={(e) => update(i, 'phone', e.target.value)}
                onKeyDown={(e) => onKey(e, i, 'phone')}
              />
            </div>
            <button className="su-x" title="הסרה" onClick={() => remove(i)}>
              ✕
            </button>
          </div>
        ))}
      </div>
      {players.some((p) => phoneBad(p.phone)) && <div className="su-warn">יש מספר טלפון שנראה לא תקין (מסומן באדום)</div>}
      {dup && <div className="su-warn">אותו מספר טלפון מופיע פעמיים</div>}

      <button className="su-add" onClick={add} disabled={players.length >= MAX_PLAYERS}>
        {players.length >= MAX_PLAYERS ? `הגעת למקסימום – ${MAX_PLAYERS} משתתפות` : '+ הוספת משתתפת'}
      </button>

      <div
        className={`su-import ${drag ? 'drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          importFile(e.dataTransfer.files[0]);
        }}
      >
        <span className="big-ic">📊</span>
        <div className="txt">
          <b>יש לך רשימה באקסל?</b>
          <span>
            גררי לכאן את הקובץ או לחצי לבחירה. עמודה של שמות ועמודה של טלפונים.{' '}
            <button className="su-link" onClick={downloadTemplate}>
              הורדת קובץ לדוגמה
            </button>
          </span>
          {importMsg && <div style={{ marginTop: 6, fontWeight: 500 }}>{importMsg}</div>}
        </div>
        <button className="btn" onClick={() => fileRef.current.click()}>
          בחירת קובץ
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(e) => importFile(e.target.files[0])}
        />
      </div>
    </div>
  );
}
