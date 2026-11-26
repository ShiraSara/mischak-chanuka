import { EXAMPLE_QUESTIONS } from './defaults.js';
import { ASSETS } from './assets.js';
import { readQuestionsFromImages, AiError, aiEnabled, diagnose } from './ai.js';
import { synthesize, diagnoseTts } from './tts.js';
import { makeProfiles } from './profiles.js';
import { publicTracks, serveTrack, adminMusic } from './music.js';

const MAX_PLAYERS = 15; // ברירת המחדל למספר משתתפות במשחק (ולתשובות קבועות בשאלה)
const HARD_MAX_PLAYERS = 50;
// כרטיסי ה-AI: כתיבות שרצות עכשיו (לפי משחק), וכמה זמן מחכים להן בלחיצה
const PROFILE_JOBS = new Map();
const PROFILE_WAIT_MS = 3500;
const HARD_MAX_PLAYERS_NOTE = 0; // הכי הרבה שאפשר להגדיר לקוד
const maxPlayersOf = (c) => Math.min(HARD_MAX_PLAYERS, Math.max(2, Number(c?.max_players) || MAX_PLAYERS));
// טלפון שמחכה להקשה פונה לשרת לפחות כל READ_SEC שניות; בלי פנייה דקה – כנראה ניתק
const CONNECTED_MS = 60 * 1000;
const MAX_EXTRA = 5; // תשובות נוספות לשאלת שמות
const READ_SEC = 30;
const REVEAL_MS = 2400; // זמן אנימציית הווילון – הטיימר מתחיל אחריו
const TOPIC_REVEAL_MS = 1600; // תוספת כשמוצג מסך "נושא חדש"
// זמן עד שהשאלה נחשפת (ארוך יותר כשמתחיל נושא חדש)
const revealDelay = (g, i) => REVEAL_MS + (g.questions[i]?.topic && (i === 0 || g.questions[i - 1]?.topic !== g.questions[i].topic) ? TOPIC_REVEAL_MS : 0);

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
    .map((q) => {
      const type = q.type === 'options' ? 'options' : 'names';
      // בשאלת שמות – options הן תשובות נוספות מעבר לשמות (למשל "אף אחת")
      const options = (Array.isArray(q.options) ? q.options : [])
        .map((o) => String(o || '').trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, type === 'options' ? MAX_PLAYERS : MAX_EXTRA);
      const out = { text: String(q.text || '').trim().slice(0, 300), type, options, topic: String(q.topic || '').trim().slice(0, 60) };
      // זמנים אישיים לשאלה (לא חובה): כמה זמן לשאלה, כמה זמן לתוצאות
      if (q.timerSec != null && q.timerSec !== '') out.timerSec = Math.max(0, Math.min(600, Number(q.timerSec) || 0));
      if (q.resultsSec != null && q.resultsSec !== '') out.resultsSec = Math.max(2, Math.min(60, Number(q.resultsSec) || 5));
      return out;
    })
    .filter((q) => q.text && (q.type === 'names' || q.options.length >= 2));
}

// ---------- מאגר שאלות כללי ----------
// אין מאגרים מובנים – המאגרים נוצרים במסך הניהול
async function listBanks(env, { all = false } = {}) {
  const { results } = await env.DB.prepare(
    `SELECT b.*, (SELECT COUNT(*) FROM bank q WHERE q.bank_id = b.id) AS count FROM banks b ORDER BY b.sort, b.id`
  ).all();
  return results.filter((b) => all || (b.active && b.count > 0));
}

async function getBankQuestions(env, bankId) {
  const { results } = await env.DB.prepare('SELECT * FROM bank WHERE bank_id = ? ORDER BY sort, id').bind(bankId).all();
  return results.map((r) => ({
    text: r.text,
    type: r.type,
    options: JSON.parse(r.options || '[]'),
    topic: r.topic || '',
    ...(r.timer_sec != null ? { timerSec: r.timer_sec } : {}),
    ...(r.results_sec != null ? { resultsSec: r.results_sec } : {}),
  }));
}

async function setBankQuestions(env, bankId, list) {
  const qs = cleanQuestions(list);
  const stmts = [env.DB.prepare('DELETE FROM bank WHERE bank_id = ?').bind(bankId)];
  qs.forEach((q, i) =>
    stmts.push(
      env.DB.prepare('INSERT INTO bank (bank_id, text, type, options, topic, sort, timer_sec, results_sec) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
        bankId,
        q.text,
        q.type,
        JSON.stringify(q.options),
        q.topic,
        i,
        q.timerSec ?? null,
        q.resultsSec ?? null
      )
    )
  );
  await env.DB.batch(stmts);
  return qs;
}

// ---------- הרשאות ----------
function codeProblem(c) {
  if (!c || c.deleted_at) return 'הקוד לא קיים';
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
  if (typeof g.profiles !== 'string') g.profiles = g.profiles ?? null;
  g.questions = JSON.parse(g.questions || '[]');
  return g;
}

async function loadPlayers(env, gameId) {
  const { results } = await env.DB.prepare('SELECT * FROM players WHERE game_id = ? ORDER BY num')
    .bind(gameId)
    .all();
  return results;
}

