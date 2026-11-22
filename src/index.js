import { DEFAULT_QUESTIONS } from './defaults.js';

const MAX_PLAYERS = 15;
const READ_SEC = 20; // כמה שניות המערכת הטלפונית מחכה להקשה לפני שהיא שואלת שוב

// ---------- כלים כלליים ----------
const now = () => Date.now();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
const err = (message, status = 400) => json({ error: message }, status);

function text(body) {
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function randomToken(len = 32) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomDigits(n) {
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  let s = String((a[0] % 9) + 1);
  for (let i = 1; i < n; i++) s += String(a[i] % 10);
  return s;
}

// מנרמל מספר טלפון ישראלי: 972501234567 / +972-50-123-4567 / 050-1234567 → 0501234567
export function normPhone(p) {
  if (!p) return '';
  let d = String(p).replace(/\D/g, '');
  if (d.startsWith('972')) d = '0' + d.slice(3);
  if (d && !d.startsWith('0')) d = '0' + d;
  return d.length >= 9 ? d : '';
}

async function body(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function cleanQuestions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((q) => ({
      text: String(q.text || '').trim().slice(0, 300),
      type: q.type === 'options' ? 'options' : 'names',
      options:
        q.type === 'options'
          ? (Array.isArray(q.options) ? q.options : [])
              .map((o) => String(o || '').trim().slice(0, 80))
              .filter(Boolean)
              .slice(0, MAX_PLAYERS)
          : [],
    }))
    .filter((q) => q.text && (q.type === 'names' || q.options.length >= 2));
}

// ---------- מאגר שאלות כללי ----------
async function getBank(env) {
  let { results } = await env.DB.prepare('SELECT * FROM bank ORDER BY sort, id').all();
  if (!results.length) {
    const stmts = DEFAULT_QUESTIONS.map((q, i) =>
      env.DB.prepare('INSERT INTO bank (text, type, options, sort) VALUES (?, ?, ?, ?)').bind(
        q.text,
        q.type,
        JSON.stringify(q.options || []),
        i
      )
    );
    await env.DB.batch(stmts);
    ({ results } = await env.DB.prepare('SELECT * FROM bank ORDER BY sort, id').all());
  }
  return results.map((r) => ({ text: r.text, type: r.type, options: JSON.parse(r.options || '[]') }));
}

async function setBank(env, list) {
  const qs = cleanQuestions(list);
  const stmts = [env.DB.prepare('DELETE FROM bank')];
  qs.forEach((q, i) =>
    stmts.push(
      env.DB.prepare('INSERT INTO bank (text, type, options, sort) VALUES (?, ?, ?, ?)').bind(
        q.text,
        q.type,
        JSON.stringify(q.options),
        i
      )
    )
  );
  await env.DB.batch(stmts);
  return qs;
}

// ---------- הרשאות ----------
function codeProblem(c) {
  if (!c) return 'הקוד לא קיים';
  if (!c.active) return 'הקוד אינו פעיל';
  if (c.expires_at && c.expires_at < now()) return 'תוקף הקוד הסתיים';
  return null;
}

async function hostAuth(req, env) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const s = await env.DB.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
  if (!s) return null;
  const c = await env.DB.prepare('SELECT * FROM codes WHERE code = ?').bind(s.code).first();
  if (codeProblem(c)) return null;
  return c;
}

function adminAuth(req, env) {
  const p = req.headers.get('x-admin-password') || '';
  return !!env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 6 && p === env.ADMIN_PASSWORD;
}

// ---------- מצב משחק ----------
async function loadGame(env, id) {
  const g = await env.DB.prepare('SELECT * FROM games WHERE id = ?').bind(id).first();
  if (!g) return null;
  g.settings = JSON.parse(g.settings || '{}');
  g.questions = JSON.parse(g.questions || '[]');
  return g;
}

async function loadPlayers(env, gameId) {
  const { results } = await env.DB.prepare('SELECT * FROM players WHERE game_id = ? ORDER BY num')
    .bind(gameId)
    .all();
  return results;
}

function optionsFor(q, players) {
  if (!q) return [];
  if (q.type === 'names') return players.map((p) => ({ n: p.num, label: p.name }));
  return q.options.map((label, i) => ({ n: i + 1, label }));
}

