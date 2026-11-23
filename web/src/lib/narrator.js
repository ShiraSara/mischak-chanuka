import { getToken } from './api.js';
// קריין – משתמש בקולות העבריים שמובנים במחשב (חינם). ב-Edge יש קולות טבעיים במיוחד.
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

export function hebrewVoices() {
  if (!synth) return [];
  const all = synth.getVoices().filter((v) => (v.lang || '').toLowerCase().startsWith('he'));
  // קולות "טבעיים" / אונליין קודם – הם נשמעים הרבה יותר טוב
  const score = (v) => (/natural|online|neural/i.test(v.name) ? 0 : 1);
  return all.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

// הקולות נטענים באיחור בחלק מהדפדפנים
export function onVoicesChanged(cb) {
  if (!synth) return () => {};
  synth.addEventListener('voiceschanged', cb);
  return () => synth.removeEventListener('voiceschanged', cb);
}

export function pickVoice(name) {
  const list = hebrewVoices();
  return list.find((v) => v.name === name) || list[0] || null;
}

export function stopSpeaking() {
  synth?.cancel();
}

// מקריא טקסט. מחזיר Promise שמסתיים כשההקראה נגמרת (או נכשלת)
export function speak(text, { voiceName, rate = 1, onStart, onEnd } = {}) {
  return new Promise((resolve) => {
    const voice = pickVoice(voiceName);
    if (!synth || !voice || !text) return resolve(false);
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang || 'he-IL';
    u.rate = rate;
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      onEnd?.();
      resolve(ok);
    };
    u.onstart = () => onStart?.();
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    // ביטחון: אם הדפדפן "נתקע" – לשחרר אחרי זמן סביר
    setTimeout(() => finish(false), 4000 + text.length * 150);
    synth.speak(u);
  });
}

// ---------- קול AI (Gemini) ----------

export const AI_VOICES = [
  { id: 'Kore', name: 'קורה – אישה, ברור' },
  { id: 'Aoede', name: 'איאודה – אישה, קליל' },
  { id: 'Leda', name: 'לדה – אישה, צעיר' },
  { id: 'Puck', name: 'פאק – גבר, אנרגטי' },
  { id: 'Charon', name: 'כארון – גבר, רגוע' },
  { id: 'Fenrir', name: 'פנריר – גבר, נלהב' },
];

const aiCache = new Map(); // טקסט+קול → כתובת הקלטה מוכנה
let currentAudio = null;

function fetchAi(text, voice) {
  const key = voice + '|' + text;
  if (!aiCache.has(key)) {
    const p = fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + getToken() },
      body: JSON.stringify({ text, voice }),
    }).then(async (r) => {
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'קול AI לא זמין');
      return URL.createObjectURL(await r.blob());
    });
    p.catch(() => aiCache.delete(key));
    aiCache.set(key, p);
  }
  return aiCache.get(key);
}

// הכנה מראש (למשל כשהווילון סגור) – כדי שההקראה תתחיל מיד
export function prefetchAi(text, voice) {
  if (text) fetchAi(text, voice).catch(() => {});
}

export async function speakAi(text, { voice, onStart, onEnd } = {}) {
  const url = await fetchAi(text, voice);
  stopAll();
  return new Promise((resolve) => {
    const a = new Audio(url);
    currentAudio = a;
    const finish = (ok) => {
      if (currentAudio === a) currentAudio = null;
      onEnd?.();
      resolve(ok);
    };
    a.onplay = () => onStart?.();
    a.onended = () => finish(true);
    a.onerror = () => finish(false);
    a.play().catch(() => finish(false));
  });
}

export function stopAll() {
  stopSpeaking();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

// מקריא לפי ההעדפות: קול AI, ואם לא זמין – הקול של המחשב
export async function speakWith(prefs, text, hooks = {}) {
  if (prefs.engine === 'ai') {
    try {
      return await speakAi(text, { voice: prefs.aiVoice, ...hooks });
    } catch (e) {
      console.warn('AI voice failed, using computer voice', e);
      hooks.onFallback?.(e);
    }
  }
  return speak(text, { voiceName: prefs.voice, ...hooks });
}
