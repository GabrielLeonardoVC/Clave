/* Teste da mesa de ensaio: o relogio, a mistura de volume e a ficha.

   O que mora aqui nao depende de microfone nem de rede, entao da para provar
   sem camera e sem video:

     - o relogio da sessao avanca, para, pula e avisa quem assina;
     - a mistura limita os volumes e repassa para o audio e para o player;
     - a ficha junta o que esta na escala com o que esta no repertorio;
     - a anotacao com hora sobrevive a backup, string solta e lixo.

   O ponto que mais importa no relogio e a inscricao: quem assina precisa poder
   sair. Um laco que continua rodando depois da tela fechar e o tipo de defeito
   que consome bateria e move a rolagem de uma tela que ninguem ve.

   Rodar: node tools/test-palco.js
*/
'use strict';

require('../js/core/utils.js');
require('../js/core/links.js');

const P = require('../js/core/palco.js');
require('../js/core/store.js');
const S = globalThis.Store;

/* O relogio usa `setTimeout` e `performance.now`, que precisam existir. A prova
   nao espera segundos reais: o `setTimeout` e substituido por uma fila que o
   teste drena, e o relogio do aparelho e um contador controlado. E o que
   permite provar o avanco do tempo sem gastar um minuto de parede. */
let agora = 0;
let fila = [];
globalThis.performance = { now: function () { return agora; } };
globalThis.setTimeout = function (f, ms) { fila.push({ f: f, ms: ms }); return fila.length; };
globalThis.clearTimeout = function () { fila = []; };
globalThis.requestAnimationFrame = function (f) { fila.push({ f: f, ms: 16 }); return fila.length; };
globalThis.cancelAnimationFrame = function () { fila = []; };

let pass = 0, fail = 0;
function eq(atual, esperado, rotulo) {
  const bom = atual === esperado;
  bom ? pass++ : fail++;
  console.log((bom ? '  ok    ' : '  FALHA ') + rotulo +
    (bom ? '' : '  -> obtido ' + JSON.stringify(atual) + ', esperado ' + JSON.stringify(esperado)));
}
function ok(cond, rotulo) { eq(!!cond, true, rotulo); }

/* Avanca o relogio falso e roda um passo pendente. */
function quadro(ms) {
  agora += ms;
  const p = fila.shift();
  if (p) p.f();
}

/* Corre `passos` de 100 ms, que e o intervalo real do relogio. */
function segundos(n) {
  for (let i = 0; i < n * 10; i++) quadro(100);
}

/* =========================================================
   1. O RELOGIO
   ========================================================= */
console.log('\n=== o relogio da mesa ===');

eq(P.tempo(0), '0:00', 'zero');
eq(P.tempo(9), '0:09', 'com um digito, com zero a esquerda');
eq(P.tempo(64), '1:04', 'um minuto');
eq(P.tempo(3600), '1:00:00', 'uma hora, com a hora a esquerda');
eq(P.tempo(-5), '0:00', 'tempo negativo nao vira relogio quebrado');
eq(P.tempo('lixo'), '0:00', 'texto no lugar do tempo nao quebra nada');
eq(P.tempo(3599), '59:59', 'o segundo anterior a hora');

/* ---- avanca, para, avanca de novo ---- */
const r = P.criarRelogio();
let vistos = [];
const cancelar = r.inscrever(function (pos, tocando) { vistos.push([pos, tocando]); });

r.iniciar();
eq(r.tocando, true, 'iniciar começa a correr');

quadro(1000);
ok(Math.abs(r.posicao - 1) < 0.01, 'um segundo depois, a posicao e 1: ' + r.posicao.toFixed(3));
quadro(500);
ok(Math.abs(r.posicao - 1.5) < 0.01, 'mais meio segundo: ' + r.posicao.toFixed(3));

r.pausar();
eq(r.tocando, false, 'pausar para');
const antes = r.posicao;
quadro(2000);
eq(r.posicao, antes, 'pausado, o tempo nao anda mesmo com quadro rodando');

r.irPara(90);
eq(r.posicao, 90, 'ir para um ponto');

/* Voltar a tocar depois de pausar continua de onde parou. Sem o
   `voltarAoZero: false`, "Continuar" recomeçaria a passagem do inicio — que e
   o defeito de um controle de pausa que nao pausa. */
