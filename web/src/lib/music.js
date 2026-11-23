// מנגינת רקע שנוצרת בדפדפן (בלי קבצי מוזיקה) ומגיבה למשחק:
// lobby – רגוע · question – מתח שמאיץ לקראת סוף הטיימר · results – חגיגי · roll – תופים לפני חשיפה
const NOTE = { E1: 41.2, G1: 49, A1: 55, C2: 65.41, D2: 73.42, E2: 82.41, A2: 110, Bb2: 116.54, C3: 130.81, E3: 164.81, G3: 196, A3: 220, C4: 261.63, E4: 329.63, G4: 392, C5: 523.25 };

class Music {
  ctx = null;
  mode = 'off';
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
    this.master.gain.value = this.volume * 0.6;
    this.duck = c.createGain();
    this.bus = c.createGain();
    this.bus.connect(this.duck).connect(this.master).connect(c.destination);
    // רעש לבן לתופים ולתקתוק
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // צריך להיקרא אחרי לחיצה של המשתמשת (מדיניות הדפדפנים)
  unlock() {
    if (!this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v * 0.6, this.ctx.currentTime, 0.1);
  }

  setTension(t) {
    this.tension = Math.max(0, Math.min(1, t));
  }

  // הנמכה בזמן שהקריין מדבר
  setDucked(on) {
    if (this.duck) this.duck.gain.setTargetAtTime(on ? 0.22 : 1, this.ctx.currentTime, 0.15);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'off') {
      if (this.bus) this.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      clearInterval(this.timer);
      this.timer = null;
      return;
    }
    if (!this.ensure()) return;
    const c = this.ctx;
    this.bus.gain.cancelScheduledValues(c.currentTime);
    this.bus.gain.setValueAtTime(0.0001, c.currentTime);
    this.bus.gain.exponentialRampToValueAtTime(1, c.currentTime + 0.6);
    this.step = 0;
    this.nextTime = c.currentTime + 0.08;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }

  bpm() {
    if (this.mode === 'question') return 112 + 58 * this.tension;
    if (this.mode === 'results') return 124;
    if (this.mode === 'roll') return 130;
    return 92;
  }

  schedule() {
    if (!this.ctx || this.mode === 'off') return;
    // אם הלשונית הייתה ברקע – לא "להשלים" מאות צעדים בבת אחת
    if (this.nextTime < this.ctx.currentTime - 0.3) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.play(this.step % 32, this.nextTime);
      this.nextTime += 60 / this.bpm() / 4;
      this.step++;
    }
  }

  // ---- כלים ----
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

  // ---- דפוסים (32 צעדים של 1/16) ----
  play(s, t) {
    const m = this.mode;
    if (m === 'question') {
      const T = this.tension;
      const bass = ['A1', 'A1', 'A1', 'C2', 'A1', 'A1', 'G1', 'E1', 'A1', 'A1', 'A1', 'C2', 'A1', 'D2', 'C2', 'G1'];
      if (s % 2 === 0) this.tone(NOTE[bass[s / 2]], t, 0.17, { type: 'sawtooth', vol: 0.16, cutoff: 320 + 900 * T });
      if (s % 8 === 0) this.kick(t, 0.38 + 0.2 * T);
      if (s % 2 === 0 || T > 0.55) this.hit(t, { vol: s % 4 === 0 ? 0.07 : 0.035 + 0.03 * T });
      if (s === 0) {
        // צליל מתח ארוך; בסוף הזמן – צורם יותר
        this.tone(NOTE.A2, t, 2.2, { type: 'triangle', vol: 0.05, attack: 0.3 });
        this.tone(T > 0.7 ? NOTE.Bb2 : NOTE.E3, t, 2.2, { type: 'triangle', vol: 0.04, attack: 0.3 });
      }
      if (T > 0.8 && s % 4 === 2) this.tone(NOTE.A3, t, 0.08, { type: 'square', vol: 0.03 });
    } else if (m === 'results') {
      const arp = ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'G4', 'E4'];
      if (s % 2 === 0) this.tone(NOTE[arp[(s / 2) % 8]], t, 0.22, { type: 'triangle', vol: 0.09 });
      if (s % 8 === 0) this.kick(t, 0.35);
      if (s % 8 === 4) this.hit(t, { vol: 0.12, dur: 0.12, bp: 1800 });
      if (s % 16 === 0) this.tone(s === 0 ? NOTE.C3 : NOTE.G3, t, 0.9, { type: 'sine', vol: 0.12 });
    } else if (m === 'roll') {
      // תופים שמתגברים
      const v = 0.03 + 0.11 * (s / 32);
      this.hit(t, { vol: v, dur: 0.06, bp: 2500 });
      if (s % 16 === 0) this.tone(NOTE.A1 * 2, t, 0.6, { type: 'sine', vol: 0.25 });
    } else if (m === 'lobby') {
      const arp = ['A2', 'C3', 'E3', 'G3', 'E3', 'C3', 'E3', 'C3'];
      if (s % 2 === 0) this.tone(NOTE[arp[(s / 2) % 8]] * 2, t, 0.35, { type: 'sine', vol: 0.07 });
      if (s % 8 === 0) this.kick(t, 0.22);
      if (s % 4 === 2) this.hit(t, { vol: 0.025 });
    }
  }
}

export const music = new Music();
// לבדיקות
if (typeof window !== "undefined") window.__sekerMusic = music;
