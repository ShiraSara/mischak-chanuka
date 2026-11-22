// אורז את קבצי dist (תוצאת הבנייה של React) לתוך src/assets.js כדי שהשרת יגיש אותם ישירות
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const out = {};
function walk(dir, base = '') {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f), rel = base + '/' + f;
    if (statSync(p).isDirectory()) walk(p, rel);
    else if (f !== '_headers' && types[extname(f)]) {
      const bin = !types[extname(f)].startsWith('text') && extname(f) !== '.svg';
      out[rel] = { type: types[extname(f)], b64: bin, body: bin ? readFileSync(p).toString('base64') : readFileSync(p, 'utf8') };
    }
  }
}
walk('dist');
writeFileSync('src/assets.js', '// קובץ שנוצר אוטומטית – לא לערוך ידנית (npm run build)\nexport const ASSETS = ' + JSON.stringify(out) + ';\n');
console.log('packed', Object.keys(out).length, 'files');
