import { useEffect, useState } from 'react';
import { adminApi } from './adminApi.js';
import CodesPanel from './CodesPanel.jsx';
import BankPanel from './BankPanel.jsx';
import '../pages/setup.css';
import './admin.css';

export default function AdminApp() {
  const [pw, setPw] = useState(() => sessionStorage.getItem('seker_admin') || '');
  const [ok, setOk] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

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
          className="card"
          style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}
          onSubmit={(e) => {
            e.preventDefault();
            tryLogin(input).catch((er) => setError(er.message));
          }}
        >
          <h1 className="brand-title" style={{ fontSize: '1.8rem' }}>ניהול</h1>
          <input type="password" placeholder="סיסמת ניהול" value={input} onChange={(e) => setInput(e.target.value)} />
          <p className="error">{error}</p>
          <button className="btn primary" style={{ width: '100%' }}>כניסה</button>
        </form>
      </section>
    );

  return (
    <div className="su">
      <header className="su-hero">
        <div className="su-hero-in">
          <div>
            <h1>🔑 ניהול משחק הסקר</h1>
            <p>קודים ללקוחות ומאגר השאלות</p>
          </div>
          <button
            className="btn ghost"
            onClick={() => {
              sessionStorage.removeItem('seker_admin');
              location.reload();
            }}
          >
            יציאה
          </button>
        </div>
      </header>
      <main className="su-body ad-body">
        <CodesPanel pw={pw} />
        <BankPanel pw={pw} />
      </main>
    </div>
  );
}