r.iniciar(0, false);
quadro(1000);
ok(Math.abs(r.posicao - 91) < 0.01, 'depois de pausar e voltar, continua de onde foi: ' + r.posicao.toFixed(3));

/* E "Começar" do zero traz o relogio de volta ao comeco. */
r.pausar();
r.iniciar(0, true);
eq(r.posicao, 0, 'comecar de novo volta ao zero');

/* ---- a duracao trava no fim ----
   O laco corre um passo de 100 ms por chamada, e so avanca o tempo que passou
   entre os passos. Por isso o teste roda os passos ate chegar la. */
r.pausar();
r.iniciar(92, true);
eq(r.duracao, 92, 'a duracao informada foi guardada');
segundos(100);
eq(r.posicao, 92, 'passou da duracao, para nela: ' + r.posicao);
eq(r.tocando, false, 'e para de correr quando chega no fim');

/* ---- quem assina pode sair ---- */
vistos = [];
cancelar();
quadro(1000);
eq(vistos.length, 0, 'quem saiu nao e mais avisado: o laco nao roda para tela fechada');

r.pausar();

/* ---- callback que joga nao derruba o resto ---- */
const r2 = P.criarRelogio();
const avisos = [];
r2.inscrever(function () { throw new Error('erro de quem assina'); });
r2.inscrever(function (p) { avisos.push(p); });
r2.iniciar(0, true);
quadro(1000);
ok(avisos.length >= 1, 'um assinante que falha nao impede os outros de serem avisados');
r2.pausar();

/* ---- a duracao so e lida uma vez ----
   Se cada chamada aceitasse uma duracao nova, a mesa nunca pararia no fim: o
   app nao saberia a duracao da musica, mas receberia um numero a cada
   "comecar". */
const r3 = P.criarRelogio();
r3.iniciar(60, true);
r3.pausar();
r3.iniciar(5, true);
r3.iniciar();
quadro(100);
ok(r3.duracao === 60, 'a duracao ja conhecida nao e substituida por outra: ' + r3.duracao);
r3.pausar();

/* ---- a duracao que o video traz e o teto real ----
   O video so informa a propria duracao depois de responder, e e esse numero
   que faz a barra ter tamanho e a rolagem parar no fim da musica.

   O detalhe que importa: sem teto conhecido, o pulo por anotacao vai aonde a
   anotacao mandou. Com um teto curto e errado — o tamanho da cifra, digamos —
   o pulo seria cortado e a anotacao pareceria quebrada. */
const r5 = P.criarRelogio();
eq(r5.duracao, 0, 'sem informacao, o relogio nao tem teto');
r5.iniciar(0, true);
r5.irPara(600);
eq(r5.posicao, 600, 'sem teto, o pulo vai aonde a anotacao mandou, e nao e cortado');
r5.pausar();

eq(r5.informarDuracao(212), 212, 'a duracao informada vira o teto');
r5.irPara(300);
eq(r5.posicao, 212, 'agora o pulo para no fim real: ' + r5.posicao);
r5.iniciar(0, true);
segundos(220);
eq(r5.posicao, 212, 'e a corrida para nela tambem');
eq(r5.tocando, false, 'parando no fim');
r5.pausar();

/* Duracao invalida nao substitui a boa: o video devolve 0 enquanto carrega, e
   um 0 ali zeraria o teto, faria a barra sumir e a rolagem nunca parar. */
r5.informarDuracao(0);
eq(r5.duracao, 212, 'duracao zero nao apaga a que ja existia');
r5.informarDuracao(NaN);
eq(r5.duracao, 212, 'duracao invalida tambem nao');

/* ---- o tempo real manda, e nao o numero de passos ----
   Um passo fixo de 100 ms perderia tempo sempre que o aparelho demorar: num
   celular que roda a meio do ritmo, a rolagem andaria para a metade da
   velocidade. Aqui o passo roda atrasado de proposito, e a posicao tem de
   acompanhar o tempo de verdade. */
