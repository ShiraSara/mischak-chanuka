import { useEffect, useState } from 'react';
import { THEMES, getTheme, setTheme, getMode, setMode } from './theme.js';

// בחירת ערכת צבעים – עיגולים צבעוניים
export default function ThemePicker({ compact = false, onChange }) {
  const [current, setCurrent] = useState(getTheme);
  const [mode, setModeState] = useState(getMode);
  useEffect(() => {
    const on = (e) => setModeState(e.detail);
    window.addEventListener('modechange', on);
    return () => window.removeEventListener('modechange', on);
  }, []);
  // כמה בוחרים באותו מסך נשארים מסונכרנים
  useEffect(() => {
    const on = (e) => setCurrent(e.detail);
    window.addEventListener('themechange', on);
    return () => window.removeEventListener('themechange', on);
  }, []);
  const pick = (id) => {
    setTheme(id);
    setCurrent(id);
    onChange?.(id);
  };
  return (
    <div className={`theme-picker ${compact ? 'compact' : ''}`}>
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`theme-dot ${current === t.id ? 'on' : ''}`}
          title={t.name}
          onClick={() => pick(t.id)}
        >
          <span className="sw">
            {t.swatch.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </span>
          {!compact && <span className="nm">{t.name}</span>}
        </button>
      ))}
      <button
        type="button"
        className="theme-dot mode-btn"
        title={mode === 'dark' ? 'מעבר לתצוגה בהירה' : 'מעבר לתצוגה כהה'}
        onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
      >
        {mode === 'dark' ? '☀️' : '🌙'}
        {!compact && <span className="nm">{mode === 'dark' ? 'בהיר' : 'כהה'}</span>}
      </button>
    </div>
  );
}