function optionsFor(q, players, upto) {
  if (!q) return [];
  if (upto) players = players.filter((p) => p.num <= upto); // משתתפת שהצטרפה באמצע – רק מהשאלה הבאה
  if (q.type === 'names') {
    // השמות, ואחריהם התשובות הנוספות (ממוספרות אחרי המשתתפת האחרונה)
    const last = players.reduce((m, p) => Math.max(m, p.num), 0);
    return [
      ...players.map((p) => ({ n: p.num, label: p.name })),
      ...(q.options || []).map((label, i) => ({ n: last + i + 1, label, extra: true })),
    ];
  }
  return q.options.map((label, i) => ({ n: i + 1, label }));
}

async function setPhase(env, g, fields) {
  const merged = { ...fields, updated_at: now() };
  // מעבר שלב / שאלה חדשה מבטל עצירה
  if ('phase' in fields || 'q_started_at' in fields) merged.paused_at = null;
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
  let votes = g.q_index >= 0 ? await votesFor(env, g.id, g.q_index) : [];

  // חשיפה אוטומטית: כולן הצביעו או שהזמן נגמר
  const auto = !!g.settings.autoPlay;
  // כשהטיימר נגמר – תמיד עוברים לתוצאות. "כולן הצביעו" – רק במשחק אוטומטי / חשיפה אוטומטית.
  if (g.phase === 'question' && !g.paused_at) {
    const allVoted = (g.settings.autoReveal || auto) && players.length > 0 && votes.length >= players.length;
    const timeUp = qTimer(g) > 0 && now() - g.q_started_at > qTimer(g) * 1000 + 1500;
    if ((allVoted || timeUp) && (await claimPhase(env, g))) {
      await setPhase(env, g, { phase: 'results' });
    }
  }
  // מעבר אוטומטי: אחרי כמה שניות של תוצאות (או טבלת מובילות) – לשאלה הבאה
  if (auto && !g.paused_at && (g.phase === 'results' || g.phase === 'board')) {
    const holdMs = autoHoldMs(g);
    if (now() - g.updated_at > holdMs && (await claimPhase(env, g))) {
      await gameAction(env, g, 'next');
      votes = g.q_index >= 0 ? await votesFor(env, g.id, g.q_index) : [];
    }
  }

  // השאלה הנוכחית – אחרי מעברים אוטומטיים אפשריים
  const q = g.questions[g.q_index];
  const upto = await roundPlayers(env, g.id);
  const opts = optionsFor(q, players, upto.get(g.q_index));

  const voted = new Set(votes.map((v) => v.num));
  const state = {
    serverNow: now(),
    game: {
      id: g.id,
      phase: g.phase,
      status: g.status,
      qIndex: g.q_index,
      total: g.questions.length,
      qStartedAt: g.q_started_at,
      timerSec: g.q_index >= 0 ? qTimer(g) : Number(g.settings.timerSec) || 0, // זמן השאלה הנוכחית
      pausedAt: g.paused_at || null,
      phaseAt: g.updated_at,
      autoAt: g.settings.autoPlay && !g.paused_at && (g.phase === 'results' || g.phase === 'board') ? g.updated_at + autoHoldMs(g) : null,
      maxPlayers: maxPlayersOf(await env.DB.prepare('SELECT max_players FROM codes WHERE code = ?').bind(g.code).first()),
      settings: g.settings,
    },
    players: players.map((p) => ({
      num: p.num,
      name: p.name,
      hasPhone: !!p.phone,
      phone: p.phone || '',
      connected: !!p.last_seen && now() - p.last_seen < CONNECTED_MS,
      voted: voted.has(p.num),
    })),
    question: q
      ? {
          text: q.text,
          type: q.type,
          options: opts,
          topic: q.topic || '',
          // נושא חדש מתחיל כאן? (במעבר בין נושאים מוצג מסך "נושא חדש")
          topicChanged: !!q.topic && (g.q_index === 0 || (g.questions[g.q_index - 1]?.topic || '') !== q.topic),
        }
      : null,
    votesCount: votes.length,
  };
  if (g.phase === 'results' || g.phase === 'ended') {
    if (q) state.results = tally(opts, votes);
  }
  if (g.phase === 'board') state.scores = await computeScores(env, g, players, g.q_index);
  if (g.phase === 'ended') {
    state.scores = await computeScores(env, g, players, g.questions.length - 1);
    const { results: all } = await env.DB.prepare('SELECT q_index, num, choice FROM votes WHERE game_id = ?')
      .bind(g.id)
      .all();
    state.summary = g.questions.map((qq, i) => {
      const t = tally(optionsFor(qq, players, upto.get(i)), all.filter((v) => v.q_index === i));
      const top = t[0]?.count || 0;
      return {
        text: qq.text,
        votes: t.reduce((s, o) => s + o.count, 0),
        winners: top > 0 ? t.filter((o) => o.count === top).map((o) => o.label) : [],
        top,
        results: t.filter((o) => o.count > 0).map((o) => ({ label: o.label, count: o.count })),
      };
    });
  }
  return state;
}

// ---------- ניקוד ----------
// 100 נקודות למי שהצביעה כמו הרוב + בונוס מהירות עד 50 (לפי כמה מהר הצביעה מתחילת השאלה)
const MAJORITY_POINTS = 100;
const SPEED_POINTS = 50;

