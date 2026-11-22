// ===== משחק הסקר – צד הדפדפן =====
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAX = 15;

let token = localStorage.getItem('seker_token') || '';
let me = null;
let questions = []; // {text,type,options,on}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') {
    logout();
    throw new Error(data.error || 'צריך להיכנס מחדש');
  }
  if (!res.ok) throw new Error(data.error || 'שגיאה');
  return data;
}

function show(view) {
  for (const v of ['login', 'setup', 'game']) $('#view-' + v).hidden = v !== view;
}

function logout() {
  token = '';
  localStorage.removeItem('seker_token');
  localStorage.removeItem('seker_game');
  stopPolling();
  show('login');
}

// ---------- כניסה ----------
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    const r = await api('/api/login', { method: 'POST', body: { code: $('#login-code').value } });
    token = r.token;
    localStorage.setItem('seker_token', token);
    await openSetup();
  } catch (er) {
    $('#login-error').textContent = er.message;
  }
});
$('#btn-logout').onclick = logout;

// ---------- הכנת משחק ----------
async function openSetup() {
  me = await api('/api/me');
  $('#setup-sub').textContent =
    (me.label ? me.label + ' · ' : '') + (me.gamesLeft == null ? 'ללא הגבלת משחקים' : `נותרו ${me.gamesLeft} משחקים בקוד`);
  $('#btn-resume').hidden = !localStorage.getItem('seker_game');
  renderPlayers();
  const r = await api('/api/questions');
  setQuestions(r.questions, r.custom);
  show('setup');
}

$('#btn-resume').onclick = () => openGame(Number(localStorage.getItem('seker_game')));

function loadPlayers() {
  try {
    return JSON.parse(localStorage.getItem('seker_players')) || [];
  } catch {
    return [];
  }
}
function savePlayers() {
  const list = [];
  for (let i = 0; i < MAX; i++) {
    list.push({ name: $(`#pn-${i}`).value, phone: $(`#pp-${i}`).value });
  }
  localStorage.setItem('seker_players', JSON.stringify(list));
  const n = list.filter((p) => p.name.trim()).length;
  $('#players-count').textContent = `${n} משתתפות`;
}
function renderPlayers() {
  const saved = loadPlayers();
  let h = '<div class="head"></div><div class="head">שם</div><div class="head ph">טלפון</div>';
  for (let i = 0; i < MAX; i++) {
    const p = saved[i] || {};
    h += `<div class="num">${i + 1}</div>
      <input type="text" id="pn-${i}" value="${esc(p.name)}" placeholder="שם משתתפת ${i + 1}" />
      <input type="tel" id="pp-${i}" class="ltr phone-cell" value="${esc(p.phone)}" placeholder="050-0000000" />`;
  }
  $('#players-grid').innerHTML = h;
  $('#players-grid').oninput = savePlayers;
  savePlayers();
}
$('#btn-clear-players').onclick = () => {
  if (!confirm('לנקות את כל השמות והטלפונים?')) return;
  localStorage.removeItem('seker_players');
  renderPlayers();
};

function setQuestions(list, custom) {
  questions = list.map((q) => ({ ...q, on: true }));
  $('#q-saved').textContent = custom ? 'מוצג המאגר האישי ששמרת.' : 'מוצג מאגר השאלות הכללי.';
  renderQuestions();
}

function renderQuestions() {
  $('#q-list').innerHTML = questions
    .map(
      (q, i) => `
    <div class="q-item ${q.on ? '' : 'off'}" data-i="${i}">
      <input type="checkbox" data-f="on" ${q.on ? 'checked' : ''} title="לכלול במשחק" />
      <div class="q-edit">
        <input type="text" data-f="text" value="${esc(q.text)}" />
        <div class="row">
          <select data-f="type" style="width:auto">
            <option value="names" ${q.type === 'names' ? 'selected' : ''}>התשובות: שמות המשתתפות</option>
            <option value="options" ${q.type === 'options' ? 'selected' : ''}>התשובות: אפשרויות קבועות</option>
          </select>
          ${
            q.type === 'options'
              ? `<input type="text" class="grow" data-f="options" value="${esc(q.options.join(', '))}" placeholder="אפשרויות מופרדות בפסיק: קפה, תה, שניהם" style="width:auto" />`
              : ''
          }
        </div>
      </div>
      <button class="btn small danger" data-del title="מחיקה">✕</button>
    </div>`
    )
    .join('');
  updateQCount();
}

