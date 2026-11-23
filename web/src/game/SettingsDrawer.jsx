import { useState } from 'react';
import AudioSettings from '../pages/AudioSettings.jsx';
import ThemePicker from '../lib/ThemePicker.jsx';

const TIMERS = [0, 15, 20, 30, 45, 60, 90];
const HOLDS = [5, 8, 12, 20];
const BOARDS = [[0, 'בלי'], [5, 'כל 5'], [8, 'כל 8'], [10, 'כל 10']];

function Switch({ checked, onChange }) {
  return (
    <label className="su-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

function Chips({ value, options, onChange }) {
  return (
    <div className="su-timer">
      {options.map(([v, l]) => (
        <button key={v} className={Number(value) === v ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

// פאנל צדדי לשינוי הגדרות באמצע המשחק – כל שינוי נכנס לתוקף מיד
export default function SettingsDrawer({ game, soundOn, onToggleSound, onChange, onClose }) {
  const s = game.settings;
  const [saving, setSaving] = useState(false);
  const set = async (patch) => {
    setSaving(true);
    try {
      await onChange(patch);
    } finally {
      setSaving(false);
    }
  };
  const row = (title, desc, control) => (
    <div className="su-set-row">
      <div>
        <b>{title}</b>
        {desc && <small>{desc}</small>}
      </div>
      {control}
    </div>
  );

  return (
    <div className="drawer-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-label="הגדרות המשחק">
        <div className="drawer-head">
          <h2>⚙️ הגדרות</h2>
          <span className="muted">{saving ? 'שומרת…' : 'כל שינוי נכנס לתוקף מיד'}</span>
          <button className="su-x" title="סגירה" onClick={onClose}>
            ✕
          </button>
        </div>

        <h3 className="drawer-sec">🎮 המשחק</h3>
        <div className="su-set">
          {row(
            '⏱ טיימר לכל שאלה',
            game.phase === 'question' ? 'משנה גם את השאלה הנוכחית' : '',
            <Chips value={s.timerSec} options={TIMERS.map((t) => [t, t ? `${t}` : 'בלי'])} onChange={(v) => set({ timerSec: v })} />
          )}
          {row('⏩ משחק אוטומטי', 'תוצאות כשהזמן נגמר, ומעבר לבד לשאלה הבאה', <Switch checked={s.autoPlay} onChange={(v) => set({ autoPlay: v })} />)}
          {s.autoPlay &&
            row(
              '⏱ זמן הצגת התוצאות',
              'לפני המעבר לשאלה הבאה',
              <Chips value={s.resultsSec} options={HOLDS.map((t) => [t, `${t} שנ׳`])} onChange={(v) => set({ resultsSec: v })} />
            )}
          {row('🏆 טבלת מובילות', '', <Chips value={s.boardEvery} options={BOARDS} onChange={(v) => set({ boardEvery: v })} />)}
          {row('🙋‍♀️ מותר להצביע לעצמך', '', <Switch checked={s.allowSelfVote} onChange={(v) => set({ allowSelfVote: v })} />)}
          {row('✨ "מי את בעצם?" בסוף', 'כרטיס אישי לכל משתתפת', <Switch checked={s.profiles !== false} onChange={(v) => set({ profiles: v })} />)}
          {row('✅ להראות מי כבר הצביעה', '', <Switch checked={s.showVoters} onChange={(v) => set({ showVoters: v })} />)}
        </div>

        <h3 className="drawer-sec">🔊 שמע</h3>
        <div className="su-set">
          {row('🔔 צלילי משחק', 'שעון מתקתק, באזר וקונפטי', <Switch checked={soundOn} onChange={onToggleSound} />)}
          <AudioSettings live />
        </div>

        <h3 className="drawer-sec">🎨 צבעים</h3>
        <ThemePicker />
      </aside>
    </div>
  );
}
