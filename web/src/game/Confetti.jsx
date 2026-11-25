import { useMemo } from 'react';
import { createPortal } from 'react-dom';

// צבעי הקונפטי לפי ערכת הצבעים שנבחרה
const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', '#ffffff', '#ffd43b'];

// גשם קונפטי. full – על כל המסך, הרבה, בגלים חוזרים (מסך הניצחון)
export default function Confetti({ full = false, count = 90 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: full ? 220 : count }, (_, i) => {
        const size = (full ? 8 : 6) + Math.random() * (full ? 12 : 8);
        const round = full && i % 5 === 0;
        return {
          left: Math.random() * 100 + '%',
          width: size,
          height: round ? size : size * 0.45,
          borderRadius: round ? '50%' : 2,
          background: COLORS[i % COLORS.length],
          animationDelay: (full ? Math.random() * 5 : Math.random() * 0.6) + 's',
          animationDuration: (full ? 3 : 2.2) + Math.random() * 2 + 's',
          animationIterationCount: full ? 3 : 1,
          transform: `rotate(${Math.random() * 360}deg)`,
        };
      }),
    [full, count]
  );
  const el = (
    <div className={`confetti ${full ? 'full' : ''}`}>
      {pieces.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  );
  return full ? createPortal(el, document.body) : el;
}
