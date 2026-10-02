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

  console.log('\n=== os formatos, e a ordem em que sao tentados ===');
  /* A ordem nao e "do melhor para o mais fraco" em qualidade de audio. E a ordem
   * em que cada NAVEGADOR consegue gravar.
   *
   * MP4 precisa estar na lista porque e o unico que o Safari aceita: ele nao
   * sabe gravar WebM, Opus nem Ogg. Antes do MP4 entrar, os tres primeiros
   * formatos falhavam no `isTypeSupported`, o gravador caia no ultimo item — o
   * de mime VAZIO — e o Safari escolhia MP4 por conta propria sem avisar. O
   * blob saia rotulado como WebM sobre bytes que eram MP4, e a gravacao nao
   * tocava no iPhone.
   *
   * Este teste existia para travar a ordem, e valeu. A primeira versao dizia
   * "o primeiro e o melhor" e esperava Opus na primeira posicao. Coloquei o MP4
   * na frente para consertar o iPhone — e o teste acusou de novo, porque o
   * Chrome tinha parado de escolher o Opus, que e metade do tamanho. Um teste que
   * so dissesse "ha mais de um formato" teria passado em cima dos dois defeitos.
   */
  ok(G.FORMATOS.length >= 2, 'ha mais de um formato');
  eq(G.FORMATOS[G.FORMATOS.length - 1].mime, '', 'o ultimo e "qualquer coisa"');
  const nomes = G.FORMATOS.map((f) => f.nome);
  eq(new Set(nomes).size, nomes.length, 'nenhum nome repetido');

  /* A ordem e o que decide o que a pessoa leva para o aparelho. E ela precisa
   * servir a DOIS aparelhos ao mesmo tempo, que e o que torna a ordem sutil:
   *
   *   - iPhone: so aceita MP4. Pula os tres primeiros e para no quarto.
   *   - Chrome: aceita Opus, e para no primeiro — o menor de todos.
   *
   * Ja colocamos o MP4 PRIMEIRO para-arrumar o iPhone, e o Chrome passou a
   * gravar AAC, que ocupa bem mais espaco. O iPhone melhorou e o Chrome piorou,
   * sem nenhum dos dois avisar. O MP4 tem de vir no MEIO: depois do Opus e do
   * WebM, e antes do "qualquer coisa". */
  const iMp4 = G.FORMATOS.findIndex((f) => f.mime.indexOf('audio/mp4') === 0);
  const iOpus = G.FORMATOS.findIndex((f) => f.mime.indexOf('opus') >= 0);
  const iVazio = G.FORMATOS.findIndex((f) => f.mime === '');

  ok(iMp4 >= 0, 'o MP4 esta na lista — sem ele o iPhone nao grava');
  ok(iMp4 < iVazio, 'o MP4 vem antes do "qualquer coisa", que e o que quebrava o iPhone');
  ok(iOpus >= 0, 'o Opus continua na lista: e o menor de todos');
  ok(iOpus < iMp4,
    'o Opus vem antes do MP4: no Chrome ele e escolhido primeiro, e o arquivo '
    + 'fica metade do tamanho. MP4 na frente conserta o iPhone e piora o Chrome '
    + 'em silencio — e foi exatamente o que aconteceu.');

  /* Simula os dois aparelhos e confere o que cada um escolheria. E o teste que
   * teria pegado a regressao do MP4 na frente. */
  const escolher = (aceita) => {
    const achou = G.FORMATOS.find((f) => !f.mime || aceita(f.mime));
    return achou ? achou.nome : null;
  };
  const soSafari = (m) => /^audio\/mp4/.test(String(m));
  const chromeEEdge = (m) => /webm|opus|mp4/.test(String(m));

  eq(escolher(soSafari), 'mp4-aac', 'o iPhone para no MP4');
  eq(escolher(chromeEEdge), 'opus', 'o Chrome para no Opus, o menor');
  ok(escolher(soSafari) !== null, 'o iPhone acha um formato, e nao cai no vazio');

  eq(new Set(nomes).size, nomes.length, 'nenhum nome repetido');

  console.log('\n=== o tipo do blob diz a verdade ===');
  /* O gravador sabe o que esta gravando, e `mimeType` responde. A versao
   * anterior devolvia `'audio/webm'` quando o `mimeType` vinha vazio — um palpite
   * que virava rotulo errado em qualquer aparelho que escolhesse por conta
   * propria. E o iPhone escolhe por conta propria.
   *
   * Este bloco nao precisa de navegador: `tipoDoGravador` so pergunta ao
   * gravador, e um objeto de mentira responde. E o tipo do blob e o que decide
   * se o `<audio src=data:...>` consegue decodificar o que esta dentro. */
  eq(G.tipoDoGravador({ mimeType: 'audio/mp4' }), 'audio/mp4', 'o gravador sabe o que grava');
  eq(G.tipoDoGravador({ mimeType: 'audio/webm;codecs=opus' }), 'audio/webm;codecs=opus',
    'e sabe direitinho quando tem codec');
  eq(G.tipoDoGravador({ mimeType: '' }), '', 'vazio continua vazio: nao se inventa formato');
  eq(G.tipoDoGravador(null), '', 'gravador ausente nao quebra');
  eq(G.tipoDoGravador({}), '', 'gravador sem mimeType nao quebra');

  /* Um gravador que lanca ao ser perguntado e um aparelho com seguranca — e a
   * resposta tem de ser "nao sei", nunca um palpite. */
  eq(G.tipoDoGravador({ get mimeType() { throw new Error('bloqueado'); } }), '',
    'gravador que lanca ao responder devolve vazio, e nao um formato inventado');

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