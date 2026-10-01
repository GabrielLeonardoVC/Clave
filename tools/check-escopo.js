/* Procura `el(` sem import, em todo o app.
   Existe por causa de um bug real: o menu de compartilhar usava `el(...)` e
   o arquivo nunca importou. O `check-api` nao viu, porque `el` e uma variavel
   local (desestruturada de Utils), e nao uma API global. Tocar em
   "Compartilhar" devolvia `el is not defined` e nada mais acontecia.
*/
const fs = require('fs');
const path = require('path');
const RAIZ = 'C:/Users/Gilson/Documents/Micro Saas/Cifras-pro';

const IGNORAR = new Set(['node_modules', '.git', 'tools', 'dist', '_site']);

// Como cada arquivo pode trazer o `el` para o escopo.
const FORMAS = [
  /const\s*\{[^}]*\bel\b[^}]*\}\s*=/,   // const { el, $ } = U;
  /const\s+el\s*=/,                     // const el = ...
  /^\s*el\s*=/m,                        // el = global.U.el
  /global\s*\.\s*U\s*;/,                 // usa global.U.el(...)
  /function\s+el\s*\(/,                  // utils.js DEFINE o el; nao importa
  /el\s*:\s*(function|\()/,
];

const problemas = [];

(function andar(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { andar(p); continue; }
    if (!e.name.endsWith('.js')) continue;

    const rel = path.relative(RAIZ, p);
    const t = fs.readFileSync(p, 'utf8');

    // Usa `el(` como chamada solta: nao pode ser `.el(`, `U.el(` nem dentro
    // de string. A contagem serve so para decidir se vale olhar.
    const usos = (t.match(/(^|[^.\w$'"`])el\s*\(/g) || []).length;
    if (!usos) continue;

    // Tem alguma forma de trazer o `el` para o escopo?
    const traz = FORMAS.some((re) => re.test(t));
    if (traz) continue;

    // Onde, para a mensagem apontar a linha certa.
    const linhas = t.split(/\r?\n/);
    const onde = [];
    linhas.forEach((l, i) => {
      if (/(^|[^.\w$'"`])el\s*\(/.test(l)) onde.push((i + 1) + ': ' + l.trim().slice(0, 74));
    });

    problemas.push({ rel, usos, onde });
  }
})(RAIZ);

console.log('\n=== `el` importado antes de usado ===');
if (!problemas.length) {
  console.log('  ok    todo arquivo que chama el() o tem no escopo');
} else {
  console.log('\n  FALHA ' + problemas.length + ' arquivo(s) chamam el() sem importar:\n');
  for (const p of problemas) {
    console.log('    ' + p.rel + '  (' + p.usos + ' chamada(s))');
    p.onde.slice(0, 3).forEach((l) => console.log('      ' + l));
    if (p.onde.length > 3) console.log('      ... e mais ' + (p.onde.length - 3));
    console.log('');
  }
  console.log('  Sintaxe passa: `el` e uma variavel, entao o verificador de sintaxe');
  console.log('  acha o arquivo perfeito. O erro so aparece em tempo de execucao.');
}

console.log('\n=================================================');
console.log(problemas.length ? '  ' + problemas.length + ' arquivo(s)' : '  tudo no escopo');
console.log('=================================================\n');
process.exit(problemas.length ? 1 : 0);