async function computeScores(env, g, players, uptoIndex) {
  const { results: votes } = await env.DB.prepare('SELECT q_index, num, choice, at FROM votes WHERE game_id = ? AND q_index <= ?')
    .bind(g.id, uptoIndex)
    .all();
  const { results: rounds } = await env.DB.prepare('SELECT q_index, started_at, players FROM rounds WHERE game_id = ?').bind(g.id).all();
  const startOf = new Map(rounds.map((r) => [r.q_index, r.started_at]));
  const uptoOf = new Map(rounds.map((r) => [r.q_index, r.players]));
  const score = new Map(players.map((p) => [p.num, { num: p.num, name: p.name, points: 0, hits: 0, times: [] }]));

  for (let i = 0; i <= uptoIndex; i++) {
    const qv = votes.filter((v) => v.q_index === i);
    if (!qv.length) continue;
    const t = tally(optionsFor(g.questions[i], players, uptoOf.get(i)), qv);
    const top = t[0]?.count || 0;
    const winners = new Set(t.filter((o) => o.count === top).map((o) => o.n));
    const limitMs = (qTimer(g, i) || 30) * 1000;
    const start = startOf.get(i);
    for (const v of qv) {
      const s = score.get(v.num);
      if (!s) continue;
      const ms = start ? Math.max(0, v.at - start) : null;
      if (ms !== null) s.times.push(ms);
      if (winners.has(v.choice)) {
        s.hits += 1;
        s.points += MAJORITY_POINTS;
      }
      if (ms !== null) s.points += Math.round(SPEED_POINTS * Math.max(0, 1 - ms / limitMs));
    }
  }
  const list = [...score.values()].map((s) => ({
    num: s.num,
    name: s.name,
    points: s.points,
    hits: s.hits,
    answered: s.times.length,
    avgSec: s.times.length ? Math.round(s.times.reduce((a, b) => a + b, 0) / s.times.length / 100) / 10 : null,
  }));
  list.sort((a, b) => b.points - a.points || (a.avgSec ?? 999) - (b.avgSec ?? 999));
  const fastest = list.filter((s) => s.avgSec !== null).sort((a, b) => a.avgSec - b.avgSec)[0] || null;
  return { ranking: list, fastest, rounds: uptoIndex + 1 };
}

async function markRound(env, g, qIndex, startedAt, replace = false) {
  const m = await env.DB.prepare('SELECT MAX(num) AS m FROM players WHERE game_id = ?').bind(g.id).first();
  await env.DB.prepare(`INSERT OR ${replace ? 'REPLACE' : 'IGNORE'} INTO rounds (game_id, q_index, started_at, players) VALUES (?, ?, ?, ?)`)
    .bind(g.id, qIndex, startedAt, m?.m || null)
    .run();
}

// כמה משתתפות היו בכל שאלה (q_index → מספר)
async function roundPlayers(env, gameId) {
  const { results } = await env.DB.prepare('SELECT q_index, players FROM rounds WHERE game_id = ?').bind(gameId).all();
  return new Map(results.map((r) => [r.q_index, r.players]));
}

// זמן השאלה / התוצאות – של השאלה עצמה אם הוגדר לה, אחרת של המשחק
const qTimer = (g, i = g.q_index) => g.questions[i]?.timerSec ?? (Number(g.settings.timerSec) || 0);
const qResults = (g, i = g.q_index) => g.questions[i]?.resultsSec ?? (Number(g.settings.resultsSec) || 8);

// כמה זמן להשאיר תוצאות / טבלת מובילות במצב אוטומטי
function autoHoldMs(g) {
  const sec = g.phase === 'board' ? Number(g.settings.resultsSec) || 8 : qResults(g);
  return (g.phase === 'board' ? sec + 6 : sec) * 1000;
}

// "תופס" את המעבר האוטומטי כדי שרק מסך אחד יבצע אותו (אם כמה מסכים פתוחים)
async function claimPhase(env, g) {
  const t = now();
  const r = await env.DB.prepare('UPDATE games SET updated_at = ? WHERE id = ? AND phase = ? AND q_index = ? AND updated_at = ?')
    .bind(t, g.id, g.phase, g.q_index, g.updated_at)
    .run();
  if (!r.meta.changes) {
    const fresh = await loadGame(env, g.id);
    Object.assign(g, fresh);
    return false;
  }
  g.updated_at = t;
  return true;
}

// הגדרות משחק – ניקוי ואימות (גם ביצירה וגם בשינוי באמצע המשחק)
function cleanSettings(s, base = {}) {
  const v = { ...base, ...s };
  return {
    timerSec: Math.max(0, Math.min(600, Number(v.timerSec) || 0)),
    allowSelfVote: v.allowSelfVote !== false,
    autoReveal: !!v.autoReveal,
    showVoters: v.showVoters !== false,
    boardEvery: Math.max(0, Math.min(20, Number(v.boardEvery) || 0)),
    autoPlay: !!v.autoPlay,
    resultsSec: Math.max(3, Math.min(60, Number(v.resultsSec) || 5)),
    title: String(v.title || '').trim().slice(0, 60), // שם המשחק (לא חובה)
    profiles: v.profiles !== false, // "מי את בעצם?" בסוף המשחק
  };
}

