// Scan all project files for non-Latin / suspicious characters
const fs = require('fs'), path = require('path');
function walk(d, out=[]) {
  for (const e of fs.readdirSync(d, {withFileTypes:true})) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const bad = [];
for (const f of walk('.')) {
  if (!/\.(js|css|html|json|md|webmanifest)$/.test(f)) continue;
  const txt = fs.readFileSync(f, 'utf8');
  const lines = txt.split('\n');
  lines.forEach((ln, i) => {
    // CJK, Cyrillic, Arabic, Devanagari ranges
    if (/[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(ln)) {
      bad.push(f + ':' + (i+1) + ': ' + ln.trim().slice(0,90));
    }
  });
}
if (bad.length) { console.log('=== CARACTERES SUSPEITOS ==='); bad.forEach(b=>console.log(b)); }
else console.log('OK: nenhum caractere nao-latino encontrado.');
