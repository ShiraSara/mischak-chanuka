import { useLayoutEffect, useRef } from 'react';

// גודל יציב לכל מסך: בתחילת כל שאלה / תוצאות קובעים את הגודל פעם אחת, עם מקום שמור
// לדברים שמופיעים תוך כדי (כיתובים, מי הצביעה) – כדי שהתוכן לא "יתכווץ" באמצע.
// מקטינים רק אם משהו באמת לא נכנס, ומחשבים מחדש כשהחלון משנה גודל.
const RESERVE = 0.86; // כמה מהגובה התוכן תופס בהתחלה
const SETTLE_MS = 1400; // בזמן הזה (טעינת גופנים, אנימציית כניסה) עוד מותר לכוונן

export default function FitBox({ children, max = 1.5 }) {
  const outer = useRef(null);
  const inner = useRef(null);

  useLayoutEffect(() => {
    let raf;
    let scale = null;
    const born = performance.now();
    const el = inner.current;
    const o = outer.current;

    const measure = (W, s) => {
      el.style.width = W / s + 'px';
      return el.scrollHeight;
    };
    const best = (W, H) => {
      let lo = 0.25;
      let hi = max;
      if (measure(W, hi) * hi <= H) return hi;
      for (let k = 0; k < 9; k++) {
        const mid = (lo + hi) / 2;
        if (measure(W, mid) * mid <= H) lo = mid;
        else hi = mid;
      }
      return lo;
    };
    const apply = (W, H, s) => {
      el.style.width = W / s + 'px';
      el.style.top = Math.max(0, (H - el.scrollHeight * s) / 2) + 'px';
      el.style.transform = `translateX(-50%) scale(${s})`;
    };
    const fit = (full) => {
      const W = o.clientWidth;
      const H = o.clientHeight;
      if (!W || !H) return;
      el.style.transform = 'translateX(-50%)';
      if (full || scale == null) scale = best(W, H * RESERVE);
      else if (measure(W, scale) * scale > H) scale = best(W, H); // רק אם באמת לא נכנס
      apply(W, H, scale);
    };
    const schedule = (full) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => fit(full || performance.now() - born < SETTLE_MS));
    };
    const ro = new ResizeObserver(() => schedule(true));
    ro.observe(o);
    const mo = new MutationObserver(() => schedule(false));
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    fit(true);
    const t1 = setTimeout(() => schedule(true), 300);
    const t2 = setTimeout(() => schedule(true), 1200);
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
