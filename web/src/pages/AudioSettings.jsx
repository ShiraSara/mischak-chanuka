import { useEffect, useState } from 'react';
import { getPrefs, setPrefs } from '../lib/prefs.js';
import { hebrewVoices, onVoicesChanged, speakWith, stopAll, AI_VOICES } from '../lib/narrator.js';
import { music, MUSIC_STYLES } from '../lib/music.js';

function Switch({ checked, onChange }) {
  return (
    <label className="su-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

const SAMPLE = 'שאלה מספר אחת. מי הכי מצחיקה בחבורה?';

// הגדרות מנגינה וקריין (נשמרות במחשב של המארחת)
// live = בתוך משחק פעיל: בלי כפתורי השמעה לדוגמה, והמנגינה של המשחק ממשיכה
export default function AudioSettings({ live = false }) {
  const [p, setP] = useState(getPrefs);
  const [voices, setVoices] = useState(hebrewVoices);
  const [playing, setPlaying] = useState(null); // סגנון שמתנגן כרגע
  const [sampleState, setSampleState] = useState('');
  const set = (patch) => setP(setPrefs(patch));

  useEffect(() => onVoicesChanged(() => setVoices(hebrewVoices())), []);
  useEffect(
    () => () => {
      if (live) return;
      music.setMode('off');
      stopAll();
    },
    [live]
  );

  const preview = (style) => {
    if (playing === style) {
      music.setMode('off');
      return setPlaying(null);
    }
    music.unlock();
    music.setVolume(p.musicVolume);
    music.setStyle(style);
    music.setTension(0.35);
    music.setMode('question', true);
    setPlaying(style);
  };

  const sample = async () => {
    setSampleState('loading');
    music.setDucked(true);
    await speakWith(p, SAMPLE, {
      onStart: () => setSampleState('playing'),
      onFallback: () => setSampleState('fallback'),
    });
    music.setDucked(false);
    setSampleState((s) => (s === 'fallback' ? 'fallback-done' : ''));
  };

  return (
    <>
      <div className="su-set-row">
        <div>
          <b>🎵 מנגינת רקע</b>
          <small>מאיצה כשהזמן נגמר, תופים לפני כל שאלה וחגיגית בתוצאות</small>
        </div>
        <div className="row" style={{ gap: 12 }}>
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
      {p.music && (
        <div className="styles-row">
          {MUSIC_STYLES.map((st) => (
            <div key={st.id} className={`style-card ${p.musicStyle === st.id ? 'on' : ''}`} onClick={() => set({ musicStyle: st.id })}>
              <span className="ic">{st.icon}</span>
              <b>{st.name}</b>
              {!live && (
                <button
                  className="btn small"
                  onClick={(e) => {
                    e.stopPropagation();
                    set({ musicStyle: st.id });
                    preview(st.id);
                  }}
                >
                  {playing === st.id ? '⏹' : '▶'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="su-set-row">
        <div>
          <b>🎙️ קריין</b>
          <small>מקריא כל שאלה כשהיא עולה על המסך</small>
        </div>
        <Switch checked={p.narrator} onChange={(v) => set({ narrator: v })} />
      </div>
      {p.narrator && (
        <div className="voice-box">
          <div className="su-seg">
            <button className={p.engine === 'ai' ? 'on' : ''} onClick={() => set({ engine: 'ai' })}>
              ✨ קול AI טבעי
            </button>
            <button className={p.engine !== 'ai' ? 'on' : ''} onClick={() => set({ engine: 'browser' })}>
              💻 קול המחשב
            </button>
          </div>
          {p.engine === 'ai' ? (
            <select value={p.aiVoice} onChange={(e) => set({ aiVoice: e.target.value })} style={{ width: 'auto' }}>
              {AI_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          ) : voices.length > 0 ? (
            <select value={p.voice || voices[0].name} onChange={(e) => set({ voice: e.target.value })} style={{ width: 'auto', maxWidth: 260 }}>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name.replace(/Microsoft |Google |Online \(Natural\) - /g, '')}
                </option>
              ))}
            </select>
          ) : null}
          <button className="btn small" onClick={sample} disabled={sampleState === 'loading'}>
            {sampleState === 'loading' ? '⏳ מכינה…' : '🔊 דוגמה'}
          </button>
          {sampleState.startsWith('fallback') && <span className="su-warn">קול ה-AI לא זמין כרגע – הושמע קול המחשב</span>}
        </div>
      )}
      {p.narrator && p.engine !== 'ai' && voices.length === 0 && (
        <div className="note" style={{ margin: '0 0 8px' }}>
          בדפדפן הזה אין קול בעברית. אפשר לבחור "קול AI טבעי", או לפתוח את המשחק ב-<b>Microsoft Edge</b>.
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
