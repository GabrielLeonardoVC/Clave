/* =========================================================
   ACORDE - tools/test-extrator.js

   O extrator de texto precisa acertar. Sem prova, ele e uma opiniao — e uma
   opiniao que ja errou: acusou arquivos corretos e fez o verificador de
   ortografia dizer que coisas certas estavam erradas.

   A prova e a invariante, nao um texto esperado escrito a mao:

     A mascara tem SEMPRE o mesmo comprimento da entrada.

   Isso e verdade e suficiente. Um comentario virado em espaco troca caractere
   por caractere; um regex apagado tambem. Se a mascara devuelve um texto
   maior ou menor, e porque comeu codigo ou duplicou — e e exatamente isso que
   ela ja fez: em `accept: 'image/*'` a barra-estrela da string abriu um
   comentario e o arquivo inteiro foi apagado ate o proximo fechador.

   Sobre a invariante vem o que ela nao garante: que o trecho certo sobrou e que
   o errado sumiu. Esses casos vemNOMES, porque so eles descrevem os defeitos
   que ja aconteceram.

   Rodar: node tools/test-extrator.js
   ========================================================= */
'use strict';

const X = require('./extrair-texto.js');

let pass = 0, fail = 0;

function eq(atual, esperado, rotulo) {
  const bom = atual === esperado;
  bom ? pass++ : fail++;
  console.log((bom ? '  ok    ' : '  FALHA ') + rotulo +
    (bom ? '' : '\n          obtido   ' + JSON.stringify(atual) +
      '\n          esperado ' + JSON.stringify(esperado)));
}

function ok(cond, rotulo) { eq(!!cond, true, rotulo); }

/**
 * O mesmo comprimento. E so isso que se prova aqui.
 *
 * A checagem de "nenhum fechador de bloco sobrando" fica de fora de proposito:
 * uma string pode LEGITIMAMENTE conter `/*`, e e exatamente esse o defeito que
 * fez a mascara antiga comer o arquivo inteiro. Uma verificacao que acusa o
 * conteudo legitimo ensina a pessoa a ignorar a verificacao.
 */
function invariante(entrada, rotulo) {
  const m = X.mascara(entrada);
  eq(m.length, entrada.length, rotulo + ': preserva o comprimento');
  return m;
}

/** O trecho da entrada, com tudo virado em espaco. */
function apagado(texto) { return ' '.repeat(texto.length); }

/* ------------------------------------------------------------
   1. A invariante, em cada formato
   ------------------------------------------------------------ */
console.log('\n=== a mascara preserva o comprimento ===');

const CASOS = [
  ["f(/'x'/g)", 'regex com aspa'],
  ["a.replace(/'/g, 'y')", 'regex em metodo'],
  ['t.replace(/[a/b]/g, "z")', 'regex com barra em classe'],
  ['total / 2', 'divisao depois de identificador'],
  ['(a + b) / c', 'divisao depois de fecha-parentese'],
  ['return /ab/.test(x)', 'regex depois de return'],
  ["t.replace(/\\//g, '')", 'regex com barra escapada'],
  ['a / b * c', 'divisao e multiplicacao'],
  ["accept: 'image/*'", 'string com barra-estrela'],
  ["url: 'https://exemplo'", 'string com duas barras'],
  ['x = 1; // era \'a\' e "b"\ny = 2;', 'comentario de linha com aspas'],
  ['x = 1; /* era \'a\' */\ny = 2;', 'comentario de bloco com aspas'],
  ["f(a); // don't\nf(b);", 'comentario com apostrofo'],
  ['const s = `linha \'um\'\nlinha "dois"`;', 'template de varias linhas'],
  ['const s = `a ${ f("b") } c`;', 'template com expressao'],
  ['const s = `a // isto e texto`;', 'barras dentro de template'],
  ['/*aberto no fim', 'bloco sem fim'],
  ["'aberta no fim", 'string sem fim'],
  ['', 'entrada vazia'],
  ['\n\n\n', 'so quebras'],
];

for (const [entrada, nome] of CASOS) {
  invariante(entrada, nome);
}

/* ------------------------------------------------------------
   2. O que TEM de sobreviver
   ------------------------------------------------------------ */
console.log('\n=== o que a mascara preserva ===');

// String com barra-estrela: foi este que apagava o arquivo.
eq(X.mascara("accept: 'image/*'"), "accept: 'image/*'",
  'string com barra-estrela fica intacta');

// Template: barras e aspas dentro de template sao conteudo.
eq(X.mascara('const s = `a // isto e texto`;'), 'const s = `a // isto e texto`;',
  'duas barras dentro de template sao texto');
eq(X.mascara('const s = `a \'e\' "b"`;'), 'const s = `a \'e\' "b"`;',
  'aspas de todo tipo dentro de template');

// Divisao: barra depois de identificador e depois de fecha-parentese.
eq(X.mascara('total / 2'), 'total / 2', 'divisao depois de identificador');
eq(X.mascara('(a + b) / c'), '(a + b) / c', 'divisao depois de fecha-parentese');
eq(X.mascara('a / b * c'), 'a / b * c', 'divisao e multiplicacao juntas');

