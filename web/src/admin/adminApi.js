export async function adminApi(path, pw, method = 'GET', body) {
  const r = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', 'x-admin-password': pw },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'שגיאה');
  return d;
}
