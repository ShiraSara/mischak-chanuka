// מנגינות שהועלו (נטען פעם אחת). 'auto' = המנגינה הראשונה שהועלתה, ואם אין – מנגינה מובנית
let cache = null;
export function getTracks() {
  if (!cache)
    cache = fetch('/api/music')
      .then((r) => r.json())
      .then((d) => d.tracks || [])
      .catch(() => []);
  return cache;
}
export function resolveStyle(style, tracks) {
  if (style && style !== 'auto') return style;
  return tracks[0] ? 'track:' + tracks[0].id : 'quiz';
}