async function setPhase(env, g, fields) {
  const merged = { ...fields, updated_at: now() };
  const keys = Object.keys(merged);
  await env.DB.prepare(`UPDATE games SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => merged[k]), g.id)
    .run();
  Object.assign(g, merged);
}

async function votesFor(env, gameId, qIndex) {
  const { results } = await env.DB.prepare('SELECT num, choice FROM votes WHERE game_id = ? AND q_index = ?')
    .bind(gameId, qIndex)
    .all();
  return results;
}

function tally(opts, votes) {
  const counts = new Map(opts.map((o) => [o.n, 0]));
  for (const v of votes) if (counts.has(v.choice)) counts.set(v.choice, counts.get(v.choice) + 1);
  return opts.map((o) => ({ ...o, count: counts.get(o.n) })).sort((a, b) => b.count - a.count || a.n - b.n);
}

async function gameState(env, g) {
  const players = await loadPlayers(env, g.id);
  const q = g.questions[g.q_index];
  const opts = optionsFor(q, players);
  let votes = g.q_index >= 0 ? await votesFor(env, g.id, g.q_index) : [];

  // חשיפה אוטומטית: כולן הצביעו או שהזמן נגמר
  if (g.phase === 'question' && g.settings.autoReveal) {
    const allVoted = players.length > 0 && votes.length >= players.length;
    const timeUp = g.settings.timerSec > 0 && now() - g.q_started_at > g.settings.timerSec * 1000 + 1500;
    if (allVoted || timeUp) await setPhase(env, g, { phase: 'results' });
  }

  const voted = new Set(votes.map((v) => v.num));
  const state = {
    serverNow: now(),
    game: {
      id: g.id,
      pin: g.pin,
      phase: g.phase,
      status: g.status,
      qIndex: g.q_index,
      total: g.questions.length,
      qStartedAt: g.q_started_at,
      settings: g.settings,
    },
    players: players.map((p) => ({
      num: p.num,
      name: p.name,
      hasPhone: !!p.phone,
      connected: !!p.last_seen,
      voted: voted.has(p.num),
    })),
    question: q ? { text: q.text, type: q.type, options: opts } : null,
    votesCount: votes.length,
  };
  if (g.phase === 'results' || g.phase === 'ended') {
    if (q) state.results = tally(opts, votes);
  }
  if (g.phase === 'ended') {
    const { results: all } = await env.DB.prepare('SELECT q_index, num, choice FROM votes WHERE game_id = ?')
      .bind(g.id)
      .all();
    state.summary = g.questions.map((qq, i) => {
      const t = tally(optionsFor(qq, players), all.filter((v) => v.q_index === i));
      const top = t[0]?.count || 0;
      return {
        text: qq.text,
        votes: t.reduce((s, o) => s + o.count, 0),
        winners: top > 0 ? t.filter((o) => o.count === top).map((o) => o.label) : [],
        top,
      };
    });
  }
  return state;
}

async function gameAction(env, g, action) {
  const total = g.questions.length;
  switch (action) {
    case 'start':
      if (!total) return 'אין שאלות במשחק';
      await setPhase(env, g, { status: 'live', q_index: 0, phase: 'question', q_started_at: now() });
      break;
    case 'reveal':
      await setPhase(env, g, { phase: 'results' });
      break;
    case 'next':
      if (g.q_index + 1 >= total) await setPhase(env, g, { phase: 'ended', status: 'ended' });
      else await setPhase(env, g, { q_index: g.q_index + 1, phase: 'question', q_started_at: now() });
      break;
    case 'prev':
      if (g.q_index > 0) await setPhase(env, g, { q_index: g.q_index - 1, phase: 'results', status: 'live' });
      break;
    case 'reopen':
      await setPhase(env, g, { phase: 'question', q_started_at: now(), status: 'live' });
      break;
    case 'restart_question':
      await env.DB.prepare('DELETE FROM votes WHERE game_id = ? AND q_index = ?').bind(g.id, g.q_index).run();
      await setPhase(env, g, { phase: 'question', q_started_at: now(), status: 'live' });
      break;
    case 'end':
      await setPhase(env, g, { phase: 'ended', status: 'ended' });
      break;
    default:
      return 'פעולה לא מוכרת';
  }
  return null;
}

// ---------- ימות המשיח ----------
// מנקה טקסט להקראה (תווים שימות המשיח לא מקבלת)
function tts(s) {
  return 't-' + String(s).replace(/[.\-"'&|,=]/g, ' ').replace(/\s+/g, ' ').trim();
}

function readCmd(messages, valName, { max = 2, min = 1, sec = READ_SEC } = {}) {
  // read=<הודעות>=<שם משתנה>,<להשתמש בקיים>,<מקס ספרות>,<מינ ספרות>,<שניות המתנה>,<השמעה>,<חסום כוכבית>,<חסום אפס>,<החלפת תו>,<ספרות מותרות>,<ניסיונות>,<אפשר ריק>,<ערך ריק>,
  return `read=${messages.join('.')}=${valName},no,${max},${min},${sec},No,yes,no,,,,Ok,None,`;
}

function msgCmd(messages) {
  return `id_list_message=${messages.join('.')}`;
}

const HANGUP = 'go_to_folder=hangup';

export async function handleYemot(env, params) {
  if (params.hangup === 'yes') return '';
  const callId = params.ApiCallId || params.ApiYFCallId;
  if (!callId) return msgCmd([tts('שגיאה')]) + '&' + HANGUP;
  const phone = normPhone(params.ApiPhone);

  let call = await env.DB.prepare('SELECT * FROM calls WHERE call_id = ?').bind(callId).first();

  // שיחה חדשה – זיהוי לפי מספר הטלפון
  if (!call) {
    call = { call_id: callId, game_id: null, num: null, stage: 'pin', step: 0, last_key: '' };
    if (phone) {
      const p = await env.DB.prepare(
        `SELECT p.game_id, p.num FROM players p JOIN games g ON g.id = p.game_id
         WHERE p.phone = ? AND g.status != 'ended' AND g.created_at > ? ORDER BY g.id DESC LIMIT 1`
      )
        .bind(phone, now() - 24 * 3600 * 1000)
        .first();
      if (p) Object.assign(call, { game_id: p.game_id, num: p.num, stage: 'play' });
    }
    await env.DB.prepare(
      'INSERT INTO calls (call_id, game_id, num, stage, step, last_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(call.call_id, call.game_id, call.num, call.stage, 0, '', now())
      .run();

    if (call.stage === 'play') return await playTurn(env, call, null, true);
    return await ask(env, call, [tts('שלום ברוכות הבאות למשחק הסקר הקישו את קוד המשחק שמופיע על המסך')], {
      max: 4,
      min: 4,
    });
  }

  const raw = params['v' + call.step];
  const value = raw === undefined || raw === 'None' || raw === '' ? null : String(raw).replace(/\D/g, '');

  if (call.stage === 'pin') {
    if (!value) return await ask(env, call, [tts('הקישו את קוד המשחק בן ארבע הספרות')], { max: 4, min: 4 });
    const g = await env.DB.prepare(
      "SELECT id FROM games WHERE pin = ? AND status != 'ended' AND created_at > ? ORDER BY id DESC LIMIT 1"
    )
      .bind(value, now() - 24 * 3600 * 1000)
      .first();
    if (!g) return await ask(env, call, [tts('הקוד שגוי נסו שוב')], { max: 4, min: 4 });
    call.game_id = g.id;
    call.stage = 'who';
    await env.DB.prepare('UPDATE calls SET game_id = ?, stage = ? WHERE call_id = ?').bind(g.id, 'who', callId).run();
    return await ask(env, call, [tts('הקישו את המספר שלכן ברשימת המשתתפות ואחריו סולמית')]);
  }

  if (call.stage === 'who') {
    if (!value) return await ask(env, call, [tts('הקישו את המספר שלכן ברשימה ואחריו סולמית')]);
    const p = await env.DB.prepare('SELECT * FROM players WHERE game_id = ? AND num = ?')
      .bind(call.game_id, Number(value))
      .first();
    if (!p) return await ask(env, call, [tts('המספר לא נמצא ברשימה נסו שוב')]);
    call.num = p.num;
    call.stage = 'play';
    await env.DB.prepare('UPDATE calls SET num = ?, stage = ? WHERE call_id = ?').bind(p.num, 'play', callId).run();
    return await playTurn(env, call, null, true);
  }

  return await playTurn(env, call, value, false);
}

async function ask(env, call, messages, opts, prefix = '') {
  call.step += 1;
  await env.DB.prepare('UPDATE calls SET step = ? WHERE call_id = ?').bind(call.step, call.call_id).run();
  return (prefix ? prefix + '&' : '') + readCmd(messages, 'v' + call.step, opts);
}

async function playTurn(env, call, value, isNew) {
  const g = await loadGame(env, call.game_id);
  if (!g) return msgCmd([tts('המשחק לא נמצא')]) + '&' + HANGUP;
  const player = await env.DB.prepare('SELECT * FROM players WHERE game_id = ? AND num = ?')
    .bind(g.id, call.num)
    .first();
  if (!player) return msgCmd([tts('לא נמצאת ברשימת המשתתפות')]) + '&' + HANGUP;
  await env.DB.prepare('UPDATE players SET last_seen = ? WHERE game_id = ? AND num = ?')
    .bind(now(), g.id, call.num)
    .run();

  if (g.phase === 'ended') return msgCmd([tts('המשחק הסתיים תודה ולהתראות')]) + '&' + HANGUP;

  const pre = [];
  if (isNew) pre.push(tts(`שלום ${player.name} הצטרפת למשחק`));

  // הקשה של תשובה
  if (value) {
    if (g.phase !== 'question') {
      pre.push(tts(g.phase === 'lobby' ? 'המשחק עוד לא התחיל' : 'ההצבעה לשאלה הזו נסגרה'));
    } else {
      const choice = Number(value);
      const players = await loadPlayers(env, g.id);
      const opts = optionsFor(g.questions[g.q_index], players);
      if (!opts.some((o) => o.n === choice)) {
        pre.push(tts(`אין תשובה מספר`), `n-${choice}`, tts('נסו שוב'));
      } else if (g.settings.allowSelfVote === false && g.questions[g.q_index].type === 'names' && choice === call.num) {
        pre.push(tts('אי אפשר להצביע לעצמך נסו שוב'));
      } else {
        await env.DB.prepare(
          `INSERT INTO votes (game_id, q_index, num, choice, at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(game_id, q_index, num) DO UPDATE SET choice = excluded.choice, at = excluded.at`
        )
          .bind(g.id, g.q_index, call.num, choice, now())
          .run();
        pre.push(tts('נקלט'), `n-${choice}`);
      }
    }
  }

  // ההודעה הבאה לפי מצב המשחק
  let key, prompt;
  if (g.phase === 'lobby') {
    key = 'lobby';
    prompt = 'כשהשאלה תופיע על המסך הקישו את מספר התשובה ואחריו סולמית';
  } else if (g.phase === 'question') {
    const mine = await env.DB.prepare('SELECT choice FROM votes WHERE game_id = ? AND q_index = ? AND num = ?')
      .bind(g.id, g.q_index, call.num)
      .first();
    key = `q${g.q_index}-${mine ? 'voted' : 'open'}`;
    prompt = mine
      ? 'אפשר לשנות את התשובה עד שהתוצאות יוצגו'
      : `שאלה ${g.q_index + 1} הקישו את מספר התשובה ואחריו סולמית`;
  } else {
    key = `r${g.q_index}`;
    prompt = 'ממתינים לשאלה הבאה';
  }
  // אם לא השתנה כלום מאז הפעם הקודמת – הודעה קצרה בלבד
  if (!value && !isNew && call.last_key === key) prompt = key.startsWith('q') && key.endsWith('open') ? 'הקישו תשובה' : 'ממתינים';
  if (call.last_key !== key) {
    await env.DB.prepare('UPDATE calls SET last_key = ? WHERE call_id = ?').bind(key, call.call_id).run();
  }
  return await ask(env, call, [...pre, tts(prompt)]);
}

async function yemotParams(req) {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams);
  if (req.method === 'POST') {
    const ct = req.headers.get('content-type') || '';
    try {
      if (ct.includes('application/json')) Object.assign(params, await req.json());
      else Object.assign(params, Object.fromEntries(new URLSearchParams(await req.text())));
    } catch {}
  }
  return params;
}

// ---------- ניתוב ----------
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    try {
      // נקודת החיבור של ימות המשיח
      if (path === '/yemot' || path.startsWith('/yemot/')) {
        const params = await yemotParams(req);
        if (env.YEMOT_KEY && params.key !== env.YEMOT_KEY) return text(msgCmd([tts('אין הרשאה')]) + '&' + HANGUP);
        return text(await handleYemot(env, params));
      }

      // --- כניסת מארחת ---
      if (path === '/api/login' && method === 'POST') {
        const { code } = await body(req);
        const c = await env.DB.prepare('SELECT * FROM codes WHERE code = ?')
          .bind(String(code || '').trim())
          .first();
        const problem = codeProblem(c);
        if (problem) return err(problem, 403);
        const token = randomToken();
        await env.DB.prepare('INSERT INTO sessions (token, code, created_at) VALUES (?, ?, ?)')
          .bind(token, c.code, now())
          .run();
        return json({ token, label: c.label, gamesLeft: c.max_games ? c.max_games - c.games_used : null });
      }

      if (path.startsWith('/api/admin/')) return await adminRoutes(req, env, path, method);

      if (path.startsWith('/api/')) {
        const c = await hostAuth(req, env);
        if (!c) return err('צריך להיכנס מחדש עם קוד', 401);
        return await hostRoutes(req, env, path, method, c);
      }

      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error(e);
      if (path === '/yemot') return text(msgCmd([tts('אירעה תקלה נסו להתקשר שוב')]) + '&' + HANGUP);
      return err('שגיאת שרת: ' + e.message, 500);
    }
  },
};

async function hostRoutes(req, env, path, method, c) {
  if (path === '/api/me') {
    return json({ label: c.label, gamesLeft: c.max_games ? c.max_games - c.games_used : null, phoneInfo: env.PHONE_INFO || '' });
  }

  if (path === '/api/questions') {
    if (method === 'GET') {
      const custom = c.questions ? JSON.parse(c.questions) : null;
      return json({ questions: custom || (await getBank(env)), custom: !!custom });
    }
    if (method === 'PUT') {
      const { questions } = await body(req);
      const qs = cleanQuestions(questions);
      await env.DB.prepare('UPDATE codes SET questions = ? WHERE code = ?').bind(JSON.stringify(qs), c.code).run();
      return json({ questions: qs, custom: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('UPDATE codes SET questions = NULL WHERE code = ?').bind(c.code).run();
      return json({ questions: await getBank(env), custom: false });
    }
  }

  if (path === '/api/games' && method === 'POST') {
    if (c.max_games && c.games_used >= c.max_games) return err('נוצל מספר המשחקים בקוד הזה', 403);
    const b = await body(req);
    const questions = cleanQuestions(b.questions);
    if (!questions.length) return err('צריך לבחור לפחות שאלה אחת');
    const players = (Array.isArray(b.players) ? b.players : [])
      .map((p) => ({ name: String(p.name || '').trim().slice(0, 40), phone: normPhone(p.phone) }))
      .filter((p) => p.name);
    if (players.length < 2) return err('צריך לפחות 2 משתתפות');
    if (players.length > MAX_PLAYERS) return err(`עד ${MAX_PLAYERS} משתתפות`);
    const phones = players.map((p) => p.phone).filter(Boolean);
    if (new Set(phones).size !== phones.length) return err('יש מספר טלפון שמופיע פעמיים');
    for (const q of questions) {
      if (q.type === 'options' && q.options.length > 99) return err('יותר מדי תשובות');
    }
    const s = b.settings || {};
    const settings = {
      timerSec: Math.max(0, Math.min(600, Number(s.timerSec) || 0)),
      allowSelfVote: s.allowSelfVote !== false,
      autoReveal: !!s.autoReveal,
      showVoters: s.showVoters !== false,
    };
    // קוד משחק (PIN) ייחודי בין המשחקים הפעילים
    let pin;
    for (let i = 0; i < 20; i++) {
      pin = randomDigits(4);
      const ex = await env.DB.prepare("SELECT id FROM games WHERE pin = ? AND status != 'ended'").bind(pin).first();
      if (!ex) break;
    }
    const t = now();
    const r = await env.DB.prepare(
      `INSERT INTO games (code, pin, created_at, updated_at, status, q_index, phase, settings, questions)
       VALUES (?, ?, ?, ?, 'lobby', -1, 'lobby', ?, ?) RETURNING id`
    )
      .bind(c.code, pin, t, t, JSON.stringify(settings), JSON.stringify(questions))
      .first();
    const id = r.id;
    // אותו טלפון במשחק ישן שעוד פתוח – סוגרים את הישן כדי שהזיהוי יהיה חד-משמעי
    const stmts = players.map((p, i) =>
      env.DB.prepare('INSERT INTO players (game_id, num, name, phone) VALUES (?, ?, ?, ?)').bind(id, i + 1, p.name, p.phone || null)
    );
    stmts.push(env.DB.prepare('UPDATE codes SET games_used = games_used + 1 WHERE code = ?').bind(c.code));
    stmts.push(
      env.DB.prepare("UPDATE games SET status = 'ended', phase = 'ended' WHERE code = ? AND id != ? AND status != 'ended'").bind(c.code, id)
    );
    await env.DB.batch(stmts);
    return json({ id, pin });
  }

  const m = path.match(/^\/api\/games\/(\d+)(\/action|\/sim)?$/);
  if (m) {
    const g = await loadGame(env, Number(m[1]));
    if (!g || g.code !== c.code) return err('המשחק לא נמצא', 404);
    if (!m[2] && method === 'GET') return json(await gameState(env, g));
    if (m[2] === '/action' && method === 'POST') {
      const { action } = await body(req);
      const problem = await gameAction(env, g, action);
      if (problem) return err(problem);
      return json(await gameState(env, g));
    }
    // סימולטור טלפון לבדיקות (רק למארחת המחוברת)
    if (m[2] === '/sim' && method === 'POST') {
      const { params, simPlayer } = await body(req);
      const p = { ...(params || {}) };
      delete p.ApiPhone;
      if (simPlayer) {
        const pl = await env.DB.prepare('SELECT phone FROM players WHERE game_id = ? AND num = ?').bind(g.id, Number(simPlayer)).first();
        if (pl?.phone) p.ApiPhone = pl.phone;
      }
      return json({ response: await handleYemot(env, p) });
    }
  }

  return err('לא נמצא', 404);
}

async function adminRoutes(req, env, path, method) {
  if (!adminAuth(req, env)) return err('סיסמת ניהול שגויה (או שלא הוגדרה סיסמה)', 401);

  if (path === '/api/admin/codes') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT code, label, created_at, expires_at, max_games, games_used, active FROM codes ORDER BY created_at DESC'
      ).all();
      return json({ codes: results });
    }
    if (method === 'POST') {
      const b = await body(req);
      const code = String(b.code || '').trim() || randomDigits(6);
      if (!/^[A-Za-z0-9]{4,20}$/.test(code)) return err('קוד צריך להיות 4-20 אותיות באנגלית או ספרות');
      const days = Number(b.days) || 0;
      const max = Number(b.maxGames) || 0;
      try {
        await env.DB.prepare(
          'INSERT INTO codes (code, label, created_at, expires_at, max_games, games_used, active) VALUES (?, ?, ?, ?, ?, 0, 1)'
        )
          .bind(code, String(b.label || '').slice(0, 100), now(), days ? now() + days * 86400000 : null, max || null)
          .run();
      } catch {
        return err('הקוד כבר קיים');
      }
      return json({ code });
    }
  }

  const cm = path.match(/^\/api\/admin\/codes\/([A-Za-z0-9]+)$/);
  if (cm) {
    if (method === 'PATCH') {
      const b = await body(req);
      const sets = [];
      const vals = [];
      if ('active' in b) (sets.push('active = ?'), vals.push(b.active ? 1 : 0));
      if ('label' in b) (sets.push('label = ?'), vals.push(String(b.label || '').slice(0, 100)));
      if ('addDays' in b) {
        const c = await env.DB.prepare('SELECT expires_at FROM codes WHERE code = ?').bind(cm[1]).first();
        const base = Math.max(now(), c?.expires_at || now());
        sets.push('expires_at = ?');
        vals.push(Number(b.addDays) ? base + Number(b.addDays) * 86400000 : null);
      }
      if ('maxGames' in b) (sets.push('max_games = ?'), vals.push(Number(b.maxGames) || null));
      if ('resetUsed' in b) sets.push('games_used = 0');
      if (!sets.length) return err('אין שינויים');
      await env.DB.prepare(`UPDATE codes SET ${sets.join(', ')} WHERE code = ?`).bind(...vals, cm[1]).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE code = ?').bind(cm[1]),
        env.DB.prepare('DELETE FROM codes WHERE code = ?').bind(cm[1]),
      ]);
      return json({ ok: true });
    }
  }

  if (path === '/api/admin/bank') {
    if (method === 'GET') return json({ questions: await getBank(env) });
    if (method === 'PUT') {
      const { questions } = await body(req);
      return json({ questions: await setBank(env, questions) });
    }
  }

  return err('לא נמצא', 404);
}
