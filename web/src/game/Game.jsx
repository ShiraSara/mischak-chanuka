import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { playSound } from '../lib/sound.js';
import CurtainLabel from './CurtainLabel.jsx';
import QuestionView from './QuestionView.jsx';
import ResultsView from './ResultsView.jsx';
import SummaryView from './SummaryView.jsx';
import Controls from './Controls.jsx';
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
  const drawerRef = useRef(false);
  drawerRef.current = drawer;

  const closedRef = useRef(true);
  const targetRef = useRef('');
  const timerRef = useRef(null);
  const snapRef = useRef(null); // מצב המשחק שמוצג כרגע על הבמה (לא מתחלף באמצע מעבר וילון)
  const stateRef = useRef(null);
  stateRef.current = state;

  const setCurtain = (next) => {
    closedRef.current = next.closed;
    setCurtainState(next);
  };

  // משיכת מצב המשחק מהשרת כל שנייה
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const s = await api(`/api/games/${gameId}`);
        if (!alive) return;
        setClockOffset(s.serverNow - Date.now());
        setState(s);
      } catch (er) {
        if (alive && er.message.includes('לא נמצא')) onExit(true);
      }
    };
    load();
    const t = setInterval(load, 1000);
    return () => {
      alive = false;
      clearInterval(t);
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
  const audio = useGameAudio({ view, upcoming: state, shownScene, curtainClosed: curtain.closed, transitioning, clockOffset });

  const act = async (action) => {
    if (soundOn) playSound('unlock'); // הדפדפן מאפשר קול רק אחרי לחיצה
    if (action === 'setup') {
      if (state.game.phase !== 'ended' && !confirm('לחזור למסך ההכנה? המשחק הנוכחי יישאר פתוח עד שתיצרי משחק חדש.')) return;
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
    if (action === 'end' && !confirm('לסיים את המשחק?')) return;
    if (action === 'restart_question' && !confirm('למחוק את כל ההצבעות לשאלה הזו?')) return;
    try {
      setState(await api(`/api/games/${gameId}/action`, { method: 'POST', body: { action } }));
    } catch (er) {
      alert(er.message);
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
          {content}
        </div>
        <div className="curtain left" />
        <div className="curtain right" />
        <div className="valance" />
        <div className="curtain-label">
          <CurtainLabel label={curtain.label} state={state} />
        </div>
        {/* מספר הטלפון: בפתיחה – בתחתית עם "התקשרו להצטרפות"; בזמן המשחק – קטן בפינה */}
        <div className={`stage-info ${shownScene === 'lobby' || !shownScene ? 'lobby' : 'corner'} ${controlsShown ? 'raised' : ''}`}>
          <span className="phone-box">
            <span className="ph-ic">☎</span>
            <span className="ph-lbl">{shownScene === 'lobby' || !shownScene ? 'התקשרו להצטרפות' : 'להצבעה'}</span>
            {me?.phoneInfo ? <b className="ph-num">{me.phoneInfo}</b> : <span>למספר המשחק</span>}
          </span>
        </div>
      </div>
      {drawer && state && (
        <SettingsDrawer
          game={state.game}
          soundOn={soundOn}
          onToggleSound={() => act('sound')}
          onClose={() => setDrawer(false)}
          onChange={async (patch) => {
            try {
              setState(await api(`/api/games/${gameId}/action`, { method: 'POST', body: { action: 'settings', settings: patch } }));
            } catch (er) {
              alert(er.message);
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