function updateQCount() {
  const on = questions.filter((q) => q.on).length;
  $('#q-count').textContent = `נבחרו ${on} מתוך ${questions.length} שאלות`;
}

$('#q-list').addEventListener('input', (e) => {
  const item = e.target.closest('.q-item');
  if (!item) return;
  const q = questions[item.dataset.i];
  const f = e.target.dataset.f;
  if (f === 'text') q.text = e.target.value;
  if (f === 'options') q.options = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
});
$('#q-list').addEventListener('change', (e) => {
  const item = e.target.closest('.q-item');
  if (!item) return;
  const q = questions[item.dataset.i];
  const f = e.target.dataset.f;
  if (f === 'on') {
    q.on = e.target.checked;
    item.classList.toggle('off', !q.on);
    updateQCount();
  }
  if (f === 'type') {
    q.type = e.target.value;
    if (q.type === 'options' && !q.options.length) q.options = ['כן', 'לא'];
    renderQuestions();
  }
});
$('#q-list').addEventListener('click', (e) => {
  if (!e.target.matches('[data-del]')) return;
  const i = Number(e.target.closest('.q-item').dataset.i);
  questions.splice(i, 1);
  renderQuestions();
});

$('#btn-all').onclick = () => (questions.forEach((q) => (q.on = true)), renderQuestions());
$('#btn-none').onclick = () => (questions.forEach((q) => (q.on = false)), renderQuestions());
$('#btn-random').onclick = () => {
  const n = Math.max(1, Number($('#random-n').value) || 10);
  const idx = shuffle(questions.map((_, i) => i)).slice(0, n);
  questions.forEach((q, i) => (q.on = idx.includes(i)));
  renderQuestions();
};
$('#btn-add-q').onclick = () => {
  questions.unshift({ text: '', type: 'names', options: [], on: true });
  renderQuestions();
  $('#q-list input[data-f=text]').focus();
};
$('#btn-save-q').onclick = async () => {
  try {
    const r = await api('/api/questions', { method: 'PUT', body: { questions } });
    const onTexts = new Set(questions.filter((q) => q.on).map((q) => q.text.trim()));
    setQuestions(r.questions, true);
    questions.forEach((q) => (q.on = onTexts.has(q.text)));
    renderQuestions();
    $('#q-saved').textContent = '✓ השאלות נשמרו. בפעם הבאה שתיכנסי עם הקוד הן יופיעו כך.';
  } catch (er) {
    alert(er.message);
  }
};
$('#btn-reset-q').onclick = async () => {
  if (!confirm('להחזיר את מאגר השאלות הכללי? השינויים ששמרת יימחקו.')) return;
  const r = await api('/api/questions', { method: 'DELETE' });
  setQuestions(r.questions, false);
};

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

$('#btn-create').onclick = async () => {
  $('#setup-error').textContent = '';
  const players = loadPlayers().filter((p) => p.name && p.name.trim());
  let qs = questions.filter((q) => q.on && q.text.trim());
  if ($('#set-shuffle').checked) qs = shuffle([...qs]);
  // שאלות עם יותר אפשרויות ממה שאפשר להקיש
  const bad = qs.find((q) => q.type === 'options' && q.options.length < 2);
  if (bad) return ($('#setup-error').textContent = `בשאלה "${bad.text}" צריך לפחות 2 אפשרויות`);
  try {
    const r = await api('/api/games', {
      method: 'POST',
      body: {
        players,
        questions: qs,
        settings: {
          timerSec: Number($('#set-timer').value) || 0,
          allowSelfVote: $('#set-self').checked,
          autoReveal: $('#set-auto').checked,
          showVoters: $('#set-voters').checked,
        },
      },
    });
    localStorage.setItem('seker_game', r.id);
    openGame(r.id);
  } catch (er) {
    $('#setup-error').textContent = er.message;
  }
};

// ---------- מסך המשחק ----------
let gameId = null;
let pollTimer = null;
let tickTimer = null;
let state = null;
let clockOffset = 0;
let lastMainKey = '';
let lastControlsKey = '';

function stopPolling() {
  clearInterval(pollTimer);
  clearInterval(tickTimer);
}

async function openGame(id) {
  gameId = id;
  if (!me) me = await api('/api/me');
  $('#dial-info').innerHTML = me.phoneInfo
    ? `להצבעה מהטלפון התקשרו ל: <b class="ltr" style="direction:ltr;display:inline-block">${esc(me.phoneInfo)}</b>`
    : 'להצבעה מהטלפון התקשרו למספר המשחק';
  lastMainKey = lastControlsKey = '';
  show('game');
  stopPolling();
  await refresh();
  pollTimer = setInterval(refresh, 1000);
  tickTimer = setInterval(tick, 250);
}

