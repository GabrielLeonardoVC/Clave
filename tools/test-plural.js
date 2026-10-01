/* =========================================================
   ACORDE - tools/test-plural.js
   O numero concorda com a palavra — e a palavra existe.

   Este teste existe por causa de duas falhas que so apareceram quando o numero
   e a palavra apareceram juntos na tela:

     1. "1 músicas". O codigo estava certo; o portugues e que nao estava. E o
        detalhe que faz um app parecer escrito sem ninguem pensar.

     2. "2 homemes" e "2 festivales". Estes foram criados pelo conserto do
        primeiro: a tentativa de adivinhar o pluralvr. Em portugues o plural de
        `homem` e `homens`, o de `festival` e `festivais`, o de `papel` e
        `papeis` — e nenhuma das tres cabe em "acrescente `es`".

   A licao esta no arquivo, na funcao. Aqui ela vira asercao: o plural nunca
   inventa palavra. Uma palavra errada na tela e pior do que uma repetida,
   porque a pessoa percebe na hora que aquilo nao foi escrito por gente.
   ========================================================= */
'use strict';

const path = require('path');

const RAIZ = path.join(__dirname, '..');

let passou = 0;
let falhou = 0;

function igual(recebido, esperado, rotulo) {
  if (recebido === esperado) {
    passou++;
    console.log('  ok    ' + rotulo + ' -> ' + JSON.stringify(recebido));
  } else {
    falhou++;
    console.log('  FALHA ' + rotulo);
    console.log('        recebido ' + JSON.stringify(recebido) + ', esperado ' + JSON.stringify(esperado));
  }
}

console.log('\n=== o numero concorda com a palavra ===');

// `plural` le `Utils` por dentro do arquivo, entao ele precisa estar instalado.
global.window = global;
require(path.join(RAIZ, 'js/core/utils.js'));
const U = global.Utils;

console.log('\n=== o caso que existia em toda tela ===');
igual(U.plural(1, 'música'), '1 música', 'uma música');
igual(U.plural(2, 'música'), '2 músicas', 'duas músicas');
igual(U.plural(0, 'música'), '0 músicas', 'nenhuma música');
igual(U.plural(12, 'cifra'), '12 cifras', 'doze cifras');

console.log('\n=== a palavra que ganha so um s ===');
igual(U.plural(2, 'dia'), '2 dias', 'dois dias');
igual(U.plural(2, 'chave'), '2 chaves', 'duas chaves');
igual(U.plural(2, 'evento'), '2 eventos', 'dois eventos');
igual(U.plural(2, 'acorde'), '2 acordes', 'dois acordes');
igual(U.plural(3, 'anotação'), '3 anotações', 'três anotações');

console.log('\n=== as palavras que nao seguem a regra ===');
igual(U.plural(2, 'capaz'), '2 capazes', 'duas pessoas capazes');
igual(U.plural(2, 'versão'), '2 versões', 'duas versões');
igual(U.plural(2, 'mês'), '2 meses', 'dois meses');
igual(U.plural(2, 'país'), '2 países', 'dois países');

console.log('\n=== as palavras que a heuristica estragava ===');
/* Estas sao a razao de as regras estarem em lista e nao em "acrescente es".
 *
 * A primeira versao somava `es` a quem terminava em `-l`, `-m` e `-z`:
 * "2 homemes", "2 festivales".
 *
 * A segunda versao tirou a heuristica e deixou `+s`:
 * "2 homems", "2 papels", "2 luzs".
 *
 * As duas produziram palavra errada. Estas asercoes existem para travar as
 * duas, e para o dia em que alguem tentar de novo "simplificar" a lista. */
igual(U.plural(2, 'homem'), '2 homens', 'homem ganha ns');
igual(U.plural(2, 'jovem'), '2 jovens', 'jovem tambem');
igual(U.plural(2, 'papel'), '2 papéis', 'papel ganha eis');
igual(U.plural(2, 'animal'), '2 animais', 'animal ganha is');
igual(U.plural(3, 'luz'), '3 luzes', 'luz ganha zes');
igual(U.plural(2, 'altar'), '2 altares', 'altar ganha es');
igual(U.plural(2, 'festival'), '2 festivais', 'festival ganha ais');
igual(U.plural(2, 'anotação'), '2 anotações', 'anotação ganha ões');
igual(U.plural(2, 'versão'), '2 versões', 'versao tambem');

console.log('\n=== palavra que vem sem acento ===');
igual(U.plural(2, 'pais'), '2 países', 'o dicionario acerta o que a regra erra');

console.log('\n=== o chamador manda a palavra quando sabe ===');
igual(U.plural(2, 'cifra', 'cifras'), '2 cifras', 'plural explicito, igual ao padrao');
igual(U.plural(1, 'cifra', 'cifras'), '1 cifra', 'o singular ignora o plural explicito');
igual(U.plural(2, 'homem', 'homens'), '2 homens', 'quem sabe a forma, informa');
igual(U.plural(2, 'pais', 'países'), '2 países', 'inclusive quando a entrada e a forma errada');

console.log('\n=== numeros que nao vem do length ===');
igual(U.plural(NaN, 'música'), '0 músicas', 'NaN vira zero, e nao "NaN músicas"');
igual(U.plural(undefined, 'cifra'), '0 cifras', 'undefined vira zero');
igual(U.plural(-3, 'música'), '-3 músicas', 'negativo mantem a forma, e nao vira "1 música"');
igual(U.plural(1.5, 'música'), '1.5 músicas', 'fracionario nao vira singular');

console.log('\n=== o que a tela mostra na pratica ===');
/* O que aparecia no aviso do sistema quando a escala tinha uma musica so. */
const aviso = (n) => 'Ensaio · ' + U.plural(n, 'música');
igual(aviso(1), 'Ensaio · 1 música', 'o aviso do sistema com uma');
igual(aviso(4), 'Ensaio · 4 músicas', 'o aviso do sistema com quatro');
ok(aviso(1).indexOf('1 músicas') < 0, 'o texto "1 músicas" nao volta');

function ok(recebido, rotulo) {
  if (recebido) { passou++; console.log('  ok    ' + rotulo); }
  else { falhou++; console.log('  FALHA ' + rotulo); }
}

console.log('\n=================================================');
console.log('  ' + passou + ' asercao(oes) passou(aram), ' + falhou + ' falhou(aram)');
console.log('=================================================\n');
process.exit(falhou ? 1 : 0);
