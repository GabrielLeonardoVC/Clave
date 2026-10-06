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

console.log('\n=== 8b. A precisao de verdade, medida como o afinador e usado ===');
/* O bloco acima aceita 20 cents. Vinte cents e a tolerancia de um afinador de
 * parede: a pessoa afina a corda 20 cents fora, e ela acha que afinou.
 *
 * Este bloco existe para prender o numero que importa, e a TOLERANCIA aqui e
 * de 1 cent. Nao e exigir demais: e o que a medicao entrega depois da
 * interpolacao do pico. E a tolerancia antiga nunca brotou para menos
 * justamente porque nao havia nada prendendo o numero — e foi assim que os 7,7
 * cents da versao anterior passaram anos sem ninguem reclamar.
 *
 * Os casos sao as cordas de verdade dos instrumentos do app, nas DUAS taxas de
 * amostragem: 44100 no Mac e no PC, e 48000 no iPhone, que e o aparelho em que
 * a pessoa mais vai usar. Um afinador que acerta a 44100 e erra a 48000 so
 * funciona no computador do desenvolvedor. */
const JANELA = 4096;   // o fftSize que a tela realmente usa

/** Uma corda: fundamental mais harmonicos, que e o que o violao faz. */
function corda(n, taxa, f0) {
  const b = new Float32Array(n);
  for (const h of [[1, 1], [2, 0.5], [3, 0.25], [4, 0.12]]) {
    const w = (2 * Math.PI * f0 * h[0]) / taxa;
    for (let i = 0; i < n; i++) b[i] += h[1] * Math.sin(w * i);
  }
  return b;
}

/** Com ruido, porque microfone tem ruido. */
function sujar(buf, semente, nivel) {
  const out = new Float32Array(buf.length);
  let s = semente;
  for (let i = 0; i < buf.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = buf[i] + ((s / 0x7fffffff) - 0.5) * nivel;
  }
  return out;
}

const CORDAS = [
  ['Si1 (contrabaixo, 5 cordas)', 30.87],
  ['Sol2 (violao, 6a corda)', 98.00],
  ['Re2 (violao, 5a corda)', 146.83],
  ['La2 (violao, 4a corda)', 220.00],
  ['Mi3 (violao, 3a corda)', 329.63],
  ['Sol3 (violao, 2a corda)', 392.00],
  ['La3 (cantor)', 220.00],
  ['Do4 (piano)', 261.63],
  ['Sol4 (piano)', 392.00],
  ['La4 (a referencia)', 440.00],
  ['Do5 (piano, agudo)', 523.25],
  ['Sol5 (bem agudo)', 783.99],
];

const TOLERANCIA = 1;   // cent

for (const taxa of [44100, 48000]) {
  console.log('\n-- taxa ' + taxa + ' Hz' + (taxa === 48000 ? ' (a do iPhone)' : '') + ' --');
  let pior = 0;
  for (const c of CORDAS) {
    const buf = sujar(corda(JANELA, taxa, c[1]), 12345, 0.06);
    const r = T.detectar(buf, taxa);
    if (!r.hz) {
      ok(false, c[0] + ' -> NAO LEU');
      pior = 9999;
      continue;
    }
    const cents = 1200 * Math.log2(r.hz / c[1]);
    if (Math.abs(cents) > pior) pior = Math.abs(cents);
    ok(Math.abs(cents) < TOLERANCIA,
      c[0].padEnd(30) + ' -> ' + r.hz.toFixed(3) + ' Hz  (erro ' + cents.toFixed(2) + ' cents)');
  }
  ok(pior < TOLERANCIA,
    'nenhuma corda passou do limite de ' + TOLERANCIA + ' cent (pior: ' + pior.toFixed(2) + ')');
}

console.log('\n-- nunca cair numa oitava errada --');
/* O defeito classico de afinador: o harmonico segundo correlaciona quase tanto
 * quanto a fundamental, e o afinador sobe ou desce uma oitava. O pior caso e
 * nota aguda com harmonico forte, na taxa do iPhone. */
