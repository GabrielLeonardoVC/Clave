// Valida UTF-8 estrito em todos os arquivos de texto do Acorde
const fs = require('fs');
const { arquivosDe } = require('./arquivos');
const decoder = new TextDecoder('utf-8', { fatal: true });
let bad = 0;
for (const f of arquivosDe(/\.(js|css|html|json|md|webmanifest)$/)) {
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
