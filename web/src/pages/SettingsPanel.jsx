export const DEFAULT_SETTINGS = { timerSec: 10, shuffle: false, allowSelfVote: true, autoReveal: false, showVoters: true, boardEvery: 8, autoPlay: true, resultsSec: 5, title: '', profiles: true };

const BOARDS = [[0, 'בלי'], [5, 'כל 5'], [8, 'כל 8'], [10, 'כל 10']];
const HOLDS = [5, 8, 12, 20];

import ThemePicker from '../lib/ThemePicker.jsx';
import AudioSettings from './AudioSettings.jsx';


function Switch({ checked, onChange }) {
  return (
    <label className="su-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

// שלב 3: הגדרות + סיכום לפני יצירת המשחק
export default function SettingsPanel({ settings, setSettings, playersCount, questionsCount, minutesText }) {
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
            <b>🏷️ שם המשחק</b>
            <small>לא חובה – יופיע על המסך מתחת ל-Crazy girls. למשל: "יום ההולדת של שירה"</small>
          </div>
          <input
            type="text"
            value={settings.title}
            maxLength={60}
            placeholder="שם המשחק"
            style={{ maxWidth: 320 }}
            onChange={(e) => set('title', e.target.value)}
          />
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
        <AudioSettings />
        <div className="su-set-row">
          <div>
            <b>🎨 צבעי המשחק</b>
            <small>אפשר להחליף גם באמצע המשחק</small>
          </div>
          <ThemePicker />
        </div>
        {row('shuffle', '🔀 ערבוב סדר השאלות', 'בתוך כל נושא – השאלות יופיעו בסדר אקראי')}
        {row('profiles', '✨ "אז מה למדתי עלייך?" בסוף המשחק', 'כרטיס אישי לכל משתתפת עם משפט שנון שה-AI כותב לפי מה שהקבוצה בחרה בה')}
        {row('allowSelfVote', '🙋‍♀️ מותר להצביע לעצמך', 'כשהתשובות הן שמות – אפשר לבחור גם בעצמך')}
        {row(
          'autoPlay',
          '⏩ משחק אוטומטי',
          'כשהזמן של השאלה נגמר (או כשכולן הצביעו) התוצאות מוצגות לבד, ואחרי כמה שניות עוברים לשאלה הבאה'
        )}
        {settings.autoPlay && (
          <div className="su-set-row">
            <div>
              <b>⏱ כמה זמן להציג את התוצאות</b>
              <small>לפני המעבר לשאלה הבאה. אפשר לעצור באמצע המשחק בכפתור ⏸</small>
            </div>
            <div className="su-timer">
              {HOLDS.map((t) => (
                <button key={t} className={Number(settings.resultsSec) === t ? 'on' : ''} onClick={() => set('resultsSec', t)}>
                  {t} שנ׳
                </button>
              ))}
            </div>
          </div>
        )}
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
          <b>{minutesText}</b>
          <span>משך משוער (הטיימר של כל שאלה לפי המאגר)</span>
        </div>
      </div>
    </div>
  );
}
