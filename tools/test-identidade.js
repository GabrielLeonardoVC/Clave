/* Prova que o verificador de identidade pega, quebrando uma coisa de cada vez.

   Um verificador que nunca falha e um verificador que a gente ignora. Este
   arquivo quebra um ponto, roda o verificador, mostra que ele acusou, e
   restaura. Repete para cada ponto onde o nome aparece.

   Os pontos vem de `tools/check-identidade.js` — a lista aqui e a mesma. Se um
   ponto novo entrar no verificador e nao entrar aqui, o teste nao prova nada
   sobre ele. E o mesmo motivo de o verificador e a lista ficarem juntos.
*/
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = 'C:/Users/Gilson/Documents/Micro Saas/Cifras-pro';
const ARQ = path.join(RAIZ, 'tools', 'check-identidade.js');
const NOME = require('../js/core/identidade.js').NOME;

const CASOS = [
  {
    nome: 'o titulo da aba',
    arquivo: 'index.html',
    de: '<title>' + NOME,
    para: '<title>Cifra',
  },
  {
    nome: 'a marca na barra',
    arquivo: 'index.html',
    de: 'class="t1">' + NOME.toLowerCase(),
    para: 'class="t1">cifra',
  },
  {
    nome: 'o alt do logo na barra',
    arquivo: 'index.html',
    de: 'alt="' + NOME + '"',
    para: 'alt="Acorde"',
  },
  {
    nome: 'o nome do manifesto',
    arquivo: 'manifest.webmanifest',
    de: '"name": "' + NOME,
    para: '"name": "Cifra',
  },
  {
    nome: 'o short_name do manifesto',
    arquivo: 'manifest.webmanifest',
    de: '"short_name": "' + NOME + '"',
    para: '"short_name": "Cifra"',
  },
  {
    nome: 'o aria-label do desenho',
    arquivo: 'assets/logo.svg',
    de: 'aria-label="' + NOME + '"',
    para: 'aria-label="Acorde"',
  },
  {
    nome: 'o PRODID do calendario',
    arquivo: 'js/core/share.js',
    de: 'PRODID:-//' + NOME + '//',
    para: 'PRODID:-//Cifra//',
  },
  {
    nome: 'o cabecalho do evento compartilhado',
    arquivo: 'js/core/share.js',
    de: 'Repertório — ' + NOME,
    para: 'Repertório — Cifra',
  },
  {
    nome: 'a reserva do nome no backup',
    arquivo: 'js/core/store.js',
    de: "Identidade.NOME : '" + NOME + "'",
    para: "Identidade.NOME : 'Cifra'",
  },
];

function rodar() {
  try {
    execFileSync(process.execPath, [ARQ], { cwd: RAIZ, encoding: 'utf8' });
    return { passou: true, saida: '' };
  } catch (e) {
    return { passou: false, saida: (e.stdout || '') + (e.stderr || '') };
  }
}

let falhas = 0;

console.log('\n=== o verificador precisa falhar quando o nome diverge ===');

/* Antes de tudo: tem de passar. */
const antes = rodar();
console.log((antes.passou ? '  ok    ' : '  FALHA ') +
  'com o nome certo, o verificador passa');
if (!antes.passou) { falhas++; console.log(antes.saida); }

for (const c of CASOS) {
  const caminho = path.join(RAIZ, c.arquivo);
  const original = fs.readFileSync(caminho, 'utf8');

  if (original.indexOf(c.de) < 0) {
    console.log('  FALHA  ' + c.nome + ': o texto a quebrar nao existe — "' + c.de + '"');
    console.log('        (o nome mudou, ou o ponto foi movido; a lista aqui esta velha)');
    falhas++;
    continue;
  }

  fs.writeFileSync(caminho, original.split(c.de).join(c.para), 'utf8');
  const r = rodar();
  const acusou = !r.passou;
  const linha = (r.saida.split('\n').find((l) => l.indexOf('FALHA') >= 0) || '').trim();

  console.log((acusou ? '  ok    ' : '  FALHA ') +
    'quebrou ' + c.nome + ' e o verificador ' + (acusou ? 'acusou' : 'NAO acusou'));
  if (acusou && linha) console.log('        ' + linha.slice(0, 92));
  if (!acusou) falhas++;

  fs.writeFileSync(caminho, original, 'utf8');
}

/* E volta a passar. */
const depois = rodar();
console.log((depois.passou ? '  ok    ' : '  FALHA ') +
  'restaurado, o verificador volta a passar');
if (!depois.passou) { falhas++; console.log(depois.saida); }

console.log('');
console.log('=================================================');
console.log(falhas
  ? falhas + ' problema(s)'
  : 'o verificador falha quando deve, e passa quando deve');
console.log('=================================================\n');
process.exit(falhas ? 1 : 0);