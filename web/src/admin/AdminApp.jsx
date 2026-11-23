import { useEffect, useState } from 'react';
import { adminApi } from './adminApi.js';
import CodesPanel from './CodesPanel.jsx';
import BankPanel from './BankPanel.jsx';
import AiCheckPanel from './AiCheckPanel.jsx';
import { FEATURES } from '../lib/features.js';

const TABS = [
  { id: 'create', label: '➕ יצירת קוד ללקוחה' },
  { id: 'codes', label: '🎮 משחקים קיימים' },
  { id: 'banks', label: '📚 מאגרי שאלות' },
];
import '../pages/setup.css';
import './admin.css';
import { BRAND } from '../lib/theme.js';
import Wave from '../lib/Wave.jsx';
import ThemePicker from '../lib/ThemePicker.jsx';

export default function AdminApp() {
  const [pw, setPw] = useState(() => sessionStorage.getItem('seker_admin') || '');
  const [ok, setOk] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState(() => (TABS.some((t) => '#' + t.id === location.hash) ? location.hash.slice(1) : 'create'));
  const goTab = (id) => {
    setTab(id);
    history.replaceState(null, '', '#' + id);
  };

  const tryLogin = async (password) => {
    await adminApi('/api/admin/codes', password);
    sessionStorage.setItem('seker_admin', password);
    setPw(password);
    setOk(true);
  };

  useEffect(() => {
    if (pw) tryLogin(pw).catch(() => sessionStorage.removeItem('seker_admin'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ok)
    return (
      <section className="center-page">
        <form
          className="login-card"
          onSubmit={(e) => {
            e.preventDefault();
            tryLogin(input).catch((er) => setError(er.message));
          }}
        >
          <span className="sticker">{BRAND}</span>
          <h1 className="brand" style={{ fontSize: '2.6rem', margin: '16px 0 18px' }}>ניהול</h1>
          <input type="password" placeholder="סיסמת ניהול" value={input} onChange={(e) => setInput(e.target.value)} />
          <p className="error">{error}</p>
          <button className="btn primary big" style={{ width: '100%' }}>כניסה</button>
        </form>
      </section>
    );

  return (
    <div className="su">
      <header className="su-hero">
        <div className="su-hero-in">
          <div>
            <span className="sticker">{BRAND}</span>
            <h1>
              <em>ניהול</em> קודים ושאלות
            </h1>
            <Wave />
          </div>
          <div className="su-hero-side">
            <button
              className="btn ghost"
              onClick={() => {
                sessionStorage.removeItem('seker_admin');
                location.reload();
              }}
            >
              יציאה
            </button>
            <ThemePicker compact />
          </div>
        </div>
      </header>
      <main className="su-body ad-body">
        <nav className="ad-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => goTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        {tab === 'create' && <CodesPanel pw={pw} part="create" />}
        {tab === 'codes' && <CodesPanel pw={pw} part="list" />}
        {tab === 'banks' && <BankPanel pw={pw} />}
        {/* בדיקת חיבור ל-AI – כבויה כרגע (lib/features.js) */}
        {FEATURES.aiCheck && tab === 'create' && <AiCheckPanel pw={pw} />}
      </main>
    </div>
  );
}
