// רשימת שאלות מטקסט חופשי / קובץ וורד / קובץ טקסט

// "שורה לכל שאלה". מורידים מספור ותבליטים. שאלה | תשובה | תשובה → שאלה עם תשובות קבועות
export function parseQuestionLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-–•*▪●◦○■□✓✔➢➤>]|\(?\d+[.)\-:]|[א-ת][.)])\s*/, '').trim())
    .filter((l) => l.length > 1)
    .map((l) => {
      const parts = l.split('|').map((x) => x.trim()).filter(Boolean);
      const [q, ...opts] = parts;
      return { text: q.slice(0, 300), type: opts.length >= 2 ? 'options' : 'names', options: opts.length >= 2 ? opts : [] };
    });
}

// קריאת קובץ שהועלה: docx (וורד), או txt
export async function readQuestionFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt') || file.type.startsWith('text/')) return await file.text();
  if (name.endsWith('.docx')) return await docxText(await file.arrayBuffer());
  if (name.endsWith('.doc')) throw new Error('קובץ וורד ישן (doc) – שמרי אותו בוורד כ-docx, או העתיקי את הרשימה והדביקי כאן');
  throw new Error('אפשר להעלות קובץ וורד (docx) או קובץ טקסט (txt)');
}

// docx הוא קובץ zip; הטקסט נמצא ב-word/document.xml – פסקה לכל שורה
async function docxText(buf) {
  const xml = await unzipEntry(buf, 'word/document.xml');
  if (!xml) throw new Error('לא הצלחתי לקרוא את הקובץ');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const lines = [];
  for (const p of doc.getElementsByTagNameNS('*', 'p')) {
    let line = '';
    for (const n of p.getElementsByTagNameNS('*', '*')) {
      if (n.localName === 't') line += n.textContent;
      else if (n.localName === 'tab') line += ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

async function unzipEntry(buf, wanted) {
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let k = 0; k < count && dv.getUint32(p, true) === 0x02014b50; k++) {
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === wanted) {
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + size);
      if (method === 0) return dec.decode(data);
      if (method === 8) return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
