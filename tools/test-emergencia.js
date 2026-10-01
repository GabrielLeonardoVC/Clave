/* Testes do conversor de tom e da montagem de endereco.
   Rodar:  node tools/test-emergencia.js

   Sao as contas que dizem quantos tons vao de uma tonica ate outra. Um erro
   aqui nao quebra a tela: mostra "+1 tom" para um salto de meio tom, e quem
   leva a capotraste errada so descobre no ensaio.
*/
require('../js/core/utils.js');
const M = require('../js/core/music.js');

// O modulo de tela usa `global.UI`, `global.Music` e `document`. Os testes
// precisam das duas primeiras; o `document` so e usado dentro das funcoes de
// interface, que nao sao chamadas aqui.
global.Music = M;
global.UI = { toast: function () {}, sheet: function () {}, icons: function () {} };

const E = require('../js/views/emergencia.js');

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const good = actual === expected;
  good ? pass++ : fail++;
  console.log((good ? '  ok   ' : '  FALHA') + '  ' + label +
    (good ? '' : '  -> obtido ' + JSON.stringify(actual) + ', esperado ' + JSON.stringify(expected)));
}
function ok(cond, label) { eq(!!cond, true, label); }

console.log('\n=== 1. Ler a tonica escrita ===');
eq(E.parseTon('C').pc, 0, 'Do');
eq(E.parseTon('Am').pc, 9, 'La menor');
eq(E.parseTon('Bb').pc, 10, 'Sib bemol');
eq(E.parseTon('F#').pc, 6, 'Fa susteno');
eq(E.parseTon('c').pc, 0, 'minuscula tambem');
eq(E.parseTon(' am ').pc, 9, 'espaco em volta e ignorado');
eq(E.parseTon('Am').modo, 'minor', 'modo menor');
eq(E.parseTon('C').modo, 'major', 'modo maior');
eq(E.parseTon('Am').rotulo, 'Am', 'rotulo de Am');
eq(E.parseTon('Bb').rotulo, 'Bb', 'rotulo de Bb');

console.log('\n=== 2. A extensao do acorde nao atrapalha ===');
// Quem converte de Am para C quer saber quantos tons. O "7", o "sus4" e o
// "maj" nao mudam a tonica, e nao podem fazer o conversor recusar a entrada.
eq(E.parseTon('Am7').pc, 9, 'Am7 e La menor');
eq(E.parseTon('Cmaj7').pc, 0, 'Cmaj7 e Do');
eq(E.parseTon('F#m7b5').pc, 6, 'F#m7b5 e Fa susteno');
eq(E.parseTon('Cmin').pc, 0, '"min" tambem e menor');

console.log('\n=== 3. Entrada que nao e tom ===');
eq(E.parseTon(''), null, 'vazio');
eq(E.parseTon('   '), null, 'so espacos');
eq(E.parseTon(null), null, 'nulo');
eq(E.parseTon('H'), null, 'letra que nao e nota');
eq(E.parseTon('123'), null, 'numero');
eq(E.parseTon('###'), null, 'so sustenos');

console.log('\n=== 4. Quantos tons ===');
eq(E.diferenca(0, 9).semitons, -3, 'De para La menor sao 3 tons para baixo');
eq(E.diferenca(0, 3).semitons, 3, 'De para Mib sao 3 tons para cima');
eq(E.diferenca(0, 0).semitons, 0, 'mesmo tom');
eq(E.diferenca(0, 7).semitons, -5, 'De para Sol sao 5 para baixo, e nao 7 para cima');
eq(E.diferenca(0, 5).semitons, 5, 'De para Fa: o caminho curto e 5 para cima, e nao 7 para baixo');
eq(E.diferenca(7, 0).semitons, 5, 'Sol para De sao 5 para cima');
eq(E.diferenca(11, 2).semitons, 3, 'Si para Re sao 3 para cima');