const r4 = P.criarRelogio();
r4.iniciar(0, true);
// tres passos, cada um 300 ms depois do anterior: 0,9 s de um jeito,
// 0,3 s se o passo fosse fixo em 100 ms.
for (let i = 0; i < 3; i++) quadro(300);
ok(Math.abs(r4.posicao - 0.9) < 0.02,
  'com passo atrasado, a posicao segue o tempo real: ' + r4.posicao.toFixed(3) + ' (fixo daria 0.3)');
r4.pausar();

/* =========================================================
   2. A MISTURA DE VOLUME
   ========================================================= */
console.log('\n=== os tres sons ao mesmo tempo ===');

let volPlayer = null;
let toquesPlayer = 0;
const playerFalso = {
  setVolume: function (v) { volPlayer = v; toquesPlayer++; },
};

const audioFalso = { volume: 1 };
const mix = P.criarMistura(audioFalso, playerFalso, { video: 100, voz: 100, metr: 60 });

eq(mix.definir('video', 50).video, 50, 'o volume do video muda');
eq(volPlayer, 50, 'e chega no player do YouTube');

eq(mix.definir('voz', 30).voz, 30, 'o volume da voz muda');
ok(Math.abs(audioFalso.volume - 0.3) < 0.001, 'e chega no audio: ' + audioFalso.volume.toFixed(2));

/* ---- limites ---- */
mix.definir('video', 500);
eq(mix.valores.video, 100, 'acima de 100 trava em 100');
mix.definir('video', -20);
eq(mix.valores.video, 0, 'abaixo de 0 trava em 0');

/* ---- o player entra depois, que e como acontece na tela ---- */
const mix2 = P.criarMistura(null, null, { video: 80 });
let volDepois = null;
mix2.definirPlayer({ setVolume: function (v) { volDepois = v; } });
eq(volDepois, 80, 'o player que chega depois recebe o volume ja configurado');

/* ---- trocar o audio: acontece ao regravar a narração ----
   Regravar a narração cria um `<audio>` novo. Se a mistura continuasse
   apontando para o antigo, o controle de volume mexeria num elemento que
   saiu da tela — e o ajuste nao teria efeito nenhum. */
const antigo = { volume: 1 };
const novo = { volume: 1 };
const mixTroca = P.criarMistura(antigo, null, { voz: 50 });
eq(antigo.volume, 0.5, 'antes da troca, o audio antigo e que e controlado');
mixTroca.definirAudio(novo);
eq(novo.volume, 0.5, 'depois, o volume ja vai para o novo');
mixTroca.definir('voz', 20);
eq(novo.volume, 0.2, 'e o ajuste seguinte mexe no novo, nao no antigo: ' + novo.volume.toFixed(2));
eq(antigo.volume, 0.5, 'o antigo parou de receber ajuste: ' + antigo.volume.toFixed(2));

/* ---- sem player, nada quebra ---- */
const mix3 = P.criarMistura(null, null, {});
mix3.definir('video', 10);
eq(mix3.valores.video, 10, 'sem player, o controle do video nao da erro');

/* =========================================================
   3. A FICHA: O QUE VEM DA ESCALA E O QUE VEM DO REPERTORIO
   ========================================================= */
console.log('\n=== a ficha junta as duas pontas ===');

S.db.cifras.length = 0;
S.db.escalas.length = 0;

const cifra = S.normCifra({
  titulo: 'Ovelha perdida', artista: 'Maria', tom: 'G', bpm: 120,
  letra: 'a letra',
  cifra: '[G]\nOvelha perdida\nG          C        G\n\nE no peito, mão no ar',
  yt: 'https://youtu.be/dQw4w9WgXcQ',
  vs: 'data:audio/webm;base64,AAAA',
  foto: 'data:image/png;base64,BBBB',
  anotacoes: [{ t: 32, texto: 'a bateria entra' }],
});
S.db.cifras.push(cifra);

const escala = S.normEscala({
  titulo: 'Missa de domingo',
  musicas: [{ nome: 'Ovelha perdida', cifraId: cifra.id, responsavel: 'Joao' }],
});
S.db.escalas.push(escala);

