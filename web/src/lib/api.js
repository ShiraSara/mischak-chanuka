// חיבור לשרת – שומר את טוקן הכניסה של המארחת
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

export const getToken = () => localStorage.getItem('seker_token') || '';
export const setToken = (t) => (t ? localStorage.setItem('seker_token', t) : localStorage.removeItem('seker_token'));

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + getToken(), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login' && !path.startsWith('/api/admin')) {
    onUnauthorized();
    throw new Error(data.error || 'צריך להיכנס מחדש');
  }
  if (!res.ok) throw new Error(data.error || 'שגיאה');
  return data;
}

export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// מזהה קבוע לכל שאלה ברשימה (כדי שעריכה לא "תקפוץ" בין שורות)
let seq = 0;
export const withId = (q) => ({ ...q, id: ++seq });
