/* =========================================================
   tools/test-cifra-vs-letra.js
   CIFRA E LETRA: ONDE TERMINA UM ACORDE E COMECA O TEXTO

   A PERGUNTA QUE ESTE ARQUIVO RESPONDE

   Numa cifra escrita a mao, `Am cantar com voce` PODE significar um acorde de
   La menor seguido da palavra "cantar", ou pode ser so letra. O Clave nao
   pode adivinhar, entao precisa de uma regra — e a regra precisa ser testada
   nas duas direcoes: nao comendo letra, e nao comendo acorde.

   ESTE ARQUIVO NASO INVENTOU NENHUMA REGUA

   Onde a linha tem dois ou mais acordes, ela e' de acordes e transpõe. Onde
   tem um so, a linha e' tratada como letra e fica como esta. Essa regra é do
   projeto e ja existia antes deste arquivo; o que ele faz e PRENDE-LA, porque
   regra que ninguem testa volta errada sem avisar.

   A ARMADILHA QUE ESTE ARQUIVO FECHA

   Nos testes anteriores eu media `Am cantar` duplicando a linha:
   `'Am cantar' + '  ' + 'Am cantar'`. Isso cria DOIS tokens de acorde, a linha
   passa a ser de acordes, e o resultado é `Bm cantar`. Entaio o bug estava no
   teste, nao no produto — e o jeito de um probe mentir e flaky é repeating-lo
   com confiança. Aqui a linha é sempre usada como a pessoa digita, uma vez so.

   O QUE ESTE ARQUIVO PROVA
     - palavra de letra nunca vira acorde, mesmo começando por letra de nota;
     - `Amo` não tem forma de acorde (o `o` solto é diminuto, e depois de `m`
       não é diminuto);
     - acorde legítimo continua transpondo: `Am`, `Am7`, `Am Dm G7`;
     - cifra acima da letra transpõe e a letra fica intacta;
     - pontuação, espaços, tabulação e quebras de linha são preservados.
   ========================================================= */
'use strict';

const path = require('path');
const M = require(path.join(__dirname, '..', 'js', 'core', 'music.js'));

let passou = 0;
let falhou = 0;
const problemas = [];
const ok = (cond, titulo, detalhe) => {
  if (cond) { passou++; return true; }
  falhou++;
  problemas.push(titulo + (detalhe ? '  ->  ' + detalhe : ''));
  return false;
};
const secao = (t) => console.log('\n=== ' + t + ' ===');

/* SEMPRE linha unica, como a pessoa digita. Nunca `x + '  ' + x`. */
const transp = (linha, semis) => M.transposeCifra(linha, semis === undefined ? 2 : semis, false);

/* ============================================================ */
secao('1. letra nunca vira acorde');

const LETRA = [
  'Amo cantar com você',
  'Eu amo você',
  'AmoPk',
  'amo',
  'maior',
  'menor',
  'amo e vida',
  'Alma',
  'Aqui',
  'Debo',
  'beleza',
  'Amor',
  'Canta comigo',
];
for (const frase of LETRA) {
  ok(transp(frase) === frase, 'intacto: ' + JSON.stringify(frase), JSON.stringify(transp(frase)));
}

/* As que comecam por letra de nota sao as traiçoeiras: e exatamente ahi que um
   token vira acorde por acidente. */
ok(M.parseChord('Amo') === null, 'Amo não tem forma de acorde');
ok(M.parseChord('AmoPk') === null, 'AmoPk não tem forma de acorde');
ok(M.parseChord('amo') === null, 'amo minúsculo não tem forma de acorde');

/* ============================================================ */
secao('2. o diminuto continua valendo (a correção foi de posição, não de remoção)');

ok(M.parseChord('Co') !== null, 'Co continua sendo acorde');
ok(M.parseChord('Co7') !== null, 'Co7 continua sendo acorde');
ok(M.matchQuality('o') === 'dim', 'Co tem qualidade de diminuto', M.matchQuality('o'));
ok(transp('Co7') === 'Ddim7', 'Co7 +2 é Ddim7', transp('Co7'));

/* ============================================================ */
secao('3. acorde legítimo continua sendo acorde e transpondo');

const ACORDES = [
  ['Am', 'Bm'],
  ['Am7', 'Bm7'],
  ['Am7  Dm', 'Bm7  Em'],
  ['A', 'B'],
  ['A7', 'B7'],
  ['C      G', 'D      A'],
  ['Am  Dm  G7', 'Bm  Em  A7'],
];
for (const caso of ACORDES) {
  ok(transp(caso[0]) === caso[1], 'transpõe: ' + caso[0] + ' -> ' + caso[1], transp(caso[0]));
}

