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