const f = S.fichaDe(escala.musicas[0], escala);
eq(f.titulo, 'Ovelha perdida', 'o titulo vem da musica da escala');
eq(f.tom, 'G', 'o tom vem da cifra quando a escala nao tem');
eq(f.bpm, 120, 'o andamento vem da cifra');
eq(f.ytId, 'dQw4w9WgXcQ', 'o video vem da cifra');
eq(f.vs, 'data:audio/webm;base64,AAAA', 'a narração vem da cifra');
eq(f.foto, 'data:image/png;base64,BBBB', 'a foto vem da cifra');
eq(f.anotacoes.length, 1, 'a anotação vem da cifra');
eq(f.anotacoes[0].texto, 'a bateria entra', 'com o texto certo');
eq(f.anotacoes[0].t, 32, 'com o tempo certo');
eq(f.responsavel, 'Joao', 'o responsavel vem da escala');
eq(f.escalaTitulo, 'Missa de domingo', 'e sabe de qual evento veio');
ok(f.temCifra, 'e sabe que tem cifra por tras');

/* ---- a escala tem prioridade ---- */
const e2 = S.normEscala({
  musicas: [{ nome: 'Outro nome', tom: 'C', bpm: 90, cifraId: cifra.id }],
});
const f2 = S.fichaDe(e2.musicas[0], e2);
eq(f2.tom, 'C', 'o tom que a escala escreveu vence o da cifra');
eq(f2.bpm, 90, 'o andamento da escala tambem');
eq(f2.ytId, 'dQw4w9WgXcQ', 'mas o video, que a escala deixou vazio, vem da cifra');

/* ---- sem nada, nao quebra ---- */
const f3 = S.fichaDe({ nome: 'So o nome' }, null);
eq(f3.titulo, 'So o nome', 'sem escala e sem cifra, devolve o que tem');
eq(f3.ytId, '', 'sem video, o campo fica vazio e nao indefinido');
eq(f3.anotacoes.length, 0, 'sem anotacoes, lista vazia');
ok(!f3.temCifra, 'e diz que nao tem cifra');

/* ---- o texto vem do lugar certo ----
   A cifra do repertorio e a letra dela. Sem isto, a mesa abria dizendo
   "esta musica ainda nao tem cifra vinculada" para uma musica que tinha
   texto, e a rolagem — que e a razao de a mesa existir — nao aparecia. */
const f4 = S.fichaDaCifra(S.cifras()[0]);
ok(f4.cifra.length > 0, 'a ficha da cifra traz o texto dela: ' + JSON.stringify(f4.cifra.slice(0, 24)));
eq(f4.letra, 'a letra', 'e a letra tambem');

/* Quem cadastra direto na escala, sem passar pelo repertorio, tem texto
   proprio — e ele nao pode se perder na leitura. */
const e3 = S.normEscala({ musicas: [{ nome: 'Direta', cifra: 'C  G', letra: 'sem repertorio' }] });
const f5 = S.fichaDe(e3.musicas[0], e3);
eq(f5.cifra, 'C  G', 'sem cifra ligada, o texto vem da propria musica da escala');
eq(f5.letra, 'sem repertorio', 'e a letra tambem');
ok(!f5.temCifra, 'e avisa que nao tem cifra do repertorio');

/* Quando tem as duas, a do repertorio e a que vale: e a que foi revisada. */
const e4 = S.normEscala({ musicas: [{ nome: 'Com as duas', cifra: 'texto solto', cifraId: S.cifras()[0].id }] });
eq(S.fichaDe(e4.musicas[0], e4).cifra, S.cifras()[0].cifra, 'com cifra ligada, vale a do repertorio');

/* =========================================================
   4. AS ANOTACOES COM HORA
   ========================================================= */
console.log('\n=== as anotacoes ===');

/* A forma antiga: uma lista de texto solto, sem tempo. */
const antigas = S.normAnotacoes(['a bateria entra', 'virada no refrão']);
eq(antigas.length, 2, 'a lista antiga de textos ainda vira anotacao');
eq(antigas[0].t, 0, 'e sem tempo ela fica no zero, que e onde estava');
ok(!!antigas[0].id, 'e ganha um id, para poder apagar depois');

