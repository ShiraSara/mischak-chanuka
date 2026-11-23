import { useEffect, useState } from 'react';
import { getPrefs, setPrefs } from '../lib/prefs.js';
import { hebrewVoices, onVoicesChanged, speak } from '../lib/narrator.js';
import { music } from '../lib/music.js';

function Switch({ checked, onChange }) {
  return (
    <label className="su-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

// הגדרות מנגינה וקריין (נשמרות במחשב של המארחת)
export default function AudioSettings() {
  const [p, setP] = useState(getPrefs);
  const [voices, setVoices] = useState(hebrewVoices);
  const [playing, setPlaying] = useState(false);
  const set = (patch) => setP(setPrefs(patch));

  useEffect(() => onVoicesChanged(() => setVoices(hebrewVoices())), []);
  // לא להשאיר דוגמה מתנגנת כשיוצאים מהמסך
  useEffect(() => () => music.setMode('off'), []);

  const sampleMusic = () => {
    if (playing) {
      music.setMode('off');
      return setPlaying(false);
    }
    music.unlock();
    music.setVolume(p.musicVolume);
    music.setTension(0.3);
    music.setMode('question');
    setPlaying(true);
  };

  return (
    <>
      <div className="su-set-row">
        <div>
          <b>🎵 מנגינת רקע</b>
          <small>מנגינת מתח שמאיצה כשהזמן נגמר, וחגיגית בתוצאות. אפשר לכבות גם באמצע המשחק</small>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <button className="btn small" onClick={sampleMusic}>
            {playing ? '⏹ עצירה' : '▶ השמעה'}
          </button>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={p.musicVolume}
            title="עוצמה"
            style={{ width: 110 }}
            onChange={(e) => {
              set({ musicVolume: Number(e.target.value) });
              music.setVolume(Number(e.target.value));
            }}
          />
          <Switch checked={p.music} onChange={(v) => set({ music: v })} />
        </div>
      </div>

      <div className="su-set-row">
        <div>
          <b>🎙️ קריין</b>
          <small>מקריא כל שאלה כשהיא עולה על המסך</small>
        </div>
        <div className="row" style={{ gap: 12 }}>
          {voices.length > 0 && (
            <>
              <select value={p.voice || voices[0].name} onChange={(e) => set({ voice: e.target.value })} style={{ width: 'auto', maxWidth: 260 }}>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name.replace(/Microsoft |Google |Online \(Natural\) - /g, '')}
                  </option>
                ))}
              </select>
              <button className="btn small" onClick={() => speak('שאלה מספר אחת. מי הכי מצחיקה בחבורה?', { voiceName: p.voice })}>
                🔊 דוגמה
              </button>
            </>
          )}
          <Switch checked={p.narrator} onChange={(v) => set({ narrator: v })} />
        </div>
      </div>
      {p.narrator && voices.length === 0 && (
        <div className="note" style={{ margin: '0 0 8px' }}>
          במחשב או בדפדפן הזה לא נמצא קול בעברית. מומלץ לפתוח את המשחק בדפדפן <b>Microsoft Edge</b> – יש בו קולות עבריים טבעיים.
        </div>
      )}
      {p.narrator && (
        <div className="su-set-row">
          <div>
            <b>🏆 להקריא גם את המנצחות</b>
            <small>"והזוכה היא… שרה!", וגם את טבלת המובילות</small>
          </div>
          <Switch checked={p.readWinners} onChange={(v) => set({ readWinners: v })} />
        </div>
      )}
    </>
  );
}
