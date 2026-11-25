// הורדת הסיכום האישי של ה-AI ("אז מה למדתי עלייך?") כקובץ שנפתח באקסל
const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (row) => row.map(cell).join(',');

export function downloadProfiles(profiles, title = '') {
  const date = new Date();
  const d = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
  const rows = [['Crazy girls – אז מה למדתי עלייך?']];
  if (title) rows.push(['שם המשחק', title]);
  rows.push(['תאריך', d], []);
  rows.push(['שם', 'התארים שקיבלה', 'מה למדתי עלייך']);
  for (const p of profiles || []) rows.push([p.name, (p.titles || []).join(' · '), p.sentence]);

  const csv = '﻿' + rows.map(line).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  // שם קובץ באנגלית – עובד בכל מחשב ודפדפן
  a.download = `Crazy-girls-summary-${d.replace(/\./g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
