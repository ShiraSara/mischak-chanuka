// מנגינת רקע שנוצרת בדפדפן (בלי קבצי מוזיקה). כל המנגינות מקוריות.
const BOOST = 2.2; // עוצמת המנגינה (הייתה חלשה מדי)
// מצבים: lobby – רגוע · question – לפי הסגנון שנבחר, מאיץ לקראת סוף הטיימר · results – חגיגי · roll – תופים
export const MUSIC_STYLES = [
  { id: 'quiz', name: 'חידון טלוויזיה', icon: '📺' },
  { id: 'clock', name: 'שעון מתקתק', icon: '⏱️' },
  { id: 'happy', name: 'קליל ושמח', icon: '🎈' },
  { id: 'drama', name: 'מתח דרמטי', icon: '🎻' },
  { id: 'chip', name: 'משחק מחשב', icon: '👾' },
];

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

class Music {
  ctx = null;
  mode = 'off';
  style = 'quiz';
  tension = 0;
  volume = 0.5;
  step = 0;
  nextTime = 0;
  timer = null;

  ensure() {
    if (this.ctx) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.volume * BOOST;
    this.duck = c.createGain();
    this.bus = c.createGain();
    // מגביר + "מכווץ" – חזק יותר בלי שהצליל יישבר בשיאים
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.005;
    this.comp.release.value = 0.2;
    this.bus.connect(this.duck).connect(this.master).connect(this.comp).connect(c.destination);
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  unlock() {
    if (!this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v * BOOST, this.ctx.currentTime, 0.1);
  }

  // סגנון מובנה, או מנגינה שהועלתה: 'track:<id>'
  setStyle(s) {
    if (!(MUSIC_STYLES.some((x) => x.id === s) || String(s).startsWith('track:')) || s === this.style) return;
    this.style = s;
    if (this.mode !== 'off') this.syncTrack();
  }

  get isTrack() {
    return String(this.style).startsWith('track:');
  }

  // קובץ שמע: מתנגן בלולאה דרך אותו מגבר (עוצמה, הנמכה בתוצאות)
  syncTrack() {
    if (!this.isTrack || this.mode === 'off') {
      if (this.audio && !this.audio.paused) this.audio.pause();
      return;
    }
    if (!this.ensure()) return;
    const src = '/music/' + this.style.slice(6);
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.loop = true;
      this.audio.preload = 'auto';
      // קבצים מוקלטים חזקים יותר מהצלילים המובנים – מנמיכים קצת כדי שיתאזנו
      const g = this.ctx.createGain();
      g.gain.value = 0.45;
      this.ctx.createMediaElementSource(this.audio).connect(g).connect(this.bus);
    }
    if (!this.audio.src.endsWith(src)) this.audio.src = src;
    // אם הדפדפן חסם (עוד לא לחצו על הדף) – מנסים שוב בלחיצה הבאה
    this.audio.play().catch(() => document.addEventListener('pointerdown', () => this.syncTrack(), { once: true }));
  }

  setTension(t) {
    this.tension = Math.max(0, Math.min(1, t));
  }

  setDucked(on) {
    if (this.duck) this.duck.gain.setTargetAtTime(on ? 0.4 : 1, this.ctx.currentTime, 0.15);
  }

  setMode(mode, force = false) {
    if (mode === this.mode && !force) return;
    const prev = this.mode;
    this.mode = mode;
    if (mode === 'off') {
      if (this.bus) this.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      clearInterval(this.timer);
      this.timer = null;
      if (this.audio) setTimeout(() => this.mode === 'off' && this.audio.pause(), 600);
      return;
    }
    if (!this.ensure()) return;
    const c = this.ctx;
    // מנגינה מקובץ שכבר מתנגנת – ממשיכה בלי הפסקה בין שלבי המשחק
    if (this.isTrack && prev !== 'off' && this.audio && !this.audio.paused) return this.syncTrack();
    this.bus.gain.cancelScheduledValues(c.currentTime);
    this.bus.gain.setValueAtTime(0.0001, c.currentTime);
    this.bus.gain.exponentialRampToValueAtTime(1, c.currentTime + 0.5);
    this.step = 0;
    this.nextTime = c.currentTime + 0.08;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
    this.syncTrack();
  }

