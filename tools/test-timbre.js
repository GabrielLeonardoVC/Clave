/* =========================================================
   tools/test-timbre.js
   O que separa um violao de um ukulele esta na matematica.

   POR QUE UM TESTE E NAO SO OUVIR

   `Timbre.espectro()` e pura: entra frequencia e traste, saem numeros. Nao
   precisa de AudioContext, nem de navegador, nem de ouvido humano. Isso e o que
   torna possivel PROVAR que o timbre esta certo — e prova e a unica forma de
   saber que um par de valores nao foi escolhido no gosto.

   O que nao da para provar aqui, e vale dizer: que soa bonito. Isso exige o
   ouvido de um musico e um alto-falante. O que este arquivo garante e que as
   propriedades que os separam nao se perderam.

   A REGRA DO PROJETO: um verificador que nunca falha e ignorado. Cada
   propriedade aqui foi provada mudando o codigo — `tools/provar-timbre.js`.
   ========================================================= */
'use strict';

const path = require('path');
const T = require(path.join(__dirname, '..', 'js', 'core', 'timbre.js'));

let passou = 0;
let falhou = 0;
function ok(cond, nome, detalhe) {
  if (cond) { passou++; console.log('  ok    ' + nome + (detalhe ? '  (' + detalhe + ')' : '')); }
  else { falhou++; console.log('  FALHA ' + nome + (detalhe ? '  (' + detalhe + ')' : '')); }
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }

const Hz = 220;   // La3: uma nota no meio de todas as cordas

/* ------------------------------------------------------------------ */
secao('1. Todo instrumento tem espectro, e ele tem forma de serie');

const IDS = T.ids();
ok(IDS.length >= 6, 'existem ' + IDS.length + ' timbres: ' + IDS.join(', '));

for (const id of IDS) {
  const e = T.espectro(Hz, id);
  ok(e.length > 0, id + ': tem parciales', e.length + ' parciais');
  ok(e[0] && Math.abs(e[0].hz - Hz) < 0.001, id + ': o primeiro parcial e a fundamental');
  // Os parciais tem de ser multiplos inteiros da fundamental. Um erro aqui
  // seria um parcial na frequencia errada — e o app soaria desafinado sem
  // nenhum sinal de erro.
  let multiplos = true;
  for (const p of e) {
    const m = p.hz / Hz;
    if (Math.abs(m - Math.round(m)) > 0.01) multiplos = false;
  }
  ok(multiplos, id + ': todo parcial e um multiplo inteiro da fundamental');
  // E decrescente: um parcial mais alto que o anterior e um modelo errado.
  let decrescente = true;
  for (let i = 1; i < e.length; i++) if (e[i].amp > e[i - 1].amp * 1.001) decrescente = false;
  ok(decrescente, id + ': as amplitudes caem com o numero do harmonico');
  // Somadas, valem 1. E o que garante que o volume pedido e o volume total,
  // e nao "o volume pedido vezes o numero de parciais".
  const soma = e.reduce((a, p) => a + p.amp, 0);
  ok(Math.abs(soma - 1) < 0.001, id + ': as amplitudes somam 1', soma.toFixed(4));
}

/* ------------------------------------------------------------------ */
secao('2. O parcial mais alto e o que MORRE primeiro');

/* Esta e a propriedade que mais denuncia um som sintetico. Uma corda pinçada
 * perde o brilho antes de perder o tom: o sexto harmonico some no primeiro
 * segundo e a fundamental ainda esta la depois de dez.
 *
 * Um sintetizador com envelope igual para todos os parciais tem o som "parado
 * no tempo", e o ouvido le isso como eletronico antes de qualquer nome. */
for (const id of IDS) {
  /* O `sintetizador` fica de fora: parciais de duracao igual sao a DEFINICAO
   * dele, nao um defeito. Para os outros, a ordem tem que ser estritamente
   * decrescente.
   *
   * A primeira versao desta verificacao aceitava duracoes IGUAIS, porque so
   * rejeitava um `tau` que CRESCESSE. E o defeito real e justamente a igualdade:
   * um envelope igual para todos os parciais produz o som "parado no tempo", que
   * o ouvido le como eletronico antes de qualquer nome. Uma verificacao que
   * aceitava igualdade passava com o defeito instalado. */
  if (id === 'sintetizador') continue;
  const e = T.espectro(Hz, id);
  let okDec = true;
  for (let i = 1; i < e.length; i++) if (e[i].tau >= e[i - 1].tau * 0.999) okDec = false;
  ok(okDec, id + ': cada parcial dura menos que o anterior',
    e.map((p) => p.tau.toFixed(2)).join(' > ').slice(0, 70));

  /* E nao basta crescer: o brilho tem que SUMIR de verdade. O sexto harmonico
   * nao se ouve nem depois de um segundo, e a fundamental ainda esta la depois
   * de dez. */
  const e0 = e[0].tau;
  const eN = e[e.length - 1].tau;
  ok(eN < e0 * 0.5, id + ': o parcial mais alto dura bem menos que a fundamental',
    eN.toFixed(2) + ' s contra ' + e0.toFixed(2) + ' s');
}

