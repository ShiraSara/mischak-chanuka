import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { playSound } from '../lib/sound.js';
import CurtainLabel from './CurtainLabel.jsx';
import QuestionView from './QuestionView.jsx';
import ResultsView from './ResultsView.jsx';
import SummaryView from './SummaryView.jsx';
import Controls from './Controls.jsx';
import FitBox from './FitBox.jsx';
import BoardView from './BoardView.jsx';
import SettingsDrawer from './SettingsDrawer.jsx';
import { useGameAudio } from './useGameAudio.js';
import { setPrefs } from '../lib/prefs.js';
import { stopAll } from '../lib/narrator.js';

const CURTAIN_MS = 1100; // משך סגירת הווילון
const HOLD_MS = 1300; // כמה זמן הווילון נשאר סגור עם "שאלה N"
const TOPIC_EXTRA_MS = 1600; // עוד זמן כשמתחיל נושא חדש

// כל שאלה היא "סצנה". בין סצנות הווילון נסגר ונפתח.
const sceneOf = (s) => {
  const p = s.game.phase;
  if (p === 'lobby' || p === 'ended') return p;
  return (p === 'board' ? 'b' : 'q') + s.game.qIndex;
};

export default function Game({ gameId, me, onExit }) {
  const [state, setState] = useState(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('seker_sound') !== 'off');
  const [curtain, setCurtainState] = useState({ closed: true, label: null });
  const [shownScene, setShownScene] = useState('');
  const [drawer, setDrawer] = useState(false);
  // סרגל הכפתורים מוסתר – מופיע בלחיצה או כשהעכבר מגיע לתחתית, ונעלם לבד
  const [controlsShown, setControlsShown] = useState(false);
  const hideTimer = useRef(null);
  const showControls = (ms = 4000) => {
    setControlsShown(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsShown(false), ms);
  };
  const [error, setError] = useState('');
  const errTimer = useRef(null);
  const showError = (msg) => {
    setError(msg);
    clearTimeout(errTimer.current);
    errTimer.current = setTimeout(() => setError(''), 5000);
  };
  const drawerRef = useRef(false);
  drawerRef.current = drawer;

  const closedRef = useRef(true);
  const targetRef = useRef('');
  const timerRef = useRef(null);
  const snapRef = useRef(null); // מצב המשחק שמוצג כרגע על הבמה (לא מתחלף באמצע מעבר וילון)
  const stateRef = useRef(null);
  const pollRef = useRef(null); // משיכת מצב מיידית (ומשם ממשיכים בקצב החדש)
  stateRef.current = state;

  const setCurtain = (next) => {
    closedRef.current = next.closed;
    setCurtainState(next);
  };

  // משיכת מצב המשחק מהשרת. הקצב לפי השלב:
  // במשחק – כל שנייה · בהמתנה לפני ההתחלה – כל 2 שניות · אחרי הסיום – כל 30 שניות
  // לשונית מוסתרת – לאט יותר (5 שניות באמצע משחק, כדי שמשחק אוטומטי ימשיך להתקדם)
  useEffect(() => {
    let alive = true;
    let t;
    const delay = () => {
      const phase = stateRef.current?.game.phase;
      const live = phase && phase !== 'lobby' && phase !== 'ended';
      if (document.hidden) return live ? 5000 : 30000;
      if (live || !phase) return 1000;
      return phase === 'lobby' ? 2000 : 30000;
    };
    const load = async () => {
      clearTimeout(t);
      try {
        const s = await api(`/api/games/${gameId}`);
        if (!alive) return;
        setClockOffset(s.serverNow - Date.now());
        setState(s);
        stateRef.current = s;
      } catch (er) {
        if (alive && er.message.includes('לא נמצא')) onExit(true);
      }
      if (alive) t = setTimeout(load, delay());
    };
    // חוזרים ללשונית – מתעדכנים מיד
    const onVis = () => !document.hidden && load();
    document.addEventListener('visibilitychange', onVis);
    pollRef.current = load;
    load();
    return () => {
      alive = false;
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
      clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // מעברי וילון כשהסצנה משתנה
  useEffect(() => {
    if (!state) return;
    const scene = sceneOf(state);
    if (scene === targetRef.current) return;
    targetRef.current = scene;
    clearTimeout(timerRef.current);

    if (scene === 'lobby') {
      setCurtain({ closed: true, label: { kind: 'lobby' } });
      setShownScene('lobby');
      return;
    }
    const label =
      scene === 'ended'
        ? { kind: 'ended' }
        : scene.startsWith('b')
        ? { kind: 'board' }
        : {
            kind: 'question',
            index: state.game.qIndex,
            total: state.game.total,
            topic: state.question?.topicChanged ? state.question.topic : null, // מעבר לנושא חדש
          };
    const wasClosed = closedRef.current;
    setCurtain({ closed: true, label });
    timerRef.current = setTimeout(() => {
      setShownScene(scene);
      setCurtain({ closed: false, label });
    }, (wasClosed ? 0 : CURTAIN_MS) + HOLD_MS + (label.topic ? TOPIC_EXTRA_MS : 0));
  }, [state]);

  if (state && sceneOf(state) === shownScene) snapRef.current = state;
  const view = shownScene && shownScene !== 'lobby' ? snapRef.current : null;
  const transitioning = !!state && sceneOf(state) !== shownScene; // הווילון באמצע מעבר לסצנה הבאה
  // כתיבה מראש של "מה למדתי עלייך?": ברגע שמוצגות התוצאות של השאלה האחרונה,
  // שולחים ל-AI ברקע – כך שבמסך הסיום הכרטיסים כבר מוכנים
  const prefetched = useRef(false);
  useEffect(() => {
    const g = state?.game;
    if (!g || prefetched.current || g.settings.profiles === false) return;
    if (g.phase === 'results' && g.qIndex === g.total - 1) {
      prefetched.current = true;
      api(`/api/games/${gameId}/profiles`, { method: 'POST', body: {} }).catch(() => (prefetched.current = false));
    }
  }, [state, gameId]);
  const allConnected = !!state?.players.length && state.players.every((p) => p.connected);
  const audio = useGameAudio({ view, upcoming: state, shownScene, curtainClosed: curtain.closed, transitioning, clockOffset });

  const act = async (action) => {
    if (soundOn) playSound('unlock'); // הדפדפן מאפשר קול רק אחרי לחיצה
    if (action === 'setup') {
      return onExit(state.game.phase === 'ended');
    }
    if (action === 'sound') {
      const next = !soundOn;
      setSoundOn(next);
      localStorage.setItem('seker_sound', next ? 'on' : 'off');
      if (next) playSound('tick');
      return;
    }
    if (action === 'open_settings') return setDrawer(true);
    if (action === 'music') return setPrefs({ music: !audio.music });
    if (action === 'narrator') {
      if (audio.narrator) stopAll();
      return setPrefs({ narrator: !audio.narrator });
    }
    if (action === 'fullscreen') return document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    if (action === 'sim') return window.open(`/sim.html?game=${gameId}`, '_blank');
    try {
      setState(await api(`/api/games/${gameId}/action`, { method: 'POST', body: { action } }));
      setTimeout(() => pollRef.current?.(), 300);
    } catch (er) {
      showError(er.message);
    }
  };
  const actRef = useRef(act);
  actRef.current = act;

  // רווח / Enter מקדמים את המשחק
  useEffect(() => {
    const onKey = (e) => {
      const s = stateRef.current;
      if (!s || drawerRef.current || e.target.matches('input, textarea, button, select')) return;
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      const p = s.game.phase;
      if (p === 'lobby') actRef.current('start');
      else if (p === 'question') actRef.current('reveal');
      else if (p === 'results') actRef.current('next');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  let content = null;
  if (view) {
    const phase = view.game.phase;
    if (phase === 'question') content = <QuestionView state={view} clockOffset={clockOffset} soundOn={soundOn} />;
    else if (phase === 'results') content = <ResultsView key={'r' + view.game.qIndex} state={view} soundOn={soundOn} />;
    else if (phase === 'board') content = <BoardView state={view} soundOn={soundOn} />;
    else if (phase === 'ended') content = <SummaryView state={view} soundOn={soundOn} />;
  }

  return (
    <section
      id="view-game"
      onClick={(e) => {
        if (e.target.closest('.controls, .drawer-back, button, input, select, a')) return;
        controlsShown ? setControlsShown(false) : showControls();
      }}
      onMouseMove={(e) => e.clientY > window.innerHeight - 90 && showControls()}
    >
      <div className={`stage ${curtain.closed ? 'closed' : ''}`}>
        <div className="game-main enter" key={shownScene}>
          {content && <FitBox>{content}</FitBox>}
        </div>
        {/* עצירה / המשך – כפתור קטן בצד, זמין תמיד במהלך המשחק */}
        {state && !['lobby', 'ended'].includes(state.game.phase) && (
          <button
            className={`side-pause ${state.game.pausedAt ? 'paused' : ''}`}
            title={state.game.pausedAt ? 'המשך המשחק' : 'עצירת המשחק'}
            onClick={() => act(state.game.pausedAt ? 'resume' : 'pause')}
          >
            {state.game.pausedAt ? '▶' : '⏸'}
          </button>
        )}
        {state?.game.pausedAt && state.game.phase !== 'question' && <div className="paused-banner">⏸ המשחק בהפסקה</div>}
        {/* חיווי התקדמות בצד המסך: שאלה N מתוך M */}
        {view && ['question', 'results', 'board'].includes(view.game.phase) && (
          <div className="side-progress" aria-label={`שאלה ${view.game.qIndex + 1} מתוך ${view.game.total}`}>
            <span className="k">שאלה</span>
            <b>{view.game.qIndex + 1}</b>
            <span className="k">מתוך {view.game.total}</span>
            <span className="bar">
              <i style={{ height: `${((view.game.qIndex + 1) / view.game.total) * 100}%` }} />
            </span>
          </div>
        )}
        <div className="curtain left" />
        <div className="curtain right" />
        <div className="valance" />
        <div className="curtain-label">
          <CurtainLabel label={curtain.label} state={state} onStart={state?.game.phase === 'lobby' ? () => act('start') : null} />
        </div>
        {/* מספר הטלפון להתחברות: בפתיחה – בתחתית; בזמן המשחק – קטן בפינה. כשכולן מחוברות – נעלם (וחוזר אם מישהי התנתקה) */}
        {!allConnected && (
          <div className={`stage-info ${shownScene === 'lobby' || !shownScene ? 'lobby' : 'corner'} ${controlsShown ? 'raised' : ''}`}>
            <span className="phone-box">
              <span className="ph-ic">☎</span>
              <span className="ph-lbl">התחברות</span>
              {me?.phoneInfo ? <b className="ph-num">{me.phoneInfo}</b> : <span>למספר המשחק</span>}
            </span>
          </div>
        )}
      </div>
      {error && <div className="game-toast">⚠️ {error}</div>}
      {drawer && state && (
        <SettingsDrawer
          game={state.game}
          players={state.players}
          onPlayer={async (action, payload) => {
            try {
              setState(await api(`/api/games/${gameId}/action`, { method: 'POST', body: { action, ...payload } }));
              return true;
            } catch (er) {
              showError(er.message);
              return false;
            }
          }}
          soundOn={soundOn}
          onToggleSound={() => act('sound')}
          onClose={() => setDrawer(false)}
          onChange={async (patch) => {
            try {
              setState(await api(`/api/games/${gameId}/action`, { method: 'POST', body: { action: 'settings', settings: patch } }));
            } catch (er) {
              showError(er.message);
            }
          }}
        />
      )}
      {state && (
        <div
          className={`controls-wrap ${controlsShown || drawer ? '' : 'hidden'}`}
          onMouseEnter={() => (setControlsShown(true), clearTimeout(hideTimer.current))}
          onMouseLeave={() => showControls(2500)}
        >
          <Controls game={state.game} soundOn={soundOn} audio={audio} onAction={act} clockOffset={clockOffset} />
        </div>
      )}
    </section>
  );
}
