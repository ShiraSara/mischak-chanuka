import { useEffect, useRef, useState } from 'react';
import { music } from '../lib/music.js';
import { speakWith, stopAll, prefetchAi } from '../lib/narrator.js';
import { usePrefs } from '../lib/prefs.js';
import { FEATURES } from '../lib/features.js';
import { getTracks, resolveStyle } from '../lib/tracks.js';

// מה הקריין אומר בכל שלב
function narrationFor(view) {
  const g = view.game;
  if (g.phase === 'question') {
    const q = view.question;
    let t = `שאלה ${g.qIndex + 1}. ${q.text}`;
    if (q.type === 'options') t += ' ' + q.options.map((o) => `${o.n}: ${o.label}`).join('. ');
    return { text: t, winners: false };
  }
  if (g.phase === 'results') {
    const res = view.results || [];
    const top = res[0]?.count || 0;
    const w = top ? res.filter((r) => r.count === top).map((r) => r.label) : [];
    if (!w.length) return { text: 'אף אחת לא הצביעה בשאלה הזו', winners: true };
    if (w.length > 1) return { text: `תיקו! ${w.slice(0, -1).join(', ')} ו${w[w.length - 1]}`, winners: true };
    return { text: view.question.type === 'names' ? `והזוכה היא... ${w[0]}!` : `התשובה המובילה... ${w[0]}!`, winners: true };
  }
  if (g.phase === 'board') {
    const s = view.scores;
    if (!s?.ranking?.length) return null;
    let t = `טבלת המובילות! במקום הראשון: ${s.ranking[0].name}, עם ${s.ranking[0].points} נקודות.`;
    if (s.fastest) t += ` והכי מהירה: ${s.fastest.name}!`;
    return { text: t, winners: true };
  }
  if (g.phase === 'ended') {
    const first = view.scores?.ranking?.[0];
    return {
      text: g.settings.boardEvery > 0 && first ? `סוף המשחק! המנצחת הגדולה היא... ${first.name}! תודה לכולן!` : 'סוף המשחק! תודה לכולן!',
      winners: true,
    };
  }
  return null;
}

// מנגינת רקע + קריין, לפי מה שמוצג על המסך
export function useGameAudio({ view, upcoming, shownScene, curtainClosed, transitioning, clockOffset }) {
  const prefs = usePrefs();
  const [unlocked, setUnlocked] = useState(false);
  const spokenRef = useRef('');

  // הדפדפן מאפשר קול רק אחרי לחיצה ראשונה
  useEffect(() => {
    const on = () => {
      music.unlock();
      setUnlocked(true);
    };
    document.addEventListener('pointerdown', on, { once: true });
    document.addEventListener('keydown', on, { once: true });
    return () => {
      document.removeEventListener('pointerdown', on);
      document.removeEventListener('keydown', on);
    };
  }, []);

  useEffect(() => music.setVolume(prefs.musicVolume), [prefs.musicVolume]);
  useEffect(() => {
    getTracks().then((tracks) => music.setStyle(resolveStyle(prefs.musicStyle, tracks)));
  }, [prefs.musicStyle]);

  // הכנת הקראת השאלה הבאה בקול AI מראש – בזמן שהווילון סגור
  const upcomingText = upcoming && upcoming.game.phase === 'question' ? narrationFor(upcoming)?.text : '';
  useEffect(() => {
    if (FEATURES.narrator && prefs.narrator && prefs.engine === 'ai' && upcomingText) prefetchAi(upcomingText, prefs.aiVoice);
  }, [upcomingText, prefs.narrator, prefs.engine, prefs.aiVoice]);

  // איזו מנגינה מתנגנת
  const phase = view?.game.phase;
  useEffect(() => {
    if (!prefs.music || !unlocked) return music.setMode('off');
    let mode = 'lobby';
    if (transitioning && curtainClosed) mode = 'roll'; // תופים בזמן שהווילון סגור – לפני חשיפה
    else if (shownScene && shownScene !== 'lobby') mode = curtainClosed ? 'roll' : phase === 'question' ? 'question' : 'results';
    music.setMode(mode);
  }, [prefs.music, unlocked, shownScene, curtainClosed, transitioning, phase]);

  // מתח: המנגינה מאיצה לקראת סוף הטיימר
  const qStart = view?.game.qStartedAt;
  const timerSec = view?.game.timerSec ?? view?.game.settings.timerSec;
  const pausedAt = view?.game.pausedAt;
  useEffect(() => {
    if (phase !== 'question' || !timerSec) return music.setTension(0.15);
    if (pausedAt) return music.setTension(0.15); // בעצירה – בלי מתח
    const t = setInterval(() => {
      const left = qStart + timerSec * 1000 - (Date.now() + clockOffset);
      music.setTension(1 - Math.max(0, Math.min(1, left / (timerSec * 1000))));
    }, 300);
    return () => clearInterval(t);
  }, [phase, qStart, timerSec, clockOffset, pausedAt]);

  // קריין: פעם אחת לכל שלב, אחרי שהווילון נפתח
  useEffect(() => {
    if (!view || curtainClosed || !unlocked) return;
    const key = `${shownScene}:${phase}`;
    if (spokenRef.current === key) return;
    spokenRef.current = key;
    if (!FEATURES.narrator || !prefs.narrator) return; // קריין כבוי כרגע (lib/features.js)
    const n = narrationFor(view);
    if (!n || (n.winners && !prefs.readWinners)) return;
    // רגע קטן אחרי האנימציה
    const t = setTimeout(
      () =>
        speakWith(prefs, n.text, {
          onStart: () => music.setDucked(true),
          onEnd: () => music.setDucked(false),
        }),
      phase === 'results' ? 900 : 500
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownScene, phase, curtainClosed, unlocked, prefs.narrator, prefs.readWinners, prefs.voice, prefs.engine, prefs.aiVoice]);

  // כשיוצאים מהמשחק – שקט
  useEffect(
    () => () => {
      music.setMode('off');
      stopAll();
    },
    []
  );

  return prefs;
}
