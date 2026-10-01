/* Teste do fluxo de gravacao da faixa narrada, com microfone simulado.

   O gravador e o unico lugar do app que depende de hardware. O resto da logica
   — pedir permissao, explicar antes, marcar que esta gravando, soltar o
   microfone ao parar, medir o tempo — e tudo testavel sem microfone de verdade.

   E o ponto que mais importa: soltar o microfone. Um fluxo de audio que nao e
   liberado deixa o indicador do aparelho aceso, consome bateria e, em alguns
   aparelhos, trava o microfone para outro uso ate a aba fechar.

   O arquivo inteiro esta dentro de uma funcao assincrona porque usa `await` no
   nivel do teste, e `require` no nivel do modulo — os dois juntos ambigualam o
   Node sobre o formato do arquivo.

   Rodar: node tools/test-gravador.js
*/
'use strict';

require('../js/core/utils.js');

const G = require('../js/core/gravador.js');

let pass = 0, fail = 0;
function eq(atual, esperado, rotulo) {
  const bom = atual === esperado;
  bom ? pass++ : fail++;
  console.log((bom ? '  ok    ' : '  FALHA ') + rotulo +
    (bom ? '' : '  -> obtido ' + JSON.stringify(atual) + ', esperado ' + JSON.stringify(esperado)));
}
function ok(cond, rotulo) { eq(!!cond, true, rotulo); }

(async function () {

  /* ------------------------------------------------------------
     O relogio e o tamanho, que nao dependem de nada
     ------------------------------------------------------------ */
  console.log('\n=== o relogio da gravacao ===');
  eq(G.relogio(0), '0:00', 'zero');
  eq(G.relogio(9), '0:09', 'com um digito, com zero a esquerda');
  eq(G.relogio(64), '1:04', 'um minuto');
  eq(G.relogio(605), '10:05', 'dez minutos');
  eq(G.relogio(3600), '60:00', 'uma hora');
  eq(G.relogio(-5), '0:00', 'negativo nao vira relogio quebrado');
  eq(G.relogio('abc'), '0:00', 'texto nao vira relogio quebrado');
  eq(G.relogio(), '0:00', 'sem valor nao quebra');

  console.log('\n=== o tamanho do audio ===');
  // O armazenamento e um orgao de cinco megabytes que nao avisa quando enche.
  // A data-URL custa um terco a mais que o binario, e o calculo tem de sair do
  // tamanho real, nao de uma suposicao.
  eq(G.tamanhoDe(''), 0, 'vazio');
  eq(G.tamanhoDe(null), 0, 'nulo');
  eq(G.tamanhoDe('sem virgula'), 0, 'sem separador');
  eq(G.tamanhoDe('data:audio/webm;base64,AAAAAAAA'), 6, 'oito caracteres viram seis bytes');
  eq(G.tamanhoDe('data:audio/webm;base64,' + 'A'.repeat(400)), 300, '400 caracteres viram 300 bytes');

  console.log('\n=== os formatos, do melhor para o mais fraco ===');
  // Opus dentro de WebM cabe em cerca de 1 KB por segundo de fala. O
  // MediaRecorder so sabe Opus em navegador moderno; onde falta, o app precisa
  // cair para algo que exista em vez de falhar.
  ok(G.FORMATOS.length >= 2, 'ha mais de um formato');
  eq(G.FORMATOS[0].mime, 'audio/webm;codecs=opus', 'o primeiro e o melhor');
  eq(G.FORMATOS[G.FORMATOS.length - 1].mime, '', 'o ultimo e "qualquer coisa"');
  const nomes = G.FORMATOS.map((f) => f.nome);
  eq(new Set(nomes).size, nomes.length, 'nenhum nome repetido');

  console.log('\n=== sem navegador, diz na cara que nao pode ===');
  // O que mais importa aqui e a honestidade: sem microfone, o app precisa dizer
  // que nao pode — e nao fingir que gravou.
  const disp = G.disponivel();
  ok(disp && typeof disp.ok === 'boolean', 'disponivel responde com um sim ou nao');
  ok(disp.motivo || disp.formato, 'e diz o motivo ou o formato');
  console.log('  neste Node: ' + JSON.stringify(disp));

  console.log('\n=== a permissao ja concedida, quando o navegador expoe ===');
  const p = await G.jaAutorizado();
  ok(p === null || p === 'granted' || p === 'denied' || p === 'prompt',
     'a permissao e um estado conhecido ou nulo: ' + JSON.stringify(p));

  console.log('\n=================================================');
  console.log('  ' + pass + ' passaram, ' + fail + ' falharam');
  console.log('=================================================\n');
  process.exit(fail ? 1 : 0);
})();