// ייבוא רשימת משתתפות מקובץ אקסל (xlsx) או CSV
import { readSheet } from 'read-excel-file/browser';

const NAME_HEADERS = ['שם', 'name', 'משתתפת', 'משתתף'];
const PHONE_HEADERS = ['טלפון', 'פלאפון', 'נייד', 'מספר', 'phone', 'tel', 'mobile'];

const clean = (v) => (v == null ? '' : String(v).trim());
const digits = (v) => clean(v).replace(/\D/g, '');
const looksLikePhone = (v) => digits(v).length >= 9 && digits(v).length <= 12;

// טלפון שנשמר באקסל כמספר מאבד את ה-0 שבהתחלה (501234567) – מחזירים אותו
function fixPhone(v) {
  const s = clean(v);
  if (!s) return '';
  const d = digits(s);
  if (/^[1-9]\d{8}$/.test(d)) return '0' + d;
  return s;
}

function parseCsv(text) {
  const sep = text.includes(';') && !text.includes(',') ? ';' : text.includes('\t') ? '\t' : ',';
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, '').trim()));
}

export function rowsToPlayers(rows) {
  rows = rows.filter((r) => r && r.some((c) => clean(c)));
  if (!rows.length) return [];
  let nameCol = -1;
  let phoneCol = -1;
  let start = 0;

  // מחפשים שורת כותרות באחת משלוש השורות הראשונות
  for (let i = 0; i < Math.min(3, rows.length) && nameCol < 0; i++) {
    const cells = rows[i].map((c) => clean(c).toLowerCase());
    const n = cells.findIndex((c) => NAME_HEADERS.some((h) => c.includes(h)));
    if (n >= 0) {
      nameCol = n;
      phoneCol = cells.findIndex((c, j) => j !== n && PHONE_HEADERS.some((h) => c.includes(h)));
      start = i + 1;
    }
  }
  // בלי כותרות: עמודת השם היא הראשונה שאינה מספר, הטלפון – הראשונה שנראית כמו טלפון
  if (nameCol < 0) {
    const first = rows[0];
    nameCol = Math.max(0, first.findIndex((c) => clean(c) && !looksLikePhone(c)));
    phoneCol = first.findIndex((c, j) => j !== nameCol && looksLikePhone(c));
  }
  if (phoneCol < 0) {
    const sample = rows.slice(start, start + 5);
    const width = Math.max(...sample.map((r) => r.length));
    for (let j = 0; j < width; j++) if (j !== nameCol && sample.some((r) => looksLikePhone(r[j]))) phoneCol = j;
  }

  return rows
    .slice(start)
    .map((r) => ({ name: clean(r[nameCol]), phone: phoneCol >= 0 ? fixPhone(r[phoneCol]) : '' }))
    .filter((p) => p.name);
}

export async function readPlayersFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv' || ext === 'txt') return rowsToPlayers(parseCsv(await file.text()));
  if (ext === 'xls') throw new Error('קובץ xls ישן לא נתמך. שמרי אותו באקסל בפורמט xlsx ונסי שוב.');
  if (ext !== 'xlsx') throw new Error('אפשר להעלות קובץ אקסל (xlsx) או CSV');
  return rowsToPlayers(await readSheet(file));
}

export function downloadTemplate() {
  const csv = '﻿שם,טלפון\nרחל כהן,050-1234567\nשרה לוי,052-7654321\nלאה מזרחי,\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'רשימת-משתתפות.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
