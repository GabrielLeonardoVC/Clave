// Verifica sintaxe de todos os .js do Acorde.
//
// O Acorde e JS classico, entao compilar com vm.Script e o teste certo. A
// varredura e fechada pelo modulo arquivos.js, para nao passar por cima de
// codigo de terceiros nem por build.
const fs = require('fs'), vm = require('vm');
const { arquivosDe } = require('./arquivos');
let erros = 0, n = 0;
for (const f of arquivosDe(/\.js$/)) {
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
