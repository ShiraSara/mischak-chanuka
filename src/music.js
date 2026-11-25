// מנגינות שהמנהלת מעלה (נשמרות ב-Cloudflare KV, כי קבצי שמע גדולים מדי לקוד עצמו)
const LIST_KEY = 'tracks';
const MAX_BYTES = 20 * 1024 * 1024; // 20MB לקובץ

async function listTracks(env) {
  if (!env.MUSIC) return [];
  return (await env.MUSIC.get(LIST_KEY, 'json')) || [];
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

// GET /api/music – רשימת המנגינות (לבחירה בהגדרות המשחק)
export async function publicTracks(env) {
  return json({ tracks: (await listTracks(env)).map(({ id, name }) => ({ id, name })) });
}

// GET /music/<id> – קובץ השמע עצמו (כולל בקשות חלקיות, שנגני שמע משתמשים בהן)
export async function serveTrack(req, env, id) {
  if (!env.MUSIC) return new Response('not found', { status: 404 });
  const { value, metadata } = await env.MUSIC.getWithMetadata('track:' + id, 'arrayBuffer');
  if (!value) return new Response('not found', { status: 404 });
  const type = metadata?.type || 'audio/mpeg';
  const size = value.byteLength;
  const base = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=86400' };
  const range = req.headers.get('range');
  const m = range && range.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(size - 1, Number(m[2])) : size - 1;
    if (start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    return new Response(value.slice(start, end + 1), {
      status: 206,
      headers: { ...base, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) },
    });
  }
  return new Response(value, { headers: { ...base, 'content-length': String(size) } });
}

// ניהול (אחרי בדיקת סיסמת הניהול)
export async function adminMusic(req, env, path, method) {
  if (!env.MUSIC) return json({ error: 'אחסון המנגינות לא מוגדר' }, 500);
  const tracks = await listTracks(env);
  if (path === '/api/admin/music' && method === 'GET') return json({ tracks });
  if (path === '/api/admin/music' && method === 'POST') {
    const url = new URL(req.url);
    const name = (url.searchParams.get('name') || 'מנגינה').trim().slice(0, 60);
    const type = req.headers.get('content-type') || 'audio/mpeg';
    if (!type.startsWith('audio/')) return json({ error: 'צריך קובץ שמע (mp3 / m4a / wav)' }, 400);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) return json({ error: 'הקובץ ריק' }, 400);
    if (buf.byteLength > MAX_BYTES) return json({ error: 'הקובץ גדול מדי (עד 20MB)' }, 400);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await env.MUSIC.put('track:' + id, buf, { metadata: { type, size: buf.byteLength } });
    tracks.push({ id, name, type, size: buf.byteLength, created: Date.now() });
    await env.MUSIC.put(LIST_KEY, JSON.stringify(tracks));
    return json({ id, tracks });
  }
  const m = path.match(/^\/api\/admin\/music\/([a-z0-9]+)$/);
  if (m && method === 'PATCH') {
    const { name } = await req.json().catch(() => ({}));
    const next = tracks.map((t) => (t.id === m[1] && name ? { ...t, name: String(name).trim().slice(0, 60) } : t));
    await env.MUSIC.put(LIST_KEY, JSON.stringify(next));
    return json({ tracks: next });
  }
  if (m && method === 'DELETE') {
    await env.MUSIC.delete('track:' + m[1]);
    const next = tracks.filter((t) => t.id !== m[1]);
    await env.MUSIC.put(LIST_KEY, JSON.stringify(next));
    return json({ tracks: next });
  }
  return json({ error: 'לא נמצא' }, 404);
}