console.log('\n=== 5. O caminho mais curto, sempre ===');
// Entre duas tonalidades existem dois caminhos, e so um cabe na mao. Um
// salto de 7 tons e o oposto de 5, e o app tem de escolher o de 5.
{
  let pior = 0;
  for (let a = 0; a < 12; a++) {
    for (let b = 0; b < 12; b++) {
      const s = Math.abs(E.diferenca(a, b).semitons);
      if (s > pior) pior = s;
    }
  }
  eq(pior, 6, 'nenhum salto passa de 6 tons — e a distancia maxima na roda');
}
{
  let ok2 = true;
  for (let a = 0; a < 12; a++) {
    for (let b = 0; b < 12; b++) {
      const d = E.diferenca(a, b);
      // Ida e volta pelo caminho mais curto tem de voltar.
      if (E.diferenca(b, a).semitons !== -d.semitons) ok2 = false;
    }
  }
  eq(ok2, true, 'ir e voltar cancela exatamente');
}
{
  // Um tom so pode ter, no maximo, duas metades que somam ele.
  let ok3 = true;
  for (let a = 0; a < 12; a++) {
    for (let b = 0; b < 12; b++) {
      const meio = E.diferenca(a, M.mod12(a + 6)).semitons;
      if (meio !== 6 && meio !== -6) ok3 = false;
    }
  }
  eq(ok3, true, 'meio tom circular da sempre 6');
}
// O tritone e o caso que quebrava. De Do para Fa susteno e +6; de Fa susteno
// para Do tem de ser -6, senao o conversor manda afinar para cima na volta.
eq(E.diferenca(0, 6).semitons, 6, 'Do para Fa susteno e 6 para cima');
eq(E.diferenca(6, 0).semitons, -6, 'Fa susteno para Do e 6 para BAIXO');
eq(E.diferenca(0, 6).semitons + E.diferenca(6, 0).semitons, 0, 'o tritone cancela na volta');

console.log('\n=== 6. Cents ===');
eq(E.diferenca(0, 3).cents, 300, '3 tons sao 300 cents');
eq(E.diferenca(0, 3).semitons * 100, E.diferenca(0, 3).cents, 'cents e sempre o tom por 100');
eq(E.diferenca(9, 0).cents, 300, '3 tons para cima tambem da 300');
eq(E.diferenca(0, 6).cents, 600, 'tritone: 6 tons');
eq(E.diferenca(0, 7).cents, -500, 'o caminho curto de 5 tons da -500, e nao +700');

console.log('\n=== 7. O texto diz o que fazer ===');
ok(E.diferenca(0, 0).mesmo, 'mesmo tom e marcado');
eq(E.diferenca(0, 0).texto, 'mesmo tom', 'e o texto e curto');
ok(/1 tom/.test(E.diferenca(0, 1).texto), 'um tom no singular');
ok(/3 tons/.test(E.diferenca(0, 3).texto), 'tres tons no plural');
ok(/para baixo/.test(E.diferenca(3, 0).dica), 'descer diz para baixo');
ok(/para cima/.test(E.diferenca(0, 3).dica), 'subir diz para cima');
eq(E.diferenca(0, 0).dica, '', 'mesmo tom nao da dica');

console.log('\n=== 8. Onde a busca leva ===');
eq(E.FONTES.length, 5, 'cinco destinos');
const t = 'Evidencias Titans';
E.FONTES.forEach(function (f) {
  const u = E.urlDe(f.id, t);
  ok(u.indexOf('https://') === 0, f.id + ' abre em https');
  ok(u.indexOf('Evidencias') >= 0, f.id + ' leva o termo junto');
});
ok(E.urlDe('youtube', t).indexOf('youtube.com') > 0, 'YouTube vai para o YouTube');
ok(E.urlDe('letras', t).indexOf('letras.mus.br') > 0, 'Letras vai para o Letras');
ok(E.urlDe('cifraclub', t).indexOf('cifraclub.com.br') > 0, 'Cifra Club vai para o Cifra Club');
ok(E.urlDe('inartist', t).indexOf('inartist') > 0, 'InArtist vai para o InArtist');
ok(E.urlDe('livre', t).indexOf('cifra') > 0, 'o Google recebe "cifra letra" junto');
// Termo vazio nao pode gerar um endereco que abre a pagina inicial sem querer.
eq(E.urlDe('youtube', ''), '', 'termo vazio nao gera endereco');
eq(E.urlDe('cifraclub', '   '), '', 'so espacos tambem nao');
// Espaco precisa virar %20 ou +, senao o endereco quebra na hora do +.
ok(E.urlDe('cifraclub', 'a b').indexOf('+b') > 0, 'espaco vira + no Cifra Club');
ok(E.urlDe('youtube', 'a b').indexOf('%20') > 0, 'espaco vira %20 no YouTube');

console.log('\n=================================================');
console.log('  ' + pass + ' passaram, ' + fail + ' falharam');
console.log('=================================================\n');
process.exit(fail ? 1 : 0);