/* ------------------------------------------------------------
   3. O que tem de sumir
   ------------------------------------------------------------ */
console.log('\n=== o que a mascara apaga ===');

// As esperadas sao CALCULADAS, nunca digitadas na unha. Um comentario tem um
// comprimento e o texto virado em espaco tem o mesmo — escrever o numero na mao
// erra em um caractere e o teste acusa o codigo certo por um motivo errado.
eq(X.mascara('x = 1; // era \'a\' e "b"\ny = 2;'),
  'x = 1; ' + apagado('// era \'a\' e "b"') + '\ny = 2;',
  'comentario de linha vira espaco');

eq(X.mascara("f(/'x'/g, 'y')"), 'f(' + apagado("/'x'/g") + ', \'y\')',
  'regex com letra de opcao vira espaco');

eq(X.mascara('x = 1; /* era \'a\' */\ny = 2;'),
  'x = 1; ' + apagado('/* era \'a\' */') + '\ny = 2;',
  'comentario de bloco vira espaco');

eq(X.mascara('a = 1; // sem quebra no fim'),
  'a = 1; ' + apagado('// sem quebra no fim'),
  'comentario ate o fim do arquivo vira espaco');

/* ------------------------------------------------------------
   4. Os trechos que a pessoa le
   ------------------------------------------------------------ */
console.log('\n=== os trechos que a pessoa le ===');

function textos(t) { return X.textos(t).map((x) => x.texto); }
function linhas(t) { return X.textos(t).map((x) => x.linha); }

eq(JSON.stringify(textos("f('a', \"b\")")), JSON.stringify(['a', 'b']),
  'aspas simples e duplas');
eq(JSON.stringify(textos("'um' + 'dois'")), JSON.stringify(['um', 'dois']),
  'dois trechos separados por operador');
eq(JSON.stringify(linhas("a;\nb;\nc('x');")), JSON.stringify([3]),
  'a linha do trecho e a da aspa de abertura');

eq(JSON.stringify(textos("f('a'); // 'isto nao conta'")), JSON.stringify(['a']),
  'o que estava em comentario nao vira trecho');

eq(JSON.stringify(textos("f(/'x'/g, 'y')")), JSON.stringify(['y']),
  'o que estava em regex nao vira trecho');

eq(JSON.stringify(textos('"diz \'oi\'"')), JSON.stringify(["diz 'oi'"]),
  'aspas simples dentro de aspas duplas');
eq(JSON.stringify(textos("'diz \"oi\"'")), JSON.stringify(['diz "oi"']),
  'aspas duplas dentro de aspas simples');

eq(JSON.stringify(textos('"diz \\" oi\\""')), JSON.stringify(['diz \\" oi\\"']),
  'barra invertida escapa a aspa: o trecho sai cru, com a barra');

eq(textos("'a'")[0], 'a', 'um unico trecho');

/* ------------------------------------------------------------
   5. A conferencia de fechamento
   ------------------------------------------------------------ */
console.log('\n=== a conferencia de fechamento ===');

eq(X.primeiraAspaAberta("f('a', 'b');"), null, 'tudo fechado: nao acusa nada');
eq(X.primeiraAspaAberta("f(/'/g, 'b');"), null, 'regex com aspa: nao acusa nada');
eq(X.primeiraAspaAberta("f('image/*');"), null, 'string com barra-estrela: nao acusa nada');
eq(X.primeiraAspaAberta('const s = `a\nb`;'), null, 'template de varias linhas: nao acusa nada');

const sobra = X.primeiraAspaAberta("f('aberta");
ok(sobra && sobra.tipo === "'", 'string sem fechar e apontada');
eq(sobra ? sobra.linha : 0, 1, 'e a linha certa');

const sobra2 = X.primeiraAspaAberta("a = 'ok';\nb = 'quebrada\nc = 1;");
ok(!!sobra2 && sobra2.linha === 2, 'string atravessando linha e apontada na linha 2');

/* ------------------------------------------------------------
   6. O classificador de codigo
   ------------------------------------------------------------ */
console.log('\n=== o que e rotulo e o que e codigo ===');

ok(!X.ehCodigo('Apagar a gravacao'), 'frase e rotulo');
ok(!X.ehCodigo('Repertório'), 'palavra so e rotulo');
ok(X.ehCodigo('js/views/cancao.js'), 'caminho de arquivo e codigo');
ok(X.ehCodigo('btn-emergencia'), 'nome de classe e codigo');
ok(X.ehCodigo('#btn-emergencia'), 'seletor com sinal de numero e codigo');
ok(X.ehCodigo('print-area'), 'classe com barra e codigo');
ok(X.ehCodigo('mi_nome'), 'id com sublinhado e codigo');
ok(X.ehCodigo('data:audio'), 'tipo MIME e codigo');

console.log('\n=================================================');
console.log('  ' + pass + ' passaram, ' + fail + ' falharam');
console.log('=================================================\n');
process.exit(fail ? 1 : 0);