/* Fora de ordem vira em ordem de tempo: e a lista que se le no ensaio. */
const fora = S.normAnotacoes([
  { t: 90, texto: 'final' },
  { t: 12, texto: 'intro' },
  { t: 45, texto: 'refrão' },
]);
eq(fora.map(function (a) { return a.t; }).join(','), '12,45,90', 'a lista sai em ordem de tempo');

/* Lixo nao vira anotacao. */
eq(S.normAnotacoes([{ t: 5, texto: '' }, { t: 5 }, null, undefined]).length, 0, 'anotação sem texto nao existe');
eq(S.normAnotacoes('nao e lista').length, 0, 'string no lugar de lista nao quebra nada');
eq(S.normAnotacoes(undefined).length, 0, 'ausente nao quebra nada');

/* Tempo fora de faixa e corrigido, nao recusado. A lista sai ordenada, entao
   o tempo negativo (0) vem antes do que trava em uma hora (3600). */
const fora2 = S.normAnotacoes([{ t: 99999, texto: 'x' }, { t: -50, texto: 'y' }]);
eq(fora2.length, 2, 'os dois tempos fora de faixa continuam na lista');
eq(fora2[0].t, 0, 'tempo negativo trava em zero');
eq(fora2[1].t, 3600, 'tempo acima de uma hora trava em uma hora');

/* =========================================================
   5. O QUE A NORMALIZACAO DEIXA PASSAR
   ========================================================= */
console.log('\n=== o que a ficha recusa ===');

/* Estes campos vem de um arquivo de backup, que e entrada nao confiavel. Um
   "javascript:" num `src` e execucao de codigo. */
eq(S.normCifra({ titulo: 'x', vs: 'javascript:alert(1)' }).vs, '', 'audio com javascript: e recusado');
eq(S.normCifra({ titulo: 'x', vs: 'https://exemplo.com/a.mp3' }).vs, '', 'audio remoto e recusado');
eq(S.normCifra({ titulo: 'x', vs: '<script>' }).vs, '', 'audio com html e recusado');
eq(S.normCifra({ titulo: 'x', foto: 'javascript:alert(1)' }).foto, '', 'foto com javascript: e recusada');
eq(S.normCifra({ titulo: 'x', yt: 'https://vimeo.com/12345' }).ytId, '', 'video que nao e do YouTube nao entra');

eq(S.normCifra({ titulo: 'x', vs: 'data:audio/webm;base64,QQ==' }).vs, 'data:audio/webm;base64,QQ==', 'audio valido passa');
eq(S.normCifra({ titulo: 'x', foto: 'data:image/png;base64,QQ==' }).foto, 'data:image/png;base64,QQ==', 'foto valida passa');

/* Uma cifra antiga, sem nenhum dos campos novos, ainda e uma cifra valida. */
const antiga = S.normCifra({ titulo: 'De antes', cifra: 'C  G' });
eq(antiga.ytId, '', 'cifra antiga sem video: campo vazio');
eq(antiga.anotacoes.length, 0, 'cifra antiga sem anotacoes: lista vazia');
eq(antiga.titulo, 'De antes', 'e o titulo continua la');

/* =========================================================
   6. O TEMPO COLADO COMO TEXTO
   ========================================================= */
console.log('\n=== o tempo colado na anotação ===');

/* A pessoa digita "1:32" no campo, nao "92 segundos". E o jeito que se escreve
   tempo, e o que aparece no relogio. */
const PV = require('../js/views/palco.js');
eq(PV.segundosDoTexto('1:32'), 92, 'mm:ss vira segundos');
eq(PV.segundosDoTexto('0:05'), 5, 'com zero a esquerda');
eq(PV.segundosDoTexto('92'), 92, 'so o numero, em segundos');
eq(PV.segundosDoTexto('1:00:00'), 3600, 'com hora');
eq(PV.segundosDoTexto(''), 0, 'vazio da zero');
eq(PV.segundosDoTexto('lixo'), 0, 'texto solto da zero');
eq(PV.segundosDoTexto('99:99'), 3600, 'fora de faixa trava em uma hora');

/* ========================================================= */
console.log('');
console.log('=================================================');
console.log(fail
  ? fail + ' falharam, ' + pass + ' passaram.'
  : '  ' + pass + ' passaram, 0 falharam');
console.log('');
process.exit(fail ? 1 : 0);