async function gameAction(env, g, action, payload = {}) {
  const total = g.questions.length;
  const every = Number(g.settings.boardEvery) || 0;
  switch (action) {
    case 'start': {
      if (!total) return 'אין שאלות במשחק';
      const t = now() + revealDelay(g, 0);
      await setPhase(env, g, { status: 'live', q_index: 0, phase: 'question', q_started_at: t });
      await markRound(env, g, 0, t);
      break;
    }
    case 'reveal':
      await setPhase(env, g, { phase: 'results' });
      break;
    case 'next': {
      if (g.q_index + 1 >= total) {
        await setPhase(env, g, { phase: 'ended', status: 'ended' });
        break;
      }
      // כל כמה שאלות – טבלת מובילות לפני השאלה הבאה
      if (g.phase === 'results' && every && (g.q_index + 1) % every === 0) {
        await setPhase(env, g, { phase: 'board' });
        break;
      }
      const t = now() + revealDelay(g, g.q_index + 1);
      await setPhase(env, g, { q_index: g.q_index + 1, phase: 'question', q_started_at: t });
      await markRound(env, g, g.q_index, t);
      break;
    }
    case 'prev':
      if (g.phase === 'board') await setPhase(env, g, { phase: 'results' });
      else if (g.q_index > 0) await setPhase(env, g, { q_index: g.q_index - 1, phase: 'results', status: 'live' });
      break;
    case 'reopen':
      await setPhase(env, g, { phase: 'question', q_started_at: now(), status: 'live' });
      break;
    case 'restart_question': {
      await env.DB.prepare('DELETE FROM votes WHERE game_id = ? AND q_index = ?').bind(g.id, g.q_index).run();
      const t = now();
      await setPhase(env, g, { phase: 'question', q_started_at: t, status: 'live' });
      await markRound(env, g, g.q_index, t, true);
      break;
    }
    case 'end':
      await setPhase(env, g, { phase: 'ended', status: 'ended' });
      break;
    // משחק אוטומטי – הפעלה / כיבוי (העצירה עצמה היא pause / resume)
    case 'auto_on':
    case 'auto_off': {
      const settings = { ...g.settings, autoPlay: action === 'auto_on' };
      await setPhase(env, g, { settings: JSON.stringify(settings) });
      g.settings = settings;
      break;
    }
    // עצירה בכל רגע: השעון קופא, אין מעבר אוטומטי
    case 'pause':
      if (!g.paused_at) await setPhase(env, g, { paused_at: now() });
      break;
    // המשך: בשאלה – מאותה שנייה; בתוצאות / טבלה – הספירה למעבר מתחילה מחדש
    case 'resume': {
      if (!g.paused_at) break;
      const t = now();
      const fields = { paused_at: null };
      if (g.phase === 'question') {
        fields.q_started_at = g.q_started_at + (t - g.paused_at);
        await env.DB.prepare('UPDATE rounds SET started_at = started_at + ? WHERE game_id = ? AND q_index = ?')
          .bind(t - g.paused_at, g.id, g.q_index)
          .run();
      }
      await setPhase(env, g, fields);
      break;
    }
    // שינוי שם של משתתפת באמצע המשחק
    case 'rename': {
      const name = String(payload.name || '').trim().slice(0, 40);
      if (!name) return 'צריך שם';
      await env.DB.prepare('UPDATE players SET name = ? WHERE game_id = ? AND num = ?').bind(name, g.id, Number(payload.num)).run();
      break;
    }
    // הוספת משתתפת באמצע המשחק (מקבלת את המספר הבא; משתתפת בשאלות שמתחילות מעכשיו)
    case 'add_player': {
      const name = String(payload.name || '').trim().slice(0, 40);
      const phone = normPhone(payload.phone);
      if (!name) return 'צריך שם';
      const code = await env.DB.prepare('SELECT max_players FROM codes WHERE code = ?').bind(g.code).first();
      const list = await loadPlayers(env, g.id);
      if (list.length >= maxPlayersOf(code)) return `אפשר עד ${maxPlayersOf(code)} משתתפות במשחק`;
      if (phone && list.some((p) => p.phone === phone)) return 'המספר הזה כבר רשום במשחק';
      const num = list.reduce((m, p) => Math.max(m, p.num), 0) + 1;
      await env.DB.prepare('INSERT INTO players (game_id, num, name, phone) VALUES (?, ?, ?, ?)').bind(g.id, num, name, phone || null).run();
      break;
    }
    // שינוי הגדרות באמצע המשחק (מהפאנל הצדדי)
    case 'settings': {
      const settings = cleanSettings(payload.settings || {}, g.settings);
      const autoChanged = settings.autoPlay !== !!g.settings.autoPlay;
      await env.DB.prepare('UPDATE games SET settings = ? WHERE id = ?').bind(JSON.stringify({ ...settings, autoPlay: !!g.settings.autoPlay }), g.id).run();
      g.settings = { ...settings, autoPlay: !!g.settings.autoPlay };
      // הפעלה / כיבוי של אוטומטי מהפאנל – כמו כפתור העצירה (כולל הקפאת הטיימר)
      if (autoChanged) return gameAction(env, g, settings.autoPlay ? 'auto_on' : 'auto_off');
      break;
    }
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
// מה הקו אומר בזמן ההמתנה להקשה (כל READ_SEC שניות בלי הקשה).
// טקסט ריק או קובץ שלא קיים גורמים למערכת להכריז "שגיאה" – לכן משפט קצר לפי שלב המשחק.
// אם יועלה לשלוחה קובץ שקט, אפשר להגדיר ב-Cloudflare משתנה YEMOT_SILENT_FILE (למשל 000) – ואז יהיה שקט מוחלט.
function waitPrompt(env, g) {
  if (env.YEMOT_SILENT_FILE) return 'f-' + String(env.YEMOT_SILENT_FILE).replace(/[^\w-]/g, '');
  if (g.phase === 'lobby') return tts('המשחק יתחיל בקרוב');
  if (g.phase === 'question') return tts('הקישי מספר ואחריו סולמית');
  return tts('המתיני לשאלה הבאה');
}

export async function handleYemot(env, params) {
  if (params.hangup === 'yes') {
    const id = params.ApiCallId || params.ApiYFCallId;
    const c = id && (await env.DB.prepare('SELECT * FROM calls WHERE call_id = ?').bind(id).first());
    if (c?.game_id && c.num) {
      await env.DB.prepare(
        `UPDATE players SET last_seen = NULL WHERE game_id = ? AND num = ?
         AND NOT EXISTS (SELECT 1 FROM calls WHERE game_id = ? AND num = ? AND created_at > ?)`
      )
        .bind(c.game_id, c.num, c.game_id, c.num, c.created_at)
        .run();
    }
    return '';
  }
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

    if (call.stage === 'play') return await playTurn(env, call, null);
    // מספר שלא רשום באף משחק פעיל (או מספר חסוי) – אין דרך להצטרף
    return msgCmd([tts('המספר שלך לא רשום במשחק בקשי מהמארחת להוסיף אותו')]) + '&' + HANGUP;
  }

  const raw = params['v' + call.step];
  const value = raw === undefined || raw === 'None' || raw === '' ? null : String(raw).replace(/\D/g, '');

  return await playTurn(env, call, value);
}

async function ask(env, call, messages, opts, prefix = '') {
  call.step += 1;
  await env.DB.prepare('UPDATE calls SET step = ? WHERE call_id = ?').bind(call.step, call.call_id).run();
  return (prefix ? prefix + '&' : '') + readCmd(messages, 'v' + call.step, opts);
}

async function playTurn(env, call, value) {
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

  // מצב שקט: אין פתיח ואין הודעות המתנה. מדברים רק אחרי הקשה – אישור קצר או הודעת שגיאה.
  const say = [];
  if (value) {
    if (g.phase !== 'question') {
      say.push(tts(g.phase === 'lobby' ? 'המשחק עוד לא התחיל' : 'ההצבעה נסגרה'));
    } else {
      const choice = Number(value);
      const players = await loadPlayers(env, g.id);
      const opts = optionsFor(g.questions[g.q_index], players, (await roundPlayers(env, g.id)).get(g.q_index));
      if (!opts.some((o) => o.n === choice)) {
        say.push(tts('אין מספר כזה'));
      } else if (g.settings.allowSelfVote === false && g.questions[g.q_index].type === 'names' && choice === call.num) {
        say.push(tts('אי אפשר להצביע לעצמך'));
      } else {
        await env.DB.prepare(
          `INSERT INTO votes (game_id, q_index, num, choice, at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(game_id, q_index, num) DO UPDATE SET choice = excluded.choice, at = excluded.at`
        )
          .bind(g.id, g.q_index, call.num, choice, now())
          .run();
        say.push(tts('נקלט'), `n-${choice}`);
      }
    }
  }
  return await ask(env, call, say.length ? say : [waitPrompt(env, g)]);
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
  async fetch(req, env, ctx) {
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

      // מנגינות: רשימה וקבצים (פתוח), וניהול (עם סיסמה)
      if (path === '/api/music' && method === 'GET') return await publicTracks(env);
      const mt = path.match(/^\/music\/([a-z0-9]+)$/);
      if (mt && method === 'GET') return await serveTrack(req, env, mt[1]);
      if (path.startsWith('/api/admin/music')) {
        if (!adminAuth(req, env)) return err('סיסמת ניהול שגויה', 401);
        return await adminMusic(req, env, path, method);
      }

      if (path.startsWith('/api/admin/')) return await adminRoutes(req, env, path, method);

      if (path.startsWith('/api/')) {
        const c = await hostAuth(req, env);
        if (!c) return err('צריך להיכנס מחדש עם קוד', 401);
        return await hostRoutes(req, env, path, method, c, ctx);
      }

      return serveAsset(path);
    } catch (e) {
      console.error(e);
      if (path === '/yemot') return text(msgCmd([tts('אירעה תקלה נסו להתקשר שוב')]) + '&' + HANGUP);
      return err('שגיאת שרת: ' + e.message, 500);
    }
  },
};

