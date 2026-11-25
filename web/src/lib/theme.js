// שם המשחק וערכות הצבעים
export const BRAND = 'Crazy girls';

// כל ערכה: רקע בהיר, צבע "דיו" כהה (מסגרות וטקסט), וארבעה צבעים עזים
export const THEMES = [
  { id: 'powder', name: 'פודרה ושקיעה', swatch: ['#D6938C', '#F0C9B7', '#726B80'] },
  { id: 'cherry', name: 'דובדבן וזהב', swatch: ['#DF2F50', '#E0DB2D', '#98C3D2'] },
  { id: 'orchid', name: 'סחלב וניאון', swatch: ['#CE63B4', '#6BF5FA', '#61579F'] },
  { id: 'honey', name: 'דבש ולבנדר', swatch: ['#5F9EBB', '#E3BA54', '#6E616D'] },
  { id: 'vermilion', name: 'ורמיליון וטורקיז', swatch: ['#DB403D', '#13CDD0', '#363653'] },
];

const KEY = 'seker_theme';

export function getTheme() {
  const t = localStorage.getItem(KEY);
  return THEMES.some((x) => x.id === t) ? t : THEMES[0].id;
}

export function applyTheme(id) {
  document.documentElement.dataset.theme = id;
}

export function setTheme(id) {
  localStorage.setItem(KEY, id);
  applyTheme(id);
  window.dispatchEvent(new CustomEvent('themechange', { detail: id }));
}

// מפעילים את הערכה השמורה כבר בטעינת הדף
applyTheme(getTheme());
