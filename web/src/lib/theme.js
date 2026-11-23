// שם המשחק וערכות הצבעים
export const BRAND = 'Crazy girls';

// כל ערכה: רקע בהיר, צבע "דיו" כהה (מסגרות וטקסט), וארבעה צבעים עזים
export const THEMES = [
  { id: 'pink', name: 'ורוד-צהוב', swatch: ['#e0187a', '#ffd43b', '#7c3aed'] },
  { id: 'blue', name: 'כחול-טורקיז', swatch: ['#1f6fff', '#2ee6c9', '#ffb020'] },
  { id: 'green', name: 'ירוק-ליים', swatch: ['#16a34a', '#c6f432', '#ff7a59'] },
  { id: 'orange', name: 'כתום-אדום', swatch: ['#ff5a1f', '#ffc93c', '#e0245e'] },
  { id: 'purple', name: 'סגול-זהב', swatch: ['#7c3aed', '#f6c453', '#e0187a'] },
];

const KEY = 'seker_theme';

export function getTheme() {
  const t = localStorage.getItem(KEY);
  return THEMES.some((x) => x.id === t) ? t : 'pink';
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
