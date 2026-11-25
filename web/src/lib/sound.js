// צלילים שנוצרים בדפדפן, בלי קבצים
let ctx = null;
let out = null; // מגביר משותף לכל הצלילים
const SFX_BOOST = 2.4;
function dest() {
  if (out) return out;
  const g = ctx.createGain();
  g.gain.value = SFX_BOOST;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  g.connect(comp).connect(ctx.destination);
  out = g;
  return out;
}

export function playSound(kind) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (kind === 'unlock') return;
    const t = ctx.currentTime;
    // נקישה קצרה ויבשה של שעון
    const clock = (freq, vol) => {
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = 8;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.connect(f).connect(g).connect(dest());
      o.start(t);
      o.stop(t + 0.05);
    };
    const note = (freq, start, dur, type = 'sine', vol = 0.2) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t + start);
      g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
      o.connect(g).connect(dest());
      o.start(t + start);
      o.stop(t + start + dur);
    };
    // שעון: טיק / טוק לסירוגין
    if (kind === 'clock-tick') clock(2400, 0.1);
    if (kind === 'clock-tock') clock(1600, 0.1);
    // 5 השניות האחרונות – צפצוף חד
    if (kind === 'tick') note(988, 0, 0.13, 'square', 0.09);
    // באזר של שעשועון – צליל נמוך וצורם
    if (kind === 'buzz') {
      note(98, 0, 0.95, 'sawtooth', 0.2);
      note(104, 0, 0.95, 'sawtooth', 0.18);
      note(196, 0, 0.95, 'square', 0.06);
    }
    if (kind === 'fanfare') [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.12, i === 3 ? 0.6 : 0.18, 'triangle', 0.15));
  } catch {
    /* דפדפן בלי תמיכה בקול */
  }
}
