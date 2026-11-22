import { useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './lib/api.js';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import Game from './game/Game.jsx';

// ניווט בין שלושת המסכים: כניסה → הכנת משחק → משחק
export default function App() {
  const [view, setView] = useState(null); // login | setup | game
  const [me, setMe] = useState(null);
  const [gameId, setGameId] = useState(() => Number(localStorage.getItem('seker_game')) || null);

  const logout = () => {
    setToken('');
    localStorage.removeItem('seker_game');
    setGameId(null);
    setView('login');
  };

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return setView('login');
    api('/api/me')
      .then((m) => {
        setMe(m);
        setView(gameId ? 'game' : 'setup');
      })
      .catch(() => setView('login'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLogin = async () => {
    setMe(await api('/api/me'));
    setView('setup');
  };

  const openGame = (id) => {
    localStorage.setItem('seker_game', id);
    setGameId(id);
    setView('game');
  };

  const backToSetup = async (forgetGame) => {
    if (forgetGame) {
      localStorage.removeItem('seker_game');
      setGameId(null);
    }
    setMe(await api('/api/me'));
    setView('setup');
  };

  if (view === 'login') return <Login onLogin={onLogin} />;
  if (view === 'setup')
    return <Setup me={me} hasOpenGame={!!gameId} onResume={() => setView('game')} onCreated={openGame} onLogout={logout} />;
  if (view === 'game') return <Game gameId={gameId} me={me} onExit={backToSetup} />;
  return null;
}
