// Scan all Acorde files for non-Latin / suspicious characters
const fs = require('fs');
const { arquivosDe } = require('./arquivos');
const bad = [];
for (const f of arquivosDe(/\.(js|css|html|json|md|webmanifest)$/)) {
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