/* Um sintetizador de pad e a excecao que confirma a regra: os parcis dele
 * duram IGUAIS, e nao e falha do modelo — e o que define o instrumento. */
{
  const pad = T.espectro(Hz, 'sintetizador');
  const iguais = pad.every((p) => Math.abs(p.tau - pad[0].tau) < 0.0001);
  ok(iguais, 'o sintetizador tem parciais de duracao igual, e e de proposito');
}

/* ------------------------------------------------------------------ */
secao('3. Cada instrumento e diferente do outro');

// Distancia entre os espectros. Se dois instrumentos tivessem o mesmo
// espectro, seriam o mesmo instrumento com nomes diferentes.
{
  const a = T.espectro(Hz, 'violao').map((p) => p.amp);
  const b = T.espectro(Hz, 'baixo').map((p) => p.amp);
  let dif = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    dif += Math.abs((a[i] || 0) - (b[i] || 0));
  }
  /* O limite e 0,20 de um maximo possivel de 2,0. A referencia e o proprio
   * app: dois espectros identicos dariam 0,00. Um quarto da escala ja e
   * nitidamente outro timbre — e o que importa e nao haver duvida entre eles. */
  ok(dif > 0.20, 'violao e baixo sao bem diferentes no espectro', 'distancia ' + dif.toFixed(2));

  const u = T.espectro(Hz, 'ukulele').map((p) => p.amp);
  const v = T.espectro(Hz, 'violao').map((p) => p.amp);
  let dif2 = 0;
  for (let i = 0; i < Math.max(u.length, v.length); i++) {
    dif2 += Math.abs((u[i] || 0) - (v[i] || 0));
  }
  /* Ukulele e violao tem series de amplitude parecidas em 220 Hz. O que os
   * separa de verdade sao DUAS outras coisas, e e nelas que a diferenca mora:
   * a duracao (o ukulele morre em metade do tempo) e a caixa (o pico do corpo
   * dele e mais alto, entao o grave pesa menos).
   *
   * A primeira versao deste teste media a distancia de amplitude e achava 0,09
   * — e quase acusou o codigo de errado por medir a coisa errada. */
  const tauV = T.espectro(Hz, 'violao')[0].tau;
  const tauU = T.espectro(Hz, 'ukulele')[0].tau;
  ok(tauU < tauV * 0.6, 'o ukulele morre bem antes do violao',
    tauU.toFixed(2) + ' s contra ' + tauV.toFixed(2) + ' s');

  // O ukulele tem o corpo mais alto, entao os parciais baixos sao mais
  // penalizedos nele do que no violao. E a diferenca que da a sensacao de
  // "instrumento pequeno".
  const baixoU = T.espectro(110, 'ukulele')[0].amp;
  const baixoV = T.espectro(110, 'violao')[0].amp;
  ok(baixoU < baixoV, 'no ukulele o parcial grave pesa menos que no violao',
    baixoU.toFixed(3) + ' contra ' + baixoV.toFixed(3));

  /* O CORPO PRECISA MUDAR ALGUMA COISA, E MUDAR NO LUGAR CERTO.
   *
   * A verificacao acima e fraca, e o provador mostrou por que: com as ressonancias
   * do violao desligadas o grave dele cai de 0,444 para 0,357 — mas o ukulele
   * esta em 0,309, entao a ordem se mantinha e o teste passava com o corpo todo
   * desligado.
   *
   * A assinatura fisica do corpo e outra, e e mais forte: o parcial que cai
   * SOBRE o pico ganha forca, entao o FUNDAMENTAL passa a pesar mais e o terceiro
   * parcial pesa menos. Medido no violao (pico em 96 Hz), a razao terceiro sobre
   * primeiro e 0,256 em 96 Hz, contra 0,595 em 48 Hz e 0,545 em 64 Hz.
   *
   * Testar no pico DECLARADO de cada instrumento e o que impede o corpo de virar
   * decoracao: se `ressonancias: [[96, ...]]` e [[168, ...]] se comportassem
   * igual, os instrumentos seriam o mesmo instrumento com nomes diferentes. */
  const RAZAO_MINIMA = 0.6;   // sobre o pico, o 3o parcial pesa bem menos
  for (const id of ['violao', 'ukulele', 'baixo']) {
    /* Antes de medir, o corpo tem de EXISTIR. A primeira versao lia
     * `ressonancias[0][0]` direto e, com a ressonancia desligada, o teste
     * inteiro quebrava com TypeError.
     *
     * E o pior jeito de um verificador quebrar: o erro sai pelo `stderr`, o
     * provador le o `stdout`, nao acha a palavra FALHA e conclui que o teste
     * passou com o defeito instalado. O defeito estava la e o teste ate gritou
     * — o provador so nao ouviu. */
    const ressonancias = T.MODELOS[id].ressonancias;
    ok(Array.isArray(ressonancias) && ressonancias.length > 0,
      id + ': declara a caixa de ressonancia, sem a qual e so uma corda',
      ressonancias && ressonancias.length ? JSON.stringify(ressonancias[0]) : 'nenhuma');
    if (!Array.isArray(ressonancias) || !ressonancias.length) continue;

    const ressonancia = ressonancias[0][0];
    const sobreOPico = T.espectro(ressonancia, id);
    /* A referencia e meia oitava ABAIXO do pico, e nao logo acima. Medindo
     * acima, a diferenca fica pequena demais para um limite honesto: o violao
     * daria 0,256 contra 0,344, uma razao de 0,74 — e qualquer limiar entre
     * 0,6 e 0,74 seria escolhido para caber na medida, e nao por fisica.
     *
     * Meia oitava abaixo, os tres instrumentos dao a mesma coisa: violao 0,43,
     * ukulele 0,41, baixo 0,44. E o numero que o limite de 0,6 representa. */
    const abaixo = T.espectro(ressonancia / 2, id);
    if (sobreOPico.length < 3 || abaixo.length < 3) {
      ok(false, id + ': o pico do corpo fica audivel no espectro', 'espectro curto demais');
      continue;
    }
    const razaoPico = sobreOPico[2].amp / sobreOPico[0].amp;
    const razaoFora = abaixo[2].amp / abaixo[0].amp;
    ok(razaoPico < razaoFora * RAZAO_MINIMA,
      id + ': em ' + ressonancia + ' Hz o fundamental pesa mais, porque e o pico do corpo',
      razaoPico.toFixed(3) + ' no pico contra ' + razaoFora.toFixed(3) + ' meia oitava abaixo');
  }
}

