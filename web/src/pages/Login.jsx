import { useState } from 'react';
import { api, setToken } from '../lib/api.js';

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
      <div className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1 className="brand-title">משחק הסקר</h1>
        <p className="sub">הקישי את הקוד שקיבלת כדי להתחיל</p>
        <form onSubmit={submit}>
          <input
            type="text"
            className="ltr"
            placeholder="קוד כניסה"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: 3 }}
          />
          <p className="error">{error}</p>
          <button className="btn primary big" style={{ width: '100%' }} disabled={busy}>
            כניסה
          </button>
        </form>
      </div>
    </section>
  );
}
