// כיתובים חמודים שמגיבים למה שקורה במשחק. נבחרים לפי מספר השאלה כדי שלא יתחלפו כל שנייה.
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];

// בזמן שאלה: לפי הזמן שנשאר ומספר המצביעות
export function questionCaption({ leftRatio, votes, total, qIndex }) {
  if (total > 0 && votes >= total) return pick(['כולן הצביעו! ⚡', 'איזה מהירות! 🚀', 'כולן כבר בפנים 🙌'], qIndex);
  if (leftRatio == null) return null;
  if (votes === 0 && leftRatio <= 0.45) return pick(['מפחדות? 😅', 'נו, מישהי? 🙈', 'השקט הזה חשוד… 🤫', 'מישהי ערה פה? 😴'], qIndex);
  if (votes < total / 2 && leftRatio <= 0.3) return pick(['הזמן אוזל! ⏳', 'מהר מהר! 🏃‍♀️', 'עוד כמה שניות… 👀'], qIndex);
  return null;
}

// בתוצאות: לפי איך שההצבעה נגמרה
export function resultsCaption({ results, votes, type, qIndex }) {
  if (!votes) return pick(['אף אחת לא העזה… 🤐', 'שתיקה רועמת 🤫'], qIndex);
  const top = results[0];
  const second = results[1]?.count || 0;
  const winners = results.filter((r) => r.count === top.count);
  const isPerson = type === 'names' && !top.extra;
  if (votes === 1) return pick(['רק אחת העזה להצביע 🙈', 'קול אחד ויחיד 🎤'], qIndex);
  if (top.count === votes && votes >= 2)
    return isPerson ? pick([`זה ממש את, ${top.label}! 💯`, `${top.label}, אין על מה להתווכח 😂`, `פה אחד – ${top.label}! 🎯`], qIndex) : pick(['כולן מסכימות! 🤝', 'פה אחד! 🎯'], qIndex);
  if (winners.length > 1) return pick(['היה צמוד! 😮', 'אין הכרעה! 🤷‍♀️'], qIndex);
  if (top.count / votes >= 0.7 && votes >= 3) return isPerson ? pick([`ממש מתאים לך, ${top.label} 😉`, `ניצחון מוחץ ל${top.label}! 🏆`], qIndex) : 'ניצחון מוחץ! 🏆';
  if (top.count - second === 1 && votes >= 4) return pick(['היה צמוד! 😮', 'על חוד הקול 🔥'], qIndex);
  return null;
}
