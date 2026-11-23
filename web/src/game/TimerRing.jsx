import { useEffect, useRef, useState } from 'react';
import { playSound } from '../lib/sound.js';

const R = 52;
const CIRC = 2 * Math.PI * R;

// טיימר עגול עם ספירה לאחור, צפצוף ב-5 השניות האחרונות וזמזום בסוף
export default function TimerRing({ startedAt, seconds, clockOffset, soundOn }) {
  const [now, setNow] = useState(() => Date.now());
  const lastSec = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const total = seconds * 1000;
  const leftMs = Math.min(total, Math.max(0, startedAt + total - (now + clockOffset)));
  const left = Math.ceil(leftMs / 1000);

  useEffect(() => {
    if (left === lastSec.current) return;
    if (soundOn && lastSec.current !== null && left < lastSec.current) {
      // שעון מתקתק לאורך כל הזמן, צפצוף ב-5 האחרונות, באזר בסוף
      if (left > 5) playSound(left % 2 ? 'clock-tick' : 'clock-tock');
      else if (left > 0) playSound('tick');
      else playSound('buzz');
    }
    lastSec.current = left;
  }, [left, soundOn]);

  const cls = left === 0 ? 'done' : left <= 5 ? 'low' : '';
  return (
    <div className={`timer-ring ${cls}`}>
      <svg viewBox="0 0 120 120">
        <circle className="track" cx="60" cy="60" r={R} />
        <circle className="prog" cx="60" cy="60" r={R} strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - leftMs / total)} />
      </svg>
      <span className="num">{left > 0 ? left : '⏰'}</span>
    </div>
  );
}