/* ------------------------------------------------------------------ */
secao('4. O traste muda o timbre, e so os parciais de cima');

/* Corda mais curta e mais rigida: o parcial mais alto ganha e a corda morre
 * antes. E por isso que a mesma nota no traste 12 nao soa como no traste 2.
 *
 * E o quinto nao muda: mudar o brilho do segundo harmonico mudaria a quinta,
 * e a quinta nao muda de timbre quando voce encurta a corda. Por isso o
 * expoente cresce com o numero do parcial. */
{
  const aberto = T.espectro(Hz, 'violao', { traste: 0 });
  const fechado = T.espectro(Hz, 'violao', { traste: 20 });

  /* O QUE MEDE O BRILHO E A RAZAO ENTRE PARCIAIS, e nao a amplitude de um
   * deles. E o motivo e fisico: a energia total da corda nao muda quando voce
   * encurta, ela se desloca para cima. Entao o parcial absoluto pode ate
   * baixar um pouco, e mesmo assim o som ficar nitidamente mais claro.
   *
   * A primeira versao media a amplitude do terceiro parcial isolada, e via
   * 1,05 vezes — quase nada. Nao era erro do modelo: era a medida errada, e a
   * normalizacao (que existe para o volume nao depender do numero de
   * parciais) estava comendo o ganho. E o brilho da corda curta tem de ser
   * audivel, entao o modelo tambem foi reforcado. */
  const brilhoAberto = aberto[2].amp / aberto[1].amp;
  const brilhoFechado = fechado[2].amp / fechado[1].amp;
  ok(brilhoFechado > brilhoAberto * 1.25, 'no traste 22 o som e nitidamente mais claro',
    brilhoAberto.toFixed(3) + ' -> ' + brilhoFechado.toFixed(3) + ' no terceiro sobre o segundo');

  ok(fechado[2].tau < aberto[2].tau, 'e a corda curta morre antes',
    fechado[2].tau.toFixed(2) + ' contra ' + aberto[2].tau.toFixed(2) + ' segundos');

  // Traste fora da escala nao pode explodir nem inverter.
  const absurdo = T.espectro(Hz, 'violao', { traste: 900 });
  ok(absurdo.length > 0 && absurdo.every((p) => p.amp >= 0 && isFinite(p.amp)),
    'traste absurdo nao quebra o espectro');
}

