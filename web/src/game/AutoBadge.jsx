import { useEffect, useState } from 'react';

// "ממשיכות בעוד N…" – ספירה לאחור עד המעבר האוטומטי
export default function AutoBadge({ at, clockOffset }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((at - (now + clockOffset)) / 1000));
  return <span className="auto-badge">⏩ ממשיכות בעוד {left}</span>;
}
