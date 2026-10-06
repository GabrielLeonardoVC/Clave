'use strict';
/* Prova que o verificador de concordancia pega o defeito.
 *
 * Quebra uma frase de volta ao estado antigo — `n + ' musicas'`, sem combinar —
 * roda o verificador, mostra que ele acusa, e restaura.
 *
 * Um verificador que nunca falhou e um verificador que a pessoa ignora. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/* A raiz vem do proprio repositorio, e nao de um caminho fixo.
 *
 * O caminho absoluto que estava aqui so resolvia na maquina em que o arquivo
 * foi escrito; em qualquer outra a suite quebrava antes do primeiro caso. */
const { RAIZ } = require('./arquivos.js');
const ARQ = path.join(RAIZ, 'tools/check-concordancia.js');

const CASOS = [
  {
    nome: 'aviso do sistema diz "1 musicas"',
    arquivo: 'js/core/notify.js',
    quebra: /U\.plural\(e\.musicas\.length, 'música'\)/,
    conserta: "e.musicas.length + ' músicas'",
  },
  {
    nome: 'folha de impressao diz "1 cifras"',
    arquivo: 'js/core/print.js',
    quebra: /esc\(U\.plural\(lista\.length, 'cifra'\)\)/,
    conserta: "lista.length + ' cifras'",
  },
  {
    nome: 'U.plural deixa de ser exportado',
    arquivo: 'js/core/utils.js',
    quebra: /fmtBytes, plural, openLink/,
    conserta: 'fmtBytes, openLink',
  },
];

function rodar() {
  try {
    execFileSync(process.execPath, [ARQ], { cwd: RAIZ, encoding: 'utf8', timeout: 60000 });
    return { passou: true, saida: '' };
  } catch (e) {
    return { passou: false, saida: (e.stdout || '') + (e.stderr || '') };
  }
}

let falhas = 0;

console.log('\n=== o verificador precisa acusar o numero sem combinar ===');

const antes = rodar();
console.log((antes.passou ? '  ok    ' : '  FALHA ') + 'com o codigo certo, o verificador passa');
if (!antes.passou) {
  falhas++;
  console.log(antes.saida.split('\n').filter((l) => l.indexOf('FALHA') >= 0).join('\n'));
}

for (const c of CASOS) {
  const p = path.join(RAIZ, c.arquivo);
  const orig = fs.readFileSync(p, 'utf8');

  if (!c.quebra.test(orig)) {
    console.log('  FALHA  "' + c.nome + '": a expressao a quebrar nao existe mais em ' + c.arquivo);
    console.log('        o codigo mudou de forma e o teste ficou velho');
    falhas++;
    continue;
  }

  fs.writeFileSync(p, orig.replace(c.quebra, c.conserta), 'utf8');
  const r = rodar();
  const acusou = !r.passou;

  console.log((acusou ? '  ok    ' : '  FALHA ') + 'abriu "' + c.nome + '" e o verificador '
    + (acusou ? 'acusou' : 'NAO acusou'));
  if (acusou) {
    const achou = r.saida.split('\n').find((l) => l.indexOf('FALHA') >= 0);
    if (achou) console.log('        ' + achou.trim().slice(0, 92));
  } else {
    falhas++;
  }

  fs.writeFileSync(p, orig, 'utf8');
}

const depois = rodar();
console.log((depois.passou ? '  ok    ' : '  FALHA ') + 'fechado, o verificador volta a passar');
if (!depois.passou) { falhas++; console.log(depois.saida); }

console.log('');
console.log('=================================================');
console.log(falhas
  ? falhas + ' problema(s)'
  : 'o verificador barra o numero sem combinar, e cala no ja resolvido');
console.log('=================================================\n');
process.exit(falhas ? 1 : 0);
