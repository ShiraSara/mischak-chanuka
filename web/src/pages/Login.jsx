import { useState } from 'react';
import { api, setToken } from '../lib/api.js';
import { BRAND } from '../lib/theme.js';
import Wave from '../lib/Wave.jsx';

export default function Login({ onLogin }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api('/api/login', { method: 'POST', body: { code } });
      setToken(r.token);
      await onLogin();
    } catch (er) {
      setError(er.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="center-page">
      <div className="login-card">
        <span className="sticker">משחק קליקרים לחבורות</span>
        <h1 className="brand" style={{ marginTop: 18 }}>{BRAND}</h1>
        <Wave />
        <p className="sub">הקישי את הקוד שקיבלת כדי להתחיל</p>
        <form onSubmit={submit}>
          <input
            type="text"
            className="ltr code-input"
            placeholder="קוד כניסה"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <p className="error">{error}</p>
          <button className="btn primary big" style={{ width: '100%' }} disabled={busy}>
            יאללה, נכנסות! 🎉
          </button>
        </form>
      </div>
    </section>
  );
}
