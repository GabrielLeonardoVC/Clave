// Verifica sintaxe de todos os .js do projeto
const fs = require('fs'), path = require('path'), vm = require('vm');
function walk(d, out=[]) {
  for (const e of fs.readdirSync(d, {withFileTypes:true})) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
let erros = 0, n = 0;
for (const f of walk('.')) {
  if (!f.endsWith('.js')) continue;
  if (f.includes('node_modules')) continue;
  n++;
  const src = fs.readFileSync(f, 'utf8');
  try {
    new vm.Script(src, { filename: f });
  } catch (e) {
    erros++;
    console.log('SINTAXE ' + f + ': ' + e.message);
  }
}
console.log('\n' + n + ' arquivos .js verificados, ' + erros + ' com erro de sintaxe.');
process.exit(erros ? 1 : 0);
