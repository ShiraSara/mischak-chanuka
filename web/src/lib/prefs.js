// העדפות שמע של המארחת (נשמרות במחשב שלה): מנגינה, קריין, קול
import { useEffect, useState } from 'react';

const KEY = 'seker_audio';
const DEFAULTS = { music: true, musicVolume: 0.5, musicStyle: 'quiz', narrator: true, engine: 'ai', aiVoice: 'Kore', voice: '', readWinners: true };

export function getPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setPrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('prefschange', { detail: next }));
  return next;
}

export function usePrefs() {
  const [p, setP] = useState(getPrefs);
  useEffect(() => {
    const on = (e) => setP(e.detail);
    window.addEventListener('prefschange', on);
    return () => window.removeEventListener('prefschange', on);
  }, []);
  return p;
}