for (const taxa of [44100, 48000]) {
  for (const hz of [98, 220, 392, 440, 523.25, 783.99]) {
    const buf = sujar(corda(JANELA, taxa, hz), 777, 0.08);
    const r = T.detectar(buf, taxa);
    if (!r.hz) { ok(false, hz + ' Hz: nao leu'); continue; }
    const oitavas = Math.abs(Math.round(1200 * Math.log2(r.hz / hz)));
    ok(oitavas === 0, hz + ' Hz a ' + taxa + ' Hz nao caiu de oitava (leu ' + r.hz.toFixed(1) + ')');
  }
}

console.log('\n-- corda desafinada: o caso real do palco --');
/* Ninguem afina em 0 cents. A corda chega -30, e o app precisa mostrar -30 e
 * nao 0. Este bloco pega o detector que arredonda para a nota e perde o
 * desvio — que e o que faz o musico acreditar que afinou. */
for (const alvo of [-40, -18, -7, -2, 2, 7, 18, 40]) {
  const hz = 220 * Math.pow(2, alvo / 1200);
  const buf = sujar(corda(JANELA, 48000, hz), 4242, 0.05);
  const r = T.detectar(buf, 48000);

  /* Duas perguntas differentes, e a segunda e a que a pessoa ve.
   *
   * A primeira: o detector mediu a frequencia que estava tocando? A corda foi
   * desafinada de proposito, entao o valor verdadeiro e `hz` — e nao a nota. A
   * primeira versao deste teste comparava a medida com o `alvo` e falhava nos
   * oito casos, medindo a coisa errada.
   *
   * A segunda: o visor mostra o desvio? Uma corda 40 cents abaixo tem de
   * aparecer como 40 abaixo. Um detector que acerta a frequencia e arredonda
   * para a nota sem levar os cents junto passa na primeira e falha nesta — e e
   * o que faz o musico acreditar que afinou. */
  const erroMedida = r.hz ? 1200 * Math.log2(r.hz / hz) : 9999;
  ok(Math.abs(erroMedida) < 2,
    'corda em ' + String(alvo).padStart(4) + ' cents: o detector mediu sem errar '
    + erroMedida.toFixed(2));

  const nota = r.hz ? T.hzParaNota(r.hz) : null;
  ok(!!nota && Math.abs(nota.cents - alvo) < 2,
    'e o visor mostra ' + (nota ? nota.cents : 'nada') + ' cents (devia mostrar ' + alvo + ')');
}

console.log('\n-- quando nao sabe, o app tem de dizer que nao sabe --');
/* O pior defeito de um afinador nao e ler errado: e ler errado COM CONFIANCA.
 * A pessoa afina a corda no lugar errado e so descobre no palco. Por isso a
 * deteccao devolve confianca, e ela tem de cair quando o som e ruim. */
{
  const limpo = T.detectar(sujar(corda(JANELA, 48000, 220), 5, 0.02), 48000);
  const sujo = T.detectar(sujar(corda(JANELA, 48000, 220), 5, 0.9), 48000);
  ok(limpo.confianca > sujo.confianca,
    'som limpo tem mais confianca que som com ruido (' + limpo.confianca.toFixed(2)
      + ' contra ' + sujo.confianca.toFixed(2) + ')');

  const branco = new Float32Array(JANELA);
  for (let i = 0; i < branco.length; i++) branco[i] = Math.random() * 2 - 1;
  ok(T.detectar(branco, 48000).confianca < 0.8,
    'e ruido branco puro tem confianca baixa, para a tela poder recusar mostrar a nota');
}

