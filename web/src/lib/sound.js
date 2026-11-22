// צלילים שנוצרים בדפדפן, בלי קבצים
let ctx = null;

export function playSound(kind) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (kind === 'unlock') return;
    const t = ctx.currentTime;
    const note = (freq, start, dur, type = 'sine', vol = 0.2) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t + start);
      g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t + start);
      o.stop(t + start + dur);
    };
    if (kind === 'tick') note(880, 0, 0.12, 'square', 0.08);
    if (kind === 'buzz') {
      note(220, 0, 0.5, 'sawtooth', 0.12);
      note(165, 0.05, 0.6, 'sawtooth', 0.1);
    }
    if (kind === 'fanfare') [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.12, i === 3 ? 0.6 : 0.18, 'triangle', 0.15));
  } catch {
    /* דפדפן בלי תמיכה בקול */
  }
}
