// הערכת משך המשחק: זמן השאלה + זמן התוצאות + מעברים (וילון, קריאת השאלה) + טבלאות מובילות
export const TRANSITION_SEC = 8;

export function secForQuestion(q, settings) {
  const timer = q.timerSec ?? (Number(settings.timerSec) || 20); // בלי טיימר – מניחים כ-20 שניות
  const results = q.resultsSec ?? (Number(settings.resultsSec) || 5);
  return (timer || 20) + results + TRANSITION_SEC;
}

export function boardsSec(count, settings) {
  const every = Number(settings.boardEvery) || 0;
  return every ? Math.floor(count / every) * ((Number(settings.resultsSec) || 5) + 6 + TRANSITION_SEC) : 0;
}

export function estimateMinutes(list, settings) {
  const sec = list.reduce((t, q) => t + secForQuestion(q, settings), 0) + boardsSec(list.length, settings);
  return Math.round(sec / 60);
}

// כמה שאלות נכנסות בזמן שנבחר (לפי הזמנים הממוצעים של המשחק)
export function countForMinutes(minutes, settings) {
  const per = secForQuestion({}, settings);
  const every = Number(settings.boardEvery) || 0;
  const perWithBoards = per + (every ? ((Number(settings.resultsSec) || 5) + 6 + TRANSITION_SEC) / every : 0);
  return { count: Math.max(1, Math.round((minutes * 60) / perWithBoards)), perSec: Math.round(perWithBoards) };
}

// "כ-40 דקות" / "שעה ו-10 דקות" / "פחות מדקה"
export function fmtMinutes(m) {
  if (m < 1) return 'פחות מדקה';
  if (m < 60) return `${m} דקות`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  const hs = h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`;
  return r ? `${hs} ו-${r} דקות` : hs;
}
