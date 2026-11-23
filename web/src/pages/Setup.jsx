import { Fragment, useEffect, useState } from 'react';
import { api, shuffle, withId } from '../lib/api.js';
import PlayersEditor, { emptyPlayers } from './PlayersEditor.jsx';
import QuestionsEditor from './QuestionsEditor.jsx';
import SettingsPanel, { DEFAULT_SETTINGS } from './SettingsPanel.jsx';
import './setup.css';
import { BRAND } from '../lib/theme.js';
import Wave from '../lib/Wave.jsx';
import ThemePicker from '../lib/ThemePicker.jsx';

const STEPS = [
  { title: 'משתתפות', icon: '👥' },
  { title: 'שאלות', icon: '❓' },
  { title: 'הגדרות', icon: '⚙️' },
];

export default function Setup({ me, hasOpenGame, onResume, onCreated, onLogout }) {
  const [step, setStep] = useState(0);
  const [players, setPlayers] = useState(emptyPlayers); // רשימה חדשה לכל משחק
  const [questions, setQuestions] = useState([]);
  const [custom, setCustom] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [error, setError] = useState('');
  const [ai, setAi] = useState(me?.ai || null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    localStorage.removeItem('seker_players'); // ניקוי רשימה ישנה שנשמרה בגרסה קודמת
    api('/api/questions').then((r) => {
      setQuestions(r.questions.map((q) => withId({ ...q, on: true })));
      setCustom(r.custom);
    });
  }, []);

  const filled = players.filter((p) => p.name.trim());
  const chosen = questions.filter((q) => q.on && q.text.trim());

  const go = (i) => {
    setError('');
    setStep(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validate = () => {
    if (filled.length < 2) return [0, 'צריך לפחות 2 משתתפות'];
    const digits = filled.map((p) => p.phone.replace(/\D/g, '')).filter(Boolean);
    if (digits.some((d) => d.length < 9 || d.length > 12)) return [0, 'יש מספר טלפון לא תקין'];
    if (new Set(digits).size !== digits.length) return [0, 'אותו מספר טלפון מופיע פעמיים'];
    if (!chosen.length) return [1, 'צריך לבחור לפחות שאלה אחת'];
    const bad = chosen.find((q) => q.type === 'options' && q.options.length < 2);
    if (bad) return [1, `בשאלה "${bad.text}" צריך לפחות 2 תשובות`];
    return null;
  };

  const create = async () => {
    const problem = validate();
    if (problem) {
      setStep(problem[0]);
      return setError(problem[1]);
    }
    setError('');
    setBusy(true);
    try {
      const qs = settings.shuffle ? shuffle(chosen) : chosen;
      const r = await api('/api/games', {
        method: 'POST',
        body: {
          players: filled,
          questions: qs.map(({ text, type, options }) => ({ text, type, options })),
          settings: {
            timerSec: Number(settings.timerSec) || 0,
            allowSelfVote: settings.allowSelfVote,
            autoReveal: settings.autoReveal,
            showVoters: settings.showVoters,
            boardEvery: Number(settings.boardEvery) || 0,
            autoPlay: settings.autoPlay,
            resultsSec: Number(settings.resultsSec) || 5,
          },
        },
      });
      onCreated(r.id);
    } catch (er) {
      setError(er.message);
    } finally {
      setBusy(false);
    }
  };

  const sub = me
    ? (me.label ? me.label + ' · ' : '') + (me.gamesLeft == null ? 'ללא הגבלת משחקים' : `נותרו ${me.gamesLeft} משחקים בקוד`)
    : '';
  const stepInfo = [`${filled.length} משתתפות`, `${chosen.length} שאלות`, settings.timerSec ? `טיימר ${settings.timerSec} שניות` : 'בלי טיימר'];

  return (
    <div className="su">
      <header className="su-hero">
        <div className="su-hero-in">
          <div>
            <span className="sticker">{BRAND}</span>
            <h1>
              הכנת <em>משחק</em> חדש
            </h1>
            <Wave />
            <p>{sub}</p>
          </div>
          <div className="su-hero-side">
            <div className="row">
              {hasOpenGame && (
                <button className="btn small" onClick={onResume}>
                  ← חזרה למשחק הפתוח
                </button>
              )}
              <button className="btn ghost" onClick={onLogout}>
                יציאה
              </button>
            </div>
            <span className="lbl">🎨 הצבעים שלך</span>
            <ThemePicker compact />
          </div>
        </div>
      </header>

      <nav className="su-steps">
        {STEPS.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="su-line" />}
            <button className={`su-step ${step === i ? 'active' : ''} ${step > i ? 'done' : ''}`} onClick={() => go(i)}>
              <span className="dot">{step > i ? '✓' : i + 1}</span>
              <b>
                {s.icon} {s.title}
              </b>
              <small>{stepInfo[i]}</small>
            </button>
          </Fragment>
        ))}
      </nav>

      <main className="su-body">
        {step === 0 && <PlayersEditor players={players} setPlayers={setPlayers} />}
        {step === 1 && (
          <QuestionsEditor questions={questions} setQuestions={setQuestions} custom={custom} setCustom={setCustom} ai={ai} setAi={setAi} />
        )}
        {step === 2 && (
          <SettingsPanel settings={settings} setSettings={setSettings} playersCount={filled.length} questionsCount={chosen.length} />
        )}
      </main>

      <footer className="su-foot">
        <div className="su-foot-in">
          {step > 0 ? (
            <button className="btn" onClick={() => go(step - 1)}>
              → הקודם
            </button>
          ) : (
            <span style={{ width: 90 }} />
          )}
          <p className="error">{error}</p>
          {step < 2 ? (
            <button className="btn primary big" onClick={() => go(step + 1)}>
              הבא ←
            </button>
          ) : (
            <button className="btn primary big" onClick={create} disabled={busy}>
              {busy ? 'יוצרת…' : 'יצירת המשחק 🎉'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