console.log('\n-- o que esta fora da faixa musical nao e nota --');
/* Um afinador que aceita qualquer frequencia deixa de ser um afinador. O
 * rumble do aparelho e o chiado do microfone tem frequencia, e uma faixa sem
 * limite transformaria os dois em nota — a pessoa veria "Sol" ao encostar o
 * celular na mesa.
 *
 * A faixa e 27 Hz (Si grave do contrabaixo) a 4200 Hz. Abaixo disso nao ha
 * nota musical; acima, e o conteudo estourado de microfone de eletronico.
 *
 * Este bloco nao existia. A mutacao que solta a faixa passava verde nos 12
 * casos de corda, porque todas as cordas estao dentro dela — e um teste que
 * so verifica o caminho feliz nao verifica o portao. */
{
  ok(T.detectar(sujar(corda(JANELA, 48000, 16), 3, 0.02), 48000).hz === 0,
    'rumble de 16 Hz nao vira nota');
  ok(T.detectar(sujar(corda(JANELA, 48000, 20), 3, 0.02), 48000).hz === 0,
    '20 Hz, pouco acima do limite, tambem nao');
  ok(T.detectar(sujar(corda(JANELA, 48000, 7000), 3, 0.02), 48000).hz === 0,
    'chiado de 7 kHz nao vira nota (aliasing na reducao de taxa)');
  ok(T.detectar(sujar(corda(JANELA, 48000, 27), 3, 0.02), 48000).hz === 0,
    '27 Hz sao so 2,3 periodos na janela: recusa, e o honesto');
  ok(T.detectar(sujar(corda(JANELA, 48000, 30.87), 3, 0.02), 48000).hz > 0,
    'e o Si grave do contrabaixo de 5 cordas, o grave real do app, ainda e lido');
}

console.log('\n-- o custo, porque isto roda a cada quadro --');
/* O detector antigo levava 4,9 ms por leitura: a 30 leituras por segundo eram
 * 147% de um nucleo. No iPhone isso esquenta o aparelho e o navegador corta o
 * AudioContext, o que aparece para a pessoa como "o afinador travou".
 *
 * O limite e 2,5 ms, e nao e um numero arbitrario: e onde 30 leituras por
 * segundo deixam de passar da metade de um nucleo. */
{
  const buf = sujar(corda(JANELA, 48000, 110), 999, 0.05);
  T.detectar(buf, 48000);   // aquece
  const REPS = 20;
  /* POR QUE ISSO ERA INSTAVEL, MEDIDO E NAO ADIVINHADO
   *
   * A versao anterior media uma unica rodada de 20 repeticoes, no fim de um
   * arquivo que ja rodou 124 assercoes. Em processo isolado o algoritmo leva
   * 1,6 ms de forma consistente; dentro da suite inteira ele subia para 5-6 ms
   * — nao porque o codigo ficou lento, mas porque o processo carrega lixo das
   * outras 124 e o coletor pode entrar no meio da janela medida.
   *
   * Medido em 12 rodadas de cada jeito (ver `mede-tuner`): cru, min=1,60 e
   * max=2,15; com aquecimento, min=1,60 e max=1,70. O limite de 2,5 ms estava
   * CORRETO — o que media era o barulho da casa.
   *
   * A correcao e' a do benchmark, e nao a do limite:
   *
   *   1. AQUECER antes: o JIT precisa compilar `detectar` antes de contar.
   *   2. MEDIR VARIAS VEZES e guardar o MINIMO. Ruido so ADICIONA tempo, entao
   *      o minimo de N rodadas e o estimador que sobra da interferencia — e ele
   *      continua sendo uma medida real do custo.
   *   3. O LIMITE CONTINUA 2,5 ms. Se o algoritmo regredir para 3 ms, o
   *      minimo tambem sera 3 ms e o teste reprova. Nenhum verde comprado.
   */
  for (let w = 0; w < 5; w++) T.detectar(buf, 48000);
  let ms = Infinity;
  for (let r = 0; r < 5; r++) {
    const t0 = Date.now();
    for (let i = 0; i < REPS; i++) T.detectar(buf, 48000);
    const rodada = (Date.now() - t0) / REPS;
    if (rodada < ms) ms = rodada;
  }
  ok(ms < 2.5, 'uma leitura leva ' + ms.toFixed(2) + ' ms (limite 2,5 ms)');
}

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