/* Um acorde sozinho NAO é ambíguo: com a linha inteira, ele é cifra. */
ok(M.isChordLine('Am'), 'linha só com Am é linha de acordes');
ok(transp('Am') === 'Bm', 'Am sozinho transpõe', transp('Am'));

/* ============================================================ */
secao('4. a linha mista: a REGRA, e ela é do projeto');

/* Um acorde só junto de letra: a linha NAO é de acordes, e fica como está.
   Esta é a regra deliberada — sem ela, qualquer verso que tivesse uma palavra
   em beginnings de nota seria reescrito. */
ok(!M.isChordLine('Am cantar'), '"Am cantar" não é linha de acordes');
ok(transp('Am cantar') === 'Am cantar', '"Am cantar" fica intacta', transp('Am cantar'));
ok(transp('Am  cantar  com  você') === 'Am  cantar  com  você',
  'espaçamento múltiplo preservado', transp('Am  cantar  com  você'));

/* Dois acordes na linha: a linha É de acordes. */
ok(M.isChordLine('Am  Dm'), '"Am  Dm" é linha de acordes');
ok(transp('Am  Dm') === 'Bm  Em', '"Am  Dm" transpõe', transp('Am  Dm'));

/* ============================================================ */
secao('5. cifra acima da letra: transpõe o acorde, não mexe no texto');

const COM_LINHA = 'Am      C\nCantar  com  você';
const saida = transp(COM_LINHA);
ok(saida === 'Bm      D\nCantar  com  você', 'cifra acima da letra', JSON.stringify(saida));

/* Uma palavra que é acorde pode ficar ACIMA da letra e ser transposta sem
   que a letra abaixo mude — é o formato clássico de cifra. */
const DUAS_LINHAS = 'Am\nCantar com você';
ok(transp(DUAS_LINHAS) === 'Bm\nCantar com você',
  'acorde sozinho na linha de cima transpõe; a letra não', JSON.stringify(transp(DUAS_LINHAS)));

/* ============================================================ */
secao('6. pontuação, tabulação e quebras de linha');

const PRESERVAR = [
  ['Am, Dm', 'Bm, Em'],
  ['Am / Dm', 'Bm / Em'],
  ['Am|Cm|G', 'Bm|Dm|A'],
  ['Am\tDm', 'Bm\tEm'],
  /* A pontuacao no fim do acorde tambem transpoe: `C.` vira `D.`. */
  ['Am  C.', 'Bm  D.'],
  /* E o ponto-e-virgula, que e separador de compasso e nao texto. */
  ['Am; Dm', 'Bm; Em'],
];
for (const caso of PRESERVAR) {
  ok(transp(caso[0]) === caso[1], 'preserva separador: ' + JSON.stringify(caso[0]),
    JSON.stringify(transp(caso[0])));
}

/* O TRAVESSAO NAO separa dois acordes aqui, e a linha fica como esta. Esse e o
   comportamento conservador, e e o correto: "Am -Dm" numa letra e escrita
   sobre "Am" e "Dm", e reescrever a frase seria pior do que nao transpor.
   Registrar e o que impede a proxima rodada de "consertar" isto achando que
   era defeito. */
ok(transp('Am \u2014Dm') === 'Am \u2014Dm',
  'travessão entre palavras não vira sequência de acordes',
  JSON.stringify(transp('Am \u2014Dm')));

const LINHAS = 'Am  C\n\nDm  G\n';
ok(transp(LINHAS) === 'Bm  D\n\nEm  A\n', 'linha vazia no meio é preservada',
  JSON.stringify(transp(LINHAS)));

/* ============================================================ */
secao('7. sufixo desconhecido não anda a fundamental em silêncio');

/* Um token que tem forma de acorde mas whose sufixo o motor não nomeia é
   devolvido com o TEXTO intacto e a fundamental movida — é o caminho honesto.
   O que não pode acontecer é o sufixo ser PARCIALMENTE aceito: `m7(5-)`
   virar `m7` perderia o meio-diminuto, que é outro acorde. */
const DESCONHECIDO = [
  ['Cm7(5-)', 'Dm7(5-)'],
  ['C7(13-)', 'D7(13-)'],
  ['C6(9/11+)', 'D6(9/11+)'],
];
for (const caso of DESCONHECIDO) {
  ok(transp(caso[0]) === caso[1], 'sufixo inteiro preservado: ' + caso[0], transp(caso[0]));
}

/* E o oposto: um token que NÃO é acorde não vira um. */
ok(transp('AmoPk') === 'AmoPk', 'AmoPk não vira acorde');

/* ============================================================ */
console.log('\n' + '='.repeat(66));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('\n  PROBLEMAS:');
  problemas.forEach((p) => console.log('   - ' + p));
}
console.log('='.repeat(66) + '\n');
process.exit(falhou ? 1 : 0);