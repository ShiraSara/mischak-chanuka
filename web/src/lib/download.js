// הורדת תוצאות המשחק כקובץ CSV (נפתח באקסל, כולל עברית)
const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (row) => row.map(cell).join(',');

export function downloadResults(state) {
  const g = state.game;
  const title = g.settings.title || '';
  const date = new Date();
  const d = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
  const rows = [];
  rows.push(['Crazy girls – תוצאות המשחק']);
  if (title) rows.push(['שם המשחק', title]);
  rows.push(['תאריך', d]);
  rows.push([]);

  rows.push(['🏆 הדירוג']);
  rows.push(['מקום', 'שם', 'נקודות', 'הצביעה כמו הרוב (פעמים)', 'שאלות שענתה', 'זמן ממוצע להצבעה (שניות)']);
  (state.scores?.ranking || []).forEach((p, i) => rows.push([i + 1, p.name, p.points, p.hits, p.answered, p.avgSec ?? '']));
  if (state.scores?.fastest) rows.push(['⚡ הכי מהירה', state.scores.fastest.name, '', '', '', state.scores.fastest.avgSec]);
  rows.push([]);

  rows.push(['❓ מי ניצחה בכל שאלה']);
  rows.push(['#', 'שאלה', 'הזוכה', 'קולות לזוכה', 'סך הכל הצבעות', 'כל התוצאות']);
  (state.summary || []).forEach((r, i) =>
    rows.push([
      i + 1,
      r.text,
      r.winners.length ? r.winners.join(' + ') : 'אין הצבעות',
      r.top || '',
      r.votes,
      (r.results || []).map((o) => `${o.label}: ${o.count}`).join(' | '),
    ])
  );

  const csv = '﻿' + rows.map(line).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  // שם קובץ באנגלית – עובד בכל מחשב ודפדפן (שם המשחק מופיע בתוך הקובץ)
  a.download = `Crazy-girls-results-${d.replace(/\./g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
