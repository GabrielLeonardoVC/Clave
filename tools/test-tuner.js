/* Testes do motor do afinador.
   Rodar:  node tools/test-tuner.js

   Sao as contas que decidem qual nota o visor mostra. Um erro aqui nao da
  exception: o afinador simplesmente mostra a nota errada, e o musico afina o
   instrumento errado com confianca.                                      */
const T = require('../js/core/tuner.js');

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const good = actual === expected;
  good ? pass++ : fail++;
  console.log((good ? '  ok   ' : '  FALHA') + '  ' + label +
    (good ? '' : '  -> obtido ' + JSON.stringify(actual) + ', esperado ' + JSON.stringify(expected)));
}
function ok(cond, label) { eq(!!cond, true, label); }

console.log('\n=== 1. Frequencia de uma nota ===');
eq(Math.round(T.notaParaHz(9, 4, 440)), 440, 'A4 = 440 Hz');
eq(Math.round(T.notaParaHz(0, 4, 440)), 262, 'C4 = 262 Hz');
eq(Math.round(T.notaParaHz(0, 3, 440)), 131, 'C3 = 131 Hz');
eq(Math.round(T.notaParaHz(2, 5, 440)), 587, 'D5 = 587 Hz');
eq(Math.round(T.notaParaHz(11, 2, 440)), 123, 'B2 = 123 Hz');
eq(Math.round(T.notaParaHz(11, 1, 440)), 62, 'B1 = 62 Hz');

console.log('\n=== 2. A4 ajustavel (orquestra afina em 442) ===');
eq(Math.round(T.notaParaHz(9, 4, 442)), 442, 'A4 = 442 Hz quando pedido');
eq(Math.round(T.notaParaHz(9, 4, 445)), 445, 'A4 = 445 Hz quando pedido');
eq(T.hzParaNota(442, 442).nome, 'A', 'com A4 em 442, o dó afinado e o A');
eq(T.hzParaNota(440, 442).cents < 0, true, 'com A4 em 442, 440 Hz fica abaixo da nota');

console.log('\n=== 3. Frequencia vira nota ===');
const a4 = T.hzParaNota(440);
eq(a4.nome, 'A', '440 Hz e nota A');
eq(a4.oitava, 4, '440 Hz e a oitava 4');
eq(a4.cents, 0, '440 Hz esta afinado, 0 cents');

const c4 = T.hzParaNota(261.63);
eq(c4.nome, 'C', '261,63 Hz e nota C');
eq(c4.oitava, 4, '261,63 Hz e a oitava 4');

const a3 = T.hzParaNota(220);
eq(a3.nome, 'A', '220 Hz e nota A');
eq(a3.oitava, 3, '220 Hz e a oitava 3');

const a2 = T.hzParaNota(110);
eq(a2.nome, 'A', '110 Hz e nota A');
eq(a2.oitava, 2, '110 Hz e a oitava 2');

console.log('\n=== 4. Cents: o sinal diz para que lado ===');
// Meio caminho para C#: esta acima, e tem de aparecer positivo.
const meioAcima = T.hzParaNota(277.18); // C#4 exato
eq(meioAcima.nome, 'C#', '277,18 Hz e C#');
eq(meioAcima.cents, 0, 'C# exato esta em 0 cents');

const quaseC = T.hzParaNota(259.3); // pouco abaixo do C4
eq(quaseC.nome, 'C', '259,3 Hz ainda e lido como C');
eq(quaseC.cents < 0, true, 'abaixo do centro aparece com cents negativo');

// Meio caminho para cima: 50 cents acima do A4 sao 456,6 Hz, e isso ja e outra
// nota — A#. 445,5 Hz e so A com 15 cents, e continua sendo A.
const meioCima = T.hzParaNota(440 * Math.pow(2, 50 / 1200));
eq(meioCima.nome, 'A#', '50 cents acima do A ja vira A#');

// Alguns cents acima do A ainda e A, e o app precisa dizer "affine mais".
const poucosCents = T.hzParaNota(445.5);
eq(poucosCents.nome, 'A', '15 cents acima do A continua sendo A');
ok(poucosCents.cents > 0, 'e os cents avisam que ainda falta subir');

console.log('\n=== 5. Limites: o que nao e nota ===');
eq(T.hzParaNota(0), null, 'zero nao e nota');
eq(T.hzParaNota(15), null, '15 Hz e ruido de ventilador');
eq(T.hzParaNota(-100), null, 'frequencia negativa');
eq(T.hzParaNota(NaN), null, 'NaN nao quebra');
eq(T.hzParaNota(Infinity), null, 'infinito nao quebra');
eq(T.hzParaNota(null), null, 'nulo nao quebra');