  bpm() {
    const T = this.tension;
    if (this.mode === 'question') {
      return { quiz: 126 + 40 * T, clock: 64 + 50 * T, happy: 116 + 30 * T, drama: 112 + 58 * T, chip: 138 + 40 * T }[this.style] || 120;
    }
    if (this.mode === 'results') return 124;
    if (this.mode === 'roll') return 130;
    return 92;
  }

  schedule() {
    if (!this.ctx || this.mode === 'off' || this.isTrack) return; // מנגינה מקובץ – בלי הצלילים המובנים
    if (this.nextTime < this.ctx.currentTime - 0.3) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.play(this.step, this.nextTime);
      this.nextTime += 60 / this.bpm() / 4;
      this.step++;
    }
  }

  // ---------- כלים ----------
  tone(freq, t, dur, { type = 'sine', vol = 0.2, cutoff = 0, attack = 0.005 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (cutoff) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      o.connect(f);
      node = f;
    }
    node.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  chord(root, intervals, t, dur, opts) {
    for (const i of intervals) this.tone(hz(root + i), t, dur, opts);
  }

  kick(t, vol = 0.5) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.3);
  }

  hit(t, { vol = 0.06, dur = 0.03, hp = 7000, bp = 0 } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = bp ? 'bandpass' : 'highpass';
    f.frequency.value = bp || hp;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ---------- דפוסים ----------
  play(step, t) {
    const s = step % 32;
    if (this.mode === 'question') return this[`q_${this.style}`]?.(step, t) ?? this.q_quiz(step, t);
    if (this.mode === 'results') {
      const arp = [60, 64, 67, 72, 67, 64, 67, 64];
      if (s % 2 === 0) this.tone(hz(arp[(s / 2) % 8]), t, 0.22, { type: 'triangle', vol: 0.09 });
      if (s % 8 === 0) this.kick(t, 0.35);
      if (s % 8 === 4) this.hit(t, { vol: 0.12, dur: 0.12, bp: 1800 });
      if (s % 16 === 0) this.tone(hz(s === 0 ? 48 : 55), t, 0.9, { vol: 0.12 });
    } else if (this.mode === 'roll') {
      this.hit(t, { vol: 0.03 + 0.11 * (s / 32), dur: 0.06, bp: 2500 });
      if (s % 16 === 0) this.tone(hz(45), t, 0.6, { vol: 0.25 });
    } else if (this.mode === 'lobby') {
      const arp = [57, 60, 64, 67, 64, 60, 64, 60];
      if (s % 2 === 0) this.tone(hz(arp[(s / 2) % 8]), t, 0.35, { vol: 0.07 });
      if (s % 8 === 0) this.kick(t, 0.22);
      if (s % 4 === 2) this.hit(t, { vol: 0.025 });
    }
  }

  // 📺 חידון טלוויזיה – בס צועד, אקורדים קצרים על ההפסקות, תופים של שעשועון
  q_quiz(step, t) {
    const T = this.tension;
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const prog = [
      [48, [0, 3, 7]], // Cm
      [44, [0, 4, 7]], // Ab
      [46, [0, 4, 7]], // Bb
      [43, [0, 4, 7]], // G
    ][bar];
    const [root, iv] = prog;
    if (s % 4 === 0) this.tone(hz(root - 12 + (s % 8 === 4 ? 7 : 0)), t, 0.22, { type: 'sawtooth', vol: 0.15, cutoff: 500 + 700 * T });
    if (s % 4 === 2) this.chord(root + 12, iv, t, 0.09, { type: 'square', vol: 0.028, cutoff: 2600 });
    if (s % 8 === 0) this.kick(t, 0.4);
    if (s % 8 === 4) this.hit(t, { vol: 0.13, dur: 0.11, bp: 1900 });
    if (s % 2 === 0 || T > 0.5) this.hit(t, { vol: 0.03 + 0.03 * T });
    // מוטיב קצר בסוף כל זוג תיבות
    if (bar % 2 === 1 && [8, 10, 12, 14].includes(s)) this.tone(hz(root + 24 + iv[[8, 10, 12, 14].indexOf(s) % 3]), t, 0.14, { type: 'triangle', vol: 0.06 });
  }

  // ⏱️ שעון מתקתק – פעימות לב וצליל נמוך; התקתוק עצמו מגיע מהטיימר
  q_clock(step, t) {
    const T = this.tension;
    const s = step % 16;
    if (s === 0 || s === 3) this.kick(t, s === 0 ? 0.45 : 0.3);
    if (step % 32 === 0) this.tone(hz(33), t, 2.4, { type: 'triangle', vol: 0.09, attack: 0.4 });
    if (s === 8) this.tone(hz(76 + (T > 0.6 ? 1 : 0)), t, 0.5, { vol: 0.035 });
    if (T > 0.7 && s % 4 === 2) this.tone(hz(45), t, 0.12, { type: 'square', vol: 0.03, cutoff: 600 });
  }

  // 🎈 קליל ושמח – בס קופצני, אקורדים מורטים, כפיים
  q_happy(step, t) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const [root, iv] = [
      [48, [0, 4, 7]], // C
      [43, [0, 4, 7]], // G
      [45, [0, 3, 7]], // Am
      [41, [0, 4, 7]], // F
    ][bar];
    if (s % 2 === 0) this.tone(hz(root - 12 + (s % 4 === 2 ? 12 : 0)), t, 0.14, { type: 'triangle', vol: 0.14 });
    if (s % 4 === 2) this.chord(root + 12, iv, t, 0.12, { type: 'triangle', vol: 0.04 });
    if (s % 8 === 0) this.kick(t, 0.32);
    if (s % 8 === 4) this.hit(t, { vol: 0.12, dur: 0.09, bp: 1500 });
    const mel = [0, 2, 4, 7, 9, 7, 4, 2];
    if (s % 2 === 1 && bar % 2 === 0) this.tone(hz(root + 24 + mel[(s - 1) / 2]), t, 0.12, { vol: 0.05 });
  }

  // 🎻 מתח דרמטי – בס מאיים, צליל ארוך שהופך צורם בסוף הזמן
  q_drama(step, t) {
    const T = this.tension;
    const s = step % 32;
    const bass = [33, 33, 33, 36, 33, 33, 31, 28, 33, 33, 33, 36, 33, 38, 36, 31];
    if (s % 2 === 0) this.tone(hz(bass[s / 2]), t, 0.17, { type: 'sawtooth', vol: 0.16, cutoff: 320 + 900 * T });
    if (s % 8 === 0) this.kick(t, 0.38 + 0.2 * T);
    if (s % 2 === 0 || T > 0.55) this.hit(t, { vol: s % 4 === 0 ? 0.07 : 0.035 + 0.03 * T });
    if (s === 0) {
      this.tone(hz(45), t, 2.2, { type: 'triangle', vol: 0.05, attack: 0.3 });
      this.tone(hz(T > 0.7 ? 46 : 52), t, 2.2, { type: 'triangle', vol: 0.04, attack: 0.3 });
    }
    if (T > 0.8 && s % 4 === 2) this.tone(hz(57), t, 0.08, { type: 'square', vol: 0.03 });
  }

  // 👾 משחק מחשב – ארפג'ו מהיר בסגנון 8-ביט
  q_chip(step, t) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const [root, iv] = [
      [57, [0, 3, 7, 12]], // Am
      [53, [0, 4, 7, 12]], // F
      [48, [0, 4, 7, 12]], // C
      [55, [0, 4, 7, 12]], // G
    ][bar];
    this.tone(hz(root + 12 + iv[s % 4]), t, 0.07, { type: 'square', vol: 0.035 });
    if (s % 2 === 0) this.tone(hz(root - 12), t, 0.1, { type: 'square', vol: 0.06, cutoff: 900 });
    if (s % 8 === 0) this.hit(t, { vol: 0.12, dur: 0.06, bp: 200 });
    if (s % 8 === 4) this.hit(t, { vol: 0.1, dur: 0.08, bp: 3000 });
  }
}

export const music = new Music();
// לבדיקות: מצב המנגינה זמין מהקונסול
if (typeof window !== "undefined") window.__crazyMusic = music;
// לבדיקות
if (typeof window !== 'undefined') window.__sekerMusic = music;
