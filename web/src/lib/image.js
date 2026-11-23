// מקטין תמונה בדפדפן לפני השליחה – פחות זמן העלאה ופחות עלות
const MAX_SIDE = 1600;

export async function compressImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('אפשר להעלות רק תמונות');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { preview: dataUrl, mediaType: 'image/jpeg', data: dataUrl.split(',')[1] };
}

// כל שורה = שאלה. "שאלה | תשובה, תשובה" או "שאלה: א / ב / ג" = שאלה עם תשובות קבועות
export function parsePastedQuestions(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim())
    .filter((l) => l.length > 2)
    .map((line) => {
      let q = line;
      let opts = '';
      if (line.includes('|')) [q, opts] = line.split('|');
      else if (/[?؟:]\s*\S.*\/.*$/.test(line)) {
        const i = Math.max(line.lastIndexOf('?'), line.lastIndexOf(':'));
        q = line.slice(0, i + 1);
        opts = line.slice(i + 1);
      }
      const options = opts
        .split(/[,/]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return options.length >= 2
        ? { text: q.replace(/:\s*$/, '?').trim(), type: 'options', options }
        : { text: q.trim(), type: 'names', options: [] };
    });
}