async function refresh() {
  try {
    const s = await api(`/api/games/${gameId}`);
    clockOffset = s.serverNow - Date.now();
    state = s;
    render();
  } catch (er) {
    if (er.message.includes('לא נמצא')) {
      localStorage.removeItem('seker_game');
      stopPolling();
      openSetup();
    }
  }
}

async function act(action) {
  try {
    state = await api(`/api/games/${gameId}/action`, { method: 'POST', body: { action } });
    render();
  } catch (er) {
    alert(er.message);
  }
}

function render() {
  const s = state;
  const g = s.game;
  $('#game-pin').textContent = g.pin;
  let mainKey, html;

  if (g.phase === 'lobby') {
    const conn = s.players.filter((p) => p.connected).length;
    html = `
      <div class="q-counter">ממתינים למשתתפות · ${g.total} שאלות במשחק</div>
      <div class="q-title">מתקשרות ומצטרפות! ☎</div>
      <div class="note">כל אחת מתקשרת למספר שלמעלה ונשארת על הקו. מי שהטלפון שלה רשום – מזוהה אוטומטית. מי שלא – תקיש את קוד המשחק <b>${esc(g.pin)}</b> ואז את המספר שלה ברשימה.</div>
      <div class="lobby-grid">
        ${s.players
          .map(
            (p) => `<div class="lobby-p ${p.connected ? 'on' : ''}"><span class="n">${p.num}</span>${esc(p.name)}
          <span class="st">${p.connected ? 'מחוברת' : p.hasPhone ? 'ממתינה' : 'ללא טלפון רשום'}</span></div>`
          )
          .join('')}
      </div>
      <div class="muted">${conn} מתוך ${s.players.length} מחוברות</div>`;
    mainKey = html;
  } else if (g.phase === 'question') {
    const q = s.question;
    html = `
      <div class="q-counter">שאלה ${g.qIndex + 1} מתוך ${g.total}</div>
      <div class="q-title">${esc(q.text)}</div>
      <div class="options">${q.options.map((o) => `<div class="opt"><span class="n">${o.n}</span>${esc(o.label)}</div>`).join('')}</div>
      <div class="status-line">
        <span class="timer" id="timer"></span>
        <span>הצביעו: <b>${s.votesCount}</b> מתוך ${s.players.length}</span>
        <span class="muted">מקישים את המספר ואחריו סולמית #</span>
      </div>
      ${
        g.settings.showVoters
          ? `<div class="voters">${s.players.map((p) => `<span class="chip ${p.voted ? 'on' : ''}">${esc(p.name)}</span>`).join('')}</div>`
          : ''
      }`;
    mainKey = html;
  } else if (g.phase === 'results') {
    const res = s.results || [];
    const top = res[0]?.count || 0;
    const winners = top ? res.filter((r) => r.count === top) : [];
    const max = Math.max(1, top);
    mainKey = `results-${g.qIndex}-${JSON.stringify(res)}`;
    html = `
      <div class="q-counter">שאלה ${g.qIndex + 1} מתוך ${g.total} · ${s.votesCount} הצבעות</div>
      <div class="q-title">${esc(s.question.text)}</div>
      <div class="winner-banner">${
        winners.length === 0 ? 'אף אחת לא הצביעה 🤷‍♀️' : winners.length === 1 ? `🎉 ${esc(winners[0].label)} 🎉` : `תיקו! ${winners.map((w) => esc(w.label)).join(' · ')}`
      }</div>
      <div class="bars">${res
        .filter((r) => r.count > 0)
        .map(
          (r) => `<div class="bar-row ${r.count === top && top ? 'win' : ''} ${r.count ? '' : 'zero'}">
          <span class="lbl">${esc(r.label)}</span>
          <div class="bar-track"><div class="bar-fill" data-w="${(r.count / max) * 100}"></div></div>
          <span class="cnt">${r.count}</span></div>`
        )
        .join('')}</div>
      ${
        res.some((r) => r.count === 0)
          ? `<p class="muted" style="margin-top:18px;font-size:1.1rem">ללא קולות: ${res.filter((r) => r.count === 0).map((r) => esc(r.label)).join(' · ')}</p>`
          : ''
      }`;
  } else {
    mainKey = 'ended' + JSON.stringify(s.summary);
    html = `
      <div class="q-title">🎊 המשחק הסתיים! 🎊</div>
      <h2>סיכום</h2>
      <div class="summary">${(s.summary || [])
        .map(
          (r) => `<div class="sum-row"><span>${esc(r.text)}</span><span>${
            r.winners.length ? `<b>${r.winners.map(esc).join(' · ')}</b> (${r.top})` : '<span class="muted">אין הצבעות</span>'
          }</span></div>`
        )
        .join('')}</div>`;
  }

  if (mainKey !== lastMainKey) {
    const animate = g.phase === 'results' && !lastMainKey.startsWith(`results-${g.qIndex}-`);
    $('#game-main').innerHTML = html;
    const fills = document.querySelectorAll('.bar-fill');
    if (animate) requestAnimationFrame(() => requestAnimationFrame(() => fills.forEach((f) => (f.style.width = f.dataset.w + '%'))));
    else fills.forEach((f) => ((f.style.transition = 'none'), (f.style.width = f.dataset.w + '%')));
    lastMainKey = mainKey;
    tick();
  }
  renderControls();
}

