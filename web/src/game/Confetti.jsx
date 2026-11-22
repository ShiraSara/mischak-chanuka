import { useMemo } from 'react';

const COLORS = ['#f6c453', '#e94f6a', '#9b5de5', '#00bbf9', '#00f5d4', '#ffffff'];

// גשם קונפטי חד-פעמי (מוצג כל עוד הרכיב קיים)
export default function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => {
        const size = 6 + Math.random() * 8;
        return {
          left: Math.random() * 100 + '%',
          width: size,
          height: size * 0.45,
          background: COLORS[i % COLORS.length],
          animationDelay: Math.random() * 0.6 + 's',
          animationDuration: 2.2 + Math.random() * 1.8 + 's',
          transform: `rotate(${Math.random() * 360}deg)`,
        };
      }),
    []
  );
  return (
    <div className="confetti">
      {pieces.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  );
}