async function hostRoutes(req, env, path, method, c, ctx) {
  const url = new URL(req.url);
  if (path === '/api/me') {
    return json({
      label: c.label,
      gamesLeft: c.max_games ? c.max_games - c.games_used : null,
      phoneInfo: env.PHONE_INFO || '',
      maxPlayers: maxPlayersOf(c),
      ai: aiQuota(env, c),
    });
  }

  // קריין בקול AI – עם מטמון כדי שאותו משפט לא ייווצר פעמיים
  if (path === '/api/tts' && method === 'POST') {
    const { text, voice } = await body(req);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${voice}|${text}`));
    const key = 'https://tts-cache.local/' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const cache = caches.default;
    const hit = await cache.match(key);
    if (hit) return hit;
    try {
      const { bytes, mime } = await synthesize(env, text, voice);
      const res = new Response(bytes, { headers: { 'content-type': mime, 'cache-control': 'public, max-age=2592000' } });
      await cache.put(key, res.clone());
      return res;
    } catch (e) {
      if (e instanceof AiError) return err(e.message, 503);
      throw e;
    }
  }

  // קריאת שאלות מתמונה (Claude)
  if (path === '/api/ai/import' && method === 'POST') {
    const quota = aiQuota(env, c);
    if (!quota.enabled) return err('קריאת תמונות עוד לא הופעלה באתר', 503);
    if (quota.left <= 0) return err(`נוצלו כל ${quota.limit} הקריאות של החודש. אפשר לפנות אלינו להגדלה.`, 429);
    const { images } = await body(req);
    try {
      const r = await readQuestionsFromImages(env, images);
      await env.DB.prepare('UPDATE codes SET ai_used = ?, ai_month = ? WHERE code = ?')
        .bind(quota.used + 1, quota.month, c.code)
        .run();
      return json({ questions: r.questions, note: r.note, left: quota.left - 1 });
    } catch (e) {
      if (e instanceof AiError) return err(e.message, 400);
      throw e;
    }
  }

  // המאגרים שאפשר לבחור מהם (וגם "השאלות שלי" אם שמרה)
  if (path === '/api/banks' && method === 'GET') {
    const banks = (await listBanks(env)).map(({ id, name, description, icon, count }) => ({ id, name, description, icon, count }));
    const mine = c.questions ? JSON.parse(c.questions) : null;
    if (mine?.length) banks.unshift({ id: 'mine', name: 'השאלות שלי', description: 'הרשימה ששמרת', icon: '💾', count: mine.length });
    return json({ banks });
  }

  if (path === '/api/questions') {
    if (method === 'GET') {
      const bank = url.searchParams.get('bank');
      if (bank === 'mine') return json({ questions: c.questions ? JSON.parse(c.questions) : [] });
      const banks = await listBanks(env);
      const id = Number(bank) || banks[0]?.id;
      if (!banks.some((b) => b.id === id)) return err('המאגר לא נמצא', 404);
      return json({ questions: await getBankQuestions(env, id) });
    }
    if (method === 'PUT') {
      const { questions } = await body(req);
      const qs = cleanQuestions(questions);
      await env.DB.prepare('UPDATE codes SET questions = ? WHERE code = ?').bind(JSON.stringify(qs), c.code).run();
      return json({ questions: qs });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('UPDATE codes SET questions = NULL WHERE code = ?').bind(c.code).run();
      return json({ ok: true });
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
    if (players.length > maxPlayersOf(c)) return err(`בקוד הזה אפשר עד ${maxPlayersOf(c)} משתתפות`);
    const phones = players.map((p) => p.phone).filter(Boolean);
    if (new Set(phones).size !== phones.length) return err('יש מספר טלפון שמופיע פעמיים');
    for (const q of questions) {
      if (q.type === 'options' && q.options.length > 99) return err('יותר מדי תשובות');
    }
    const settings = cleanSettings(b.settings || {});
    // מזהה פנימי (העמודה קיימת במסד הנתונים; לא מוצג לאף אחד)
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
    return json({ id });
  }

  const m = path.match(/^\/api\/games\/(\d+)(\/action|\/sim|\/profiles)?$/);
  if (m) {
    const g = await loadGame(env, Number(m[1]));
    if (!g || g.code !== c.code) return err('המשחק לא נמצא', 404);
    if (!m[2] && method === 'GET') return json(await gameState(env, g));
    // "מי את בעצם?" – נוצר פעם אחת ונשמר (אפשר לבקש מחדש)
    // "אז מה למדתי עלייך?" – נכתב מראש במהלך המשחק (prefetch), ובלחיצה מוצג תוך שניות
    if (m[2] === '/profiles' && method === 'POST') {
      const { regenerate, prefetch } = await body(req);
      const players = await loadPlayers(env, g.id);
      const { results: votes } = await env.DB.prepare('SELECT q_index, num, choice FROM votes WHERE game_id = ?').bind(g.id).all();
      // "חתימה" של ההצבעות – אם השתנו מאז שהכרטיסים נכתבו, כותבים מחדש
      const sig = `${votes.length}:${votes.reduce((t, v) => t + (v.q_index + 1) * 131 + v.num * 17 + v.choice, 0)}`;
      const cached = g.profiles ? JSON.parse(g.profiles) : null;
      if (cached?.ai && !regenerate && cached.sig === sig) return json(cached);

      // כתיבה אחת בכל פעם לכל משחק (אם כבר כותבים לאותה חתימה – מצטרפים אליה)
      let job = PROFILE_JOBS.get(g.id);
      if (!job || job.sig !== sig) {
        const promise = makeProfiles(env, g, players, votes)
          .then(async (r) => {
            const out = { ...r, sig };
            if (out.ai) await env.DB.prepare('UPDATE games SET profiles = ? WHERE id = ?').bind(JSON.stringify(out), g.id).run();
            return out;
          })
          .finally(() => PROFILE_JOBS.get(g.id)?.promise === promise && PROFILE_JOBS.delete(g.id));
        job = { sig, promise };
        PROFILE_JOBS.set(g.id, job);
      }
      ctx?.waitUntil(job.promise.catch(() => {})); // ממשיך לכתוב גם אחרי שהתשובה נשלחה
      if (prefetch) return json({ queued: true });
      // מחכים עד PROFILE_WAIT_MS לגרסה המעודכנת; אחרת – הטיוטה האחרונה, ואם אין – משפטי גיבוי
      const fresh = await Promise.race([
        job.promise.catch((e) => (console.error('profiles failed', e), { failed: String(e?.message || e) })),
        new Promise((r) => setTimeout(() => r(null), PROFILE_WAIT_MS)),
      ]);
      if (fresh && !fresh.failed) return json(fresh);
      const why = fresh?.failed || 'ה-AI לא הספיק לענות בזמן';
      if (cached?.ai) return json({ ...cached, draft: true, aiError: why });
      return json({ ...(await makeProfiles(env, g, players, votes, { noAi: true })), draft: true, aiError: why });
    }
    if (m[2] === '/action' && method === 'POST') {
      const { action, settings, num, name, phone } = await body(req);
      const problem = await gameAction(env, g, action, { settings, num, name, phone });
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

// מכסת קריאות תמונה חודשית לקוד
function aiQuota(env, c) {
  const month = new Date().toISOString().slice(0, 7);
  const limit = c.ai_limit ?? (Number(env.AI_DEFAULT_LIMIT) || 20);
  const used = c.ai_month === month ? c.ai_used || 0 : 0;
  return { enabled: aiEnabled(env), limit, used, left: Math.max(0, limit - used), month };
}

async function adminRoutes(req, env, path, method) {
  if (!adminAuth(req, env)) return err('סיסמת ניהול שגויה (או שלא הוגדרה סיסמה)', 401);

  if (path === '/api/admin/codes') {
    if (method === 'GET') {
      // קודים שנמחקו לפני יותר מ-30 יום – נמחקים סופית
      const old = now() - 30 * 86400000;
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE code IN (SELECT code FROM codes WHERE deleted_at < ?)').bind(old),
        env.DB.prepare('DELETE FROM codes WHERE deleted_at < ?').bind(old),
      ]);
      const { results } = await env.DB.prepare(
        'SELECT code, label, created_at, expires_at, max_games, games_used, active, ai_used, ai_month, ai_limit, max_players, deleted_at FROM codes ORDER BY created_at DESC'
      ).all();
      const month = new Date().toISOString().slice(0, 7);
      const def = Number(env.AI_DEFAULT_LIMIT) || 20;
      return json({
        codes: results.map((r) => ({ ...r, ai_used: r.ai_month === month ? r.ai_used || 0 : 0, ai_limit_effective: r.ai_limit ?? def })),
      });
    }
    if (method === 'POST') {
      const b = await body(req);
      const code = String(b.code || '').trim() || randomDigits(6);
      if (!/^[A-Za-z0-9]{4,20}$/.test(code)) return err('קוד צריך להיות 4-20 אותיות באנגלית או ספרות');
      const days = Number(b.days) || 0;
      const max = Number(b.maxGames) || 0;
      try {
        await env.DB.prepare(
          'INSERT INTO codes (code, label, created_at, expires_at, max_games, games_used, active, max_players) VALUES (?, ?, ?, ?, ?, 0, 1, ?)'
        )
          .bind(code, String(b.label || '').slice(0, 100), now(), days ? now() + days * 86400000 : null, max || null, Number(b.maxPlayers) ? maxPlayersOf({ max_players: b.maxPlayers }) : null)
          .run();
      } catch {
        return err('הקוד כבר קיים');
      }
      return json({ code });
    }
  }

  // פעולה על כמה קודים יחד: מחיקה (לסל), שחזור, מחיקה לצמיתות, השבתה
  if (path === '/api/admin/codes/bulk' && method === 'POST') {
    const { codes = [], action } = await body(req);
    const list = codes.map(String).filter((c) => /^[A-Za-z0-9]+$/.test(c)).slice(0, 500);
    const stmts = [];
    for (const c of list) {
      if (action === 'delete')
        stmts.push(env.DB.prepare('UPDATE codes SET deleted_at = ? WHERE code = ?').bind(now(), c), env.DB.prepare('DELETE FROM sessions WHERE code = ?').bind(c));
      else if (action === 'restore') stmts.push(env.DB.prepare('UPDATE codes SET deleted_at = NULL WHERE code = ?').bind(c));
      else if (action === 'forever')
        stmts.push(env.DB.prepare('DELETE FROM sessions WHERE code = ?').bind(c), env.DB.prepare('DELETE FROM codes WHERE code = ?').bind(c));
      else if (action === 'disable') stmts.push(env.DB.prepare('UPDATE codes SET active = 0 WHERE code = ?').bind(c));
      else if (action === 'enable') stmts.push(env.DB.prepare('UPDATE codes SET active = 1 WHERE code = ?').bind(c));
      else return err('פעולה לא מוכרת');
    }
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true, count: list.length });
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
      if ('maxPlayers' in b) (sets.push('max_players = ?'), vals.push(Number(b.maxPlayers) ? maxPlayersOf({ max_players: b.maxPlayers }) : null));
      if ('resetUsed' in b) sets.push('games_used = 0');
      if ('restore' in b) sets.push('deleted_at = NULL');
      if ('aiLimit' in b) (sets.push('ai_limit = ?'), vals.push(b.aiLimit === null || b.aiLimit === '' ? null : Math.max(0, Number(b.aiLimit) || 0)));
      if (!sets.length) return err('אין שינויים');
      await env.DB.prepare(`UPDATE codes SET ${sets.join(', ')} WHERE code = ?`).bind(...vals, cm[1]).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      // רגיל – לסל המחזור (הקוד מפסיק לעבוד מיד); ?forever=1 – מחיקה סופית
      const forever = new URL(req.url).searchParams.get('forever') === '1';
      await env.DB.batch(
        forever
          ? [env.DB.prepare('DELETE FROM sessions WHERE code = ?').bind(cm[1]), env.DB.prepare('DELETE FROM codes WHERE code = ?').bind(cm[1])]
          : [env.DB.prepare('UPDATE codes SET deleted_at = ? WHERE code = ?').bind(now(), cm[1]), env.DB.prepare('DELETE FROM sessions WHERE code = ?').bind(cm[1])]
      );
      return json({ ok: true });
    }
  }

  if (path === '/api/admin/ai-check' && method === 'POST') {
    const [main, voice] = await Promise.all([diagnose(env), aiEnabled(env) ? diagnoseTts(env) : {}]);
    return json({ ...main, ...voice });
  }

  // ---- מאגרי שאלות ----
  if (path === '/api/admin/banks') {
    if (method === 'GET') return json({ banks: await listBanks(env, { all: true }) });
    if (method === 'POST') {
      const b = await body(req);
      const name = String(b.name || '').trim().slice(0, 40);
      if (!name) return err('צריך שם למאגר');
      const max = await env.DB.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM banks').first();
      const r = await env.DB.prepare('INSERT INTO banks (name, description, icon, sort) VALUES (?, ?, ?, ?) RETURNING id')
        .bind(name, String(b.description || '').slice(0, 120), String(b.icon || '📚').slice(0, 4), max.m + 1)
        .first();
      // מאגר חדש מתחיל עם 2 שאלות לדוגמה (אפשר למחוק)
      if (b.examples !== false) await setBankQuestions(env, r.id, EXAMPLE_QUESTIONS);
      return json({ id: r.id });
    }
  }
  // סל מחזור של מאגר: שאלות שנמחקו נשמרות 30 יום
  const tm = path.match(/^\/api\/admin\/banks\/(\d+)\/trash$/);
  if (tm) {
    const bankId = Number(tm[1]);
    if (method === 'GET') {
      await env.DB.prepare('DELETE FROM bank_trash WHERE deleted_at < ?').bind(now() - 30 * 86400000).run();
      const { results } = await env.DB.prepare('SELECT id, q, deleted_at FROM bank_trash WHERE bank_id = ? ORDER BY deleted_at DESC, id DESC')
        .bind(bankId)
        .all();
      return json({ trash: results.map((r) => ({ id: r.id, deletedAt: r.deleted_at, q: JSON.parse(r.q) })) });
    }
    if (method === 'POST') {
      const list = cleanQuestions((await body(req)).questions || []);
      const ids = [];
      for (const q of list) {
        const r = await env.DB.prepare('INSERT INTO bank_trash (bank_id, q, deleted_at) VALUES (?, ?, ?) RETURNING id')
          .bind(bankId, JSON.stringify(q), now())
          .first();
        ids.push(r.id);
      }
      return json({ ids });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM bank_trash WHERE bank_id = ?').bind(bankId).run();
      return json({ ok: true });
    }
  }
  const ti = path.match(/^\/api\/admin\/trash\/(\d+)$/);
  if (ti && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM bank_trash WHERE id = ?').bind(Number(ti[1])).run();
    return json({ ok: true });
  }

  const bm = path.match(/^\/api\/admin\/banks\/(\d+)(\/questions)?$/);
  if (bm) {
    const id = Number(bm[1]);
    if (bm[2]) {
      if (method === 'GET') return json({ questions: await getBankQuestions(env, id) });
      if (method === 'PUT') {
        const { questions } = await body(req);
        return json({ questions: await setBankQuestions(env, id, questions) });
      }
    } else {
      if (method === 'PATCH') {
        const b = await body(req);
        const sets = [];
        const vals = [];
        for (const [k, max] of [['name', 40], ['description', 120], ['icon', 4]])
          if (k in b) (sets.push(`${k} = ?`), vals.push(String(b[k] || '').slice(0, max)));
        if ('active' in b) (sets.push('active = ?'), vals.push(b.active ? 1 : 0));
        if ('sort' in b) (sets.push('sort = ?'), vals.push(Number(b.sort) || 0));
        if (!sets.length) return err('אין שינויים');
        await env.DB.prepare(`UPDATE banks SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, id).run();
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        await env.DB.batch([env.DB.prepare('DELETE FROM bank WHERE bank_id = ?').bind(id), env.DB.prepare('DELETE FROM banks WHERE id = ?').bind(id)]);
        return json({ ok: true });
      }
    }
  }

  return err('לא נמצא', 404);
}

function serveAsset(path) {
  if (path === '/' || path === '') path = '/index.html';
  let a = ASSETS[path] || ASSETS[path + '.html'];
  if (!a) return new Response('לא נמצא', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' } });
  const body = a.b64 ? Uint8Array.from(atob(a.body), (c) => c.charCodeAt(0)) : a.body;
  return new Response(body, {
    headers: {
      'content-type': a.type,
      // קבצים עם שם מגובב (assets/) לא משתנים לעולם – אפשר לשמור במטמון לתמיד
      'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
