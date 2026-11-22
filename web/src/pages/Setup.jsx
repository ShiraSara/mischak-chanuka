import { useEffect, useState } from 'react';
import { api, shuffle, withId } from '../lib/api.js';
import PlayersEditor, { loadSavedPlayers } from './PlayersEditor.jsx';
import QuestionsEditor from './QuestionsEditor.jsx';
import SettingsPanel, { DEFAULT_SETTINGS } from './SettingsPanel.jsx';

export default function Setup({ me, hasOpenGame, onResume, onCreated, onLogout }) {
  const [players, setPlayers] = useState(loadSavedPlayers);
  const [questions, setQuestions] = useState([]);
  const [custom, setCustom] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/questions').then((r) => {
      setQuestions(r.questions.map((q) => withId({ ...q, on: true })));
      setCustom(r.custom);
    });
  }, []);

  const create = async () => {
    setError('');
    let qs = questions.filter((q) => q.on && q.text.trim());
    if (settings.shuffle) qs = shuffle(qs);
    const bad = qs.find((q) => q.type === 'options' && q.options.length < 2);
    if (bad) return setError(`בשאלה "${bad.text}" צריך לפחות 2 אפשרויות`);
    setBusy(true);
    try {
      const r = await api('/api/games', {
        method: 'POST',
        body: {
          players: players.filter((p) => p.name.trim()),
          questions: qs.map(({ text, type, options }) => ({ text, type, options })),
          settings: {
            timerSec: Number(settings.timerSec) || 0,
            allowSelfVote: settings.allowSelfVote,
            autoReveal: settings.autoReveal,
            showVoters: settings.showVoters,
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

  return (
    <div className="wrap">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <h1 className="brand-title">הכנת משחק</h1>
          <p className="sub">{sub}</p>
        </div>
        <div className="row">
          {hasOpenGame && (
            <button className="btn ghost" onClick={onResume}>
              חזרה למשחק הפתוח
            </button>
          )}
          <button className="btn ghost" onClick={onLogout}>
            יציאה
          </button>
        </div>
      </div>

      <PlayersEditor players={players} setPlayers={setPlayers} />
      <QuestionsEditor questions={questions} setQuestions={setQuestions} custom={custom} setCustom={setCustom} />
      <SettingsPanel settings={settings} setSettings={setSettings} />

      <p className="error">{error}</p>
      <div style={{ textAlign: 'center' }}>
        <button className="btn primary big" onClick={create} disabled={busy}>
          יצירת המשחק ←
        </button>
      </div>
    </div>
  );
}
