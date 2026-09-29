// Valida UTF-8 estrito em todos os arquivos de texto
const fs = require('fs'), path = require('path');
function walk(d, out=[]) {
  for (const e of fs.readdirSync(d, {withFileTypes:true})) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const decoder = new TextDecoder('utf-8', { fatal: true });
let bad = 0;
for (const f of walk('.')) {
  if (!/\.(js|css|html|json|md|webmanifest)$/.test(f)) continue;
  const buf = fs.readFileSync(f);
  try { decoder.decode(buf); }
  catch (e) {
    bad++;
    // encontra os offsets inválidos
    const txt = buf.toString('utf8');
    const lines = txt.split('\n');
    const suspeitas = [];
    lines.forEach((ln, i) => {
      if (ln.includes('\uFFFD')) suspeitas.push((i+1) + ': ' + ln.trim().slice(0,70));
    });
    console.log('UTF-8 INVALIDO: ' + f);
    suspeitas.slice(0, 6).forEach(s => console.log('    linha ' + s));
  }
}
console.log(bad ? '\n' + bad + ' arquivo(s) com UTF-8 invalido.' : '\nOK: todos os arquivos sao UTF-8 valido.');