function renderControls() {
  const g = state.game;
  const last = g.qIndex + 1 >= g.total;
  const B = (a, label, cls = '') => `<button class="btn ${cls}" data-act="${a}">${label}</button>`;
  let h = '';
  if (g.phase === 'lobby') h = B('start', 'התחלת המשחק ▶', 'primary big') + B('setup', 'חזרה להכנה', 'ghost');
  else if (g.phase === 'question')
    h = B('reveal', 'הצגת התוצאות', 'primary big') + (g.qIndex > 0 ? B('prev', '→ שאלה קודמת') : '') + B('next', 'דילוג') + B('end', 'סיום המשחק', 'danger');
  else if (g.phase === 'results')
    h =
      B('next', last ? 'סיום וסיכום 🎊' : 'השאלה הבאה ←', 'primary big') +
      (g.qIndex > 0 ? B('prev', '→ שאלה קודמת') : '') +
      B('reopen', 'פתיחה מחדש להצבעה') +
      B('restart_question', 'איפוס ההצבעות לשאלה') +
      B('end', 'סיום המשחק', 'danger');
  else h = B('setup', 'משחק חדש', 'primary big');
  h += B('fullscreen', '⛶ מסך מלא', 'ghost') + B('sim', '📱 סימולטור טלפון (בדיקה)', 'ghost');
  const key = h;
  if (key === lastControlsKey) return;
  lastControlsKey = key;
  $('#controls').innerHTML = h;
}

$('#controls').addEventListener('click', (e) => {
  const a = e.target.dataset.act;
  if (!a) return;
  if (a === 'setup') {
    if (state.game.phase !== 'ended' && !confirm('לחזור למסך ההכנה? המשחק הנוכחי יישאר פתוח עד שתיצרי משחק חדש.')) return;
    stopPolling();
    return openSetup();
  }
  if (a === 'fullscreen') return document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  if (a === 'sim') return window.open(`/sim.html?game=${gameId}`, '_blank');
  if (a === 'end' && !confirm('לסיים את המשחק?')) return;
  if (a === 'restart_question' && !confirm('למחוק את כל ההצבעות לשאלה הזו?')) return;
  act(a);
});

document.addEventListener('keydown', (e) => {
  if ($('#view-game').hidden || !state) return;
  if (e.key === ' ' || e.key === 'Enter') {
    const p = state.game.phase;
    e.preventDefault();
    if (p === 'lobby') act('start');
    else if (p === 'question') act('reveal');
    else if (p === 'results') act('next');
  }
});

function tick() {
  const el = $('#timer');
  if (!el || !state) return;
  const g = state.game;
  if (!g.settings.timerSec || g.phase !== 'question') return (el.textContent = '');
  const left = Math.max(0, Math.ceil((g.qStartedAt + g.settings.timerSec * 1000 - (Date.now() + clockOffset)) / 1000));
  el.textContent = left > 0 ? `⏱ ${left}` : 'הזמן נגמר!';
  el.classList.toggle('low', left <= 5);
}

// ---------- התחלה ----------
(async function init() {
  if (!token) return show('login');
  try {
    const gid = Number(localStorage.getItem('seker_game'));
    if (gid) {
      await openGame(gid);
    } else await openSetup();
  } catch {
    show('login');
  }
})();
