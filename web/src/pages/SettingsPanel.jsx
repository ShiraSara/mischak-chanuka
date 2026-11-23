export const DEFAULT_SETTINGS = { timerSec: 30, shuffle: false, allowSelfVote: true, autoReveal: false, showVoters: true, boardEvery: 3 };

const BOARDS = [[0, 'בלי'], [3, 'כל 3'], [4, 'כל 4'], [5, 'כל 5']];

import ThemePicker from '../lib/ThemePicker.jsx';

const TIMERS = [0, 15, 20, 30, 45, 60, 90];

function Switch({ checked, onChange }) {
  return (
    <label className="su-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

// שלב 3: הגדרות + סיכום לפני יצירת המשחק
export default function SettingsPanel({ settings, setSettings, playersCount, questionsCount }) {
  const set = (k, v) => setSettings({ ...settings, [k]: v });
  const row = (k, title, desc) => (
    <div className="su-set-row">
      <div>
        <b>{title}</b>
        <small>{desc}</small>
      </div>
      <Switch checked={settings[k]} onChange={(v) => set(k, v)} />
    </div>
  );

  // הערכה גסה: זמן הצבעה + וילון + הצגת תוצאות
  const perQ = (Number(settings.timerSec) || 30) + 25;
  const minutes = Math.max(1, Math.round((questionsCount * perQ) / 60));

  return (
    <div className="su-card">
      <div className="su-card-head">
        <div>
          <h2>כמה הגדרות אחרונות</h2>
          <p>אפשר להשאיר הכל כמו שזה ופשוט ליצור את המשחק.</p>
        </div>
      </div>

      <div className="su-set">
        <div className="su-set-row">
          <div>
            <b>⏱ טיימר לכל שאלה</b>
            <small>ספירה לאחור על המסך, עם צפצוף בשניות האחרונות</small>
          </div>
          <div className="su-timer">
            {TIMERS.map((t) => (
              <button key={t} className={Number(settings.timerSec) === t ? 'on' : ''} onClick={() => set('timerSec', t)}>
                {t === 0 ? 'בלי' : t}
              </button>
            ))}
          </div>
        </div>
        <div className="su-set-row">
          <div>
            <b>🏆 טבלת מובילות</b>
            <small>ניקוד למי שמצביעה כמו הרוב ובונוס למהירות – ומדי כמה שאלות מציגים מי מובילה ומי הכי מהירה</small>
          </div>
          <div className="su-timer">
            {BOARDS.map(([v, l]) => (
              <button key={v} className={Number(settings.boardEvery) === v ? 'on' : ''} onClick={() => set('boardEvery', v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="su-set-row">
          <div>
            <b>🎨 צבעי המשחק</b>
            <small>אפשר להחליף גם באמצע המשחק</small>
          </div>
          <ThemePicker />
        </div>
        {row('shuffle', '🔀 ערבוב סדר השאלות', 'השאלות יופיעו בסדר אקראי')}
        {row('allowSelfVote', '🙋‍♀️ מותר להצביע לעצמך', 'כשהתשובות הן שמות – אפשר לבחור גם בעצמך')}
        {row('autoReveal', '✨ תוצאות אוטומטיות', 'התוצאות יוצגו לבד כשכולן הצביעו או כשהזמן נגמר')}
        {row('showVoters', '✅ להראות מי כבר הצביעה', 'על המסך יופיע מי הצביעה – בלי לגלות מה היא בחרה')}
      </div>

      <div className="su-summary">
        <div>
          <b>{playersCount}</b>
          <span>משתתפות</span>
        </div>
        <div>
          <b>{questionsCount}</b>
          <span>שאלות</span>
        </div>
        <div>
          <b>{Number(settings.timerSec) || '—'}</b>
          <span>שניות לכל שאלה</span>
        </div>
        <div>
          <b>{minutes}</b>
          <span>דקות משחק (בערך)</span>
        </div>
      </div>
    </div>
  );
}