/* ------------------------------------------------------------------ */
secao('5. As entradas erradas viram silencio, nao ruido');

for (const ruim of [0, -1, NaN, Infinity, -Infinity, 'abc', null, undefined, {}]) {
  const e = T.espectro(ruim, 'violao');
  ok(e.length === 0, 'frequencia ' + JSON.stringify(ruim) + ' devolve lista vazia');
}
ok(T.espectro(Hz, 'instrumento-que-nao-existe').length > 0,
  'instrumento desconhecido cai no violao em vez de quebrar');
ok(T.espectro(Hz, null).length > 0, 'sem instrumento tambem cai no violao');

/* ------------------------------------------------------------------ */
secao('6. O_orcamento de vozes, que e o que segura o iPhone');

/* Um acorde de seis notas com dez parciais sao sessenta osciladores ao mesmo
 * tempo. Num celular isso nao e um acorde: e o app engasgando no meio do
 * ensaio. A regra e degradar o timbre em vez de travar o tempo. */
{
  const sozinho = T.parciaisPorVoz(1);
  const trio = T.parciaisPorVoz(3);
  const sexteto = T.parciaisPorVoz(6);
  ok(sozinho > sexteto, 'sozinho tem mais parciais que sexteto',
    sozinho + ' contra ' + sexteto);
  /* Monotonico NAO BASTA. A mutacao que este teste precisa pegar trocava
   * `parciaisPorVoz(3)` de 6 para 10 — a funcao continuava monotonica
   * (10, 10, 4...), e passava. Mas tres notas tocando sao tres vezes mais
   * oscilador que uma: e exatamente o caso que o limite existe para evitar.
   *
   * Por isso o teste exige que o peso caia de verdade, e logo na segunda voz. */
  const duasVozes = T.parciaisPorVoz(2);
  ok(duasVozes < sozinho,
    'ja com DUAS vozes a nota fica mais leve',
    sozinho + ' -> ' + duasVozes);
  ok(trio <= sozinho * 0.7,
    'e com TRES vozes ela perde pelo menos um terco do peso',
    Math.round((1 - trio / sozinho) * 100) + '% mais leve');
  ok(sexteto <= 5, 'seis vozes nao passam de cinco parciais por nota',
    String(sexteto));
  ok(T.parciaisPorVoz(20) <= 3, 'e vinte vozes nao passam de tres',
    String(T.parciaisPorVoz(20)));
  ok(trio >= sexteto, 'e a degrade e monotonica',
    [1, 3, 6, 10, 20].map((v) => v + '->' + T.parciaisPorVoz(v)).join(' '));

  let cresce = false;
  let anterior = 99;
  for (const v of [1, 2, 3, 4, 5, 6, 8, 10, 14, 20, 40]) {
    const n = T.parciaisPorVoz(v);
    if (n > anterior) cresce = true;
    anterior = n;
  }
  ok(!cresce, 'nenhuma quantidade de vozes aumenta o numero de parciais');
}

/* ------------------------------------------------------------------ */
secao('7. O custo, porque isto roda nota por nota');

/* O espectro e calculavel uma vez e guardado, mas o `espectro` pode ser
 * chamado a cada nota. A conta precisa ser barata. */
{
  const t0 = Date.now();
  const REPS = 20000;
  for (let i = 0; i < REPS; i++) T.espectro(220 + (i % 400), 'violao', { traste: i % 22 });
  const us = ((Date.now() - t0) / REPS) * 1000;
  ok(us < 200, 'um espectro custa ' + us.toFixed(1) + ' microssegundos (limite 200)');
}

/* ------------------------------------------------------------------ */
console.log('\n' + '='.repeat(50));
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
console.log('='.repeat(50) + '\n');
process.exit(falhou ? 1 : 0);
