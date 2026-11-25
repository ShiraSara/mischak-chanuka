import { useLayoutEffect, useRef } from 'react';

// מתאים את התוכן לגודל הכרטיס: מקטין כשלא נכנס (אין גלילה על המקרן!) ומגדיל קצת כשיש מקום
export default function FitBox({ children, max = 1.6 }) {
  const outer = useRef(null);
  const inner = useRef(null);

  useLayoutEffect(() => {
    let raf;
    const fit = () => {
      const o = outer.current;
      const el = inner.current;
      if (!o || !el) return;
      const W = o.clientWidth;
      const H = o.clientHeight;
      if (!W || !H) return;
      const measure = (s) => {
        el.style.width = W / s + 'px';
        return el.scrollHeight;
      };
      el.style.transform = 'translateX(-50%)';
      // חיפוש בינארי: ההגדלה הכי גדולה שבה התוכן (שנשבר לשורות לפי הרוחב) עדיין נכנס בגובה
      let lo = 0.25;
      let hi = max;
      if (measure(hi) * hi <= H) lo = hi;
      else
        for (let k = 0; k < 9; k++) {
          const mid = (lo + hi) / 2;
          if (measure(mid) * mid <= H) lo = mid;
          else hi = mid;
        }
      const s = lo;
      el.style.width = W / s + 'px';
      const top = Math.max(0, (H - el.scrollHeight * s) / 2);
      el.style.top = top + 'px';
      el.style.transform = `translateX(-50%) scale(${s})`;
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(outer.current);
    const mo = new MutationObserver(schedule);
    mo.observe(inner.current, { childList: true, subtree: true, characterData: true });
    fit();
    const t1 = setTimeout(schedule, 300); // אחרי טעינת גופנים
    const t2 = setTimeout(schedule, 1200);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [max]);

  return (
    <div className="fit-outer" ref={outer}>
      <div className="fit-inner" ref={inner}>
        {children}
      </div>
    </div>
  );
}