console.log('\n=== 6. "Perto" so quando esta perto de verdade ===');
eq(T.hzParaNota(440).perto, true, 'afinado esta perto');
ok(!T.hzParaNota(446).perto, 'meio tom acima nao conta como perto');
ok(!T.hzParaNota(434).perto, 'meio tom abaixo nao conta como perto');
ok(T.hzParaNota(441.5).perto, true, '1,5 Hz acima ja conta como perto');

console.log('\n=== 7. As 12 alturas voltam ===');
for (let pc = 0; pc < 12; pc++) {
  const hz = T.notaParaHz(pc, 4, 440);
  const lido = T.hzParaNota(hz);
  eq(lido.pc, pc, 'nota ' + pc + ' (' + T.LETRAS[pc] + ') volta certaina');
}

console.log('\n=== 8. Medir a frequencia de um sinal sintetizado ===');
// Gera uma onda quadrada de frequencia conhecida e confere se a deteccao
// acha. E o teste que pega erro de indice, de normalizacao e de faixa.
function onda(amostras, taxa, hz, tipo) {
  const buf = new Float32Array(amostras);
  for (let i = 0; i < amostras; i++) {
    const f = (i * hz) / taxa;
    buf[i] = tipo === 'quadrada'
      ? (Math.sin(2 * Math.PI * f) > 0 ? 0.8 : -0.8)
      : Math.sin(2 * Math.PI * f) * 0.8;
  }
  return buf;
}

const TAXA = 44100;
[
  ['onda senoidal em 440 Hz', 440, 'seno'],
  ['onda senoidal em 110 Hz (La grave)', 110, 'seno'],
  ['onda senoidal em 82 Hz (Si grave)', 82, 'seno'],
  ['onda senoidal em 880 Hz', 880, 'seno'],
  ['onda quadrada em 220 Hz', 220, 'quadrada'],
  ['onda quadrada em 146 Hz', 146, 'quadrada'],
].forEach(([rotulo, hz, tipo]) => {
  const medido = T.detectarHz(onda(4096, TAXA, hz, tipo), TAXA);
  // Uma corda vibra um pouco fora da nota; 2 cents de folga e folga de corda,
  // nao erro de medida.
  const erro = medido > 0 ? 1200 * Math.log2(medido / hz) : 9999;
  ok(erro < 20, rotulo + ' -> ' + (medido > 0 ? medido.toFixed(1) + ' Hz' : 'nao mediu') +
    ' (erro ' + erro.toFixed(1) + ' cents)');
});

console.log('\n=== 9. Silencio e ruido nao viram nota ===');
const silencio = new Float32Array(4096);
eq(T.detectarHz(silencio, TAXA), 0, 'silencio devolve zero');
eq(T.hzParaNota(T.detectarHz(silencio, TAXA)), null, 'silencio nao vira nota');

const ruido = new Float32Array(4096);
for (let i = 0; i < ruido.length; i++) ruido[i] = Math.random() * 2 - 1;
const hzRuido = T.detectarHz(ruido, TAXA);
ok(hzRuido === 0 || hzRuido < 27 || hzRuido > 4200,
  'ruido fora da faixa util (' + (hzRuido ? hzRuido.toFixed(0) + ' Hz' : 'zero') + ')');

eq(T.detectarHz(new Float32Array(10), TAXA), 0, 'amostra curta demais nao mede');

console.log('\n=== 10. Suavizacao segura o visor ===');
const h = [];
eq(Math.round(T.suavizar(h, 440)), 440, 'primeira leitura e ela mesma');
T.suavizar(h, 445);
T.suavizar(h, 441);
const media = T.suavizar(h, 442);
ok(media > 440 && media < 445, 'a media fica no meio das leituras: ' + media.toFixed(1));
ok(h.length <= 7, 'o historico nao cresce sem limite');

// Enche o historico e confirma que a janela e fixa.
for (let i = 0; i < 50; i++) T.suavizar(h, 440);
eq(h.length, 7, 'a janela para em 7 leituras');
eq(Math.round(T.suavizar(h, 440)), 440, 'com 7 leituras iguais, a media e exata');

console.log('\n=================================================');
console.log('  ' + pass + ' passaram, ' + fail + ' falharam');
console.log('=================================================\n');
process.exit(fail ? 1 : 0);
