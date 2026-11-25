// סיכום המשחק כקובץ PDF: נפתח חלון ההדפסה של הדפדפן – בוחרים "שמירה כ-PDF"
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function printSummary(state, profiles = null) {
  const g = state.game;
  const title = g.settings.title || '';
  const d = new Date();
  const date = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  const ranking = state.scores?.ranking || [];
  const top = ranking[0]?.points || 0;
  const winners = top > 0 ? ranking.filter((p) => p.points === top) : [];
  const fastest = state.scores?.fastest;

  const rows = ranking
    .map((p, i) => `<tr><td>${i + 1}</td><td><b>${esc(p.name)}</b></td><td>${p.points}</td><td>${p.hits}</td><td>${p.avgSec ?? '–'}</td></tr>`)
    .join('');
  const qs = (state.summary || [])
    .map(
      (r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(r.text)}</td>
        <td><b>${r.winners.length ? esc(r.winners.join(' + ')) : 'אין הצבעות'}</b></td>
        <td class="small">${(r.results || []).map((o) => `${esc(o.label)} ${o.count}`).join(' · ') || '–'}</td>
      </tr>`
    )
    .join('');
  const cards = (profiles || [])
    .map(
      (p) => `<div class="card"><b>${esc(p.name)}</b>${p.titles?.length ? `<span class="t">👑 ${esc(p.titles.join(' · '))}</span>` : ''}<p>${esc(p.sentence)}</p></div>`
    )
    .join('');

  const html = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>Crazy girls – סיכום המשחק${title ? ' – ' + esc(title) : ''}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, 'Segoe UI', sans-serif; color: #222; margin: 0; font-size: 12.5pt; }
  h1 { font-size: 26pt; margin: 0; color: #c2126a; }
  h2 { font-size: 15pt; margin: 22px 0 8px; border-bottom: 2px solid #c2126a; padding-bottom: 4px; }
  .sub { color: #666; margin: 4px 0 14px; }
  .win { background: #fff6d6; border: 2px solid #e3b400; border-radius: 12px; padding: 12px 16px; font-size: 15pt; }
  .win b { font-size: 20pt; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: right; padding: 6px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { background: #f3f3f3; font-size: 11pt; }
  tr { break-inside: avoid; }
  .small { font-size: 10.5pt; color: #555; }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .card { border: 1.5px solid #ccc; border-radius: 10px; padding: 10px 12px; break-inside: avoid; }
  .card b { font-size: 14pt; }
  .card .t { display: block; color: #c2126a; font-size: 10.5pt; margin-top: 2px; }
  .card p { margin: 6px 0 0; line-height: 1.45; }
</style></head><body>
  <h1>🏆 Crazy girls – סיכום המשחק</h1>
  <div class="sub">${title ? esc(title) + ' · ' : ''}${date} · ${ranking.length} משתתפות · ${(state.summary || []).length} שאלות</div>
  ${winners.length ? `<div class="win">👑 ${winners.length > 1 ? 'המנצחות' : 'המנצחת'}: <b>${esc(winners.map((w) => w.name).join(' & '))}</b> · ${top} נקודות${fastest ? ` &nbsp;·&nbsp; ⚡ הכי מהירה: ${esc(fastest.name)}` : ''}</div>` : ''}
  <h2>הדירוג</h2>
  <table><tr><th>מקום</th><th>שם</th><th>נקודות</th><th>הצביעה כמו הרוב</th><th>זמן ממוצע (שניות)</th></tr>${rows}</table>
  <h2>מי ניצחה בכל שאלה</h2>
  <table><tr><th>#</th><th>שאלה</th><th>הזוכה</th><th>כל התוצאות</th></tr>${qs}</table>
  ${cards ? `<h2>✨ אז מה למדתי עלייך?</h2><div class="cards">${cards}</div>` : ''}
</body></html>`;

  // מדפיסים מתוך מסגרת נסתרת – בלי חלון קופץ
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  }, 300);
}
