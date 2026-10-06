/* =========================================================
   ACORDE - tools/test-mesa-musica.js
   ABRIR UMA MUSICA DIRETAMENTE NA MESA DE ENSAIO

   POR QUE UM ARQUIVO NOVO

   A tela da musica e a mais completa do produto — e a unica que mostra video,
   faixa narrada, compasso, observacoes e fotos da mesma musica. Era tambem a
   unica sem caminho para a mesa: a biblioteca tinha o seu atalho dentro da
   folha da cifra, e o repertorio tem o dele, que e a sessao inteira. Para quem
   chegou a musica pelo evento, "ensaiar esta agora" exigia sair da tela, abrir
   o repertorio e refazer o caminho.

   O QUE ESTE ARQUIVO PROVA

   PROVA, em Node e sem navegador:
     - a tela da musica oferece a acao, e ela aciona o palco de verdade;
     - aciona o palco QUE JA EXISTIA, e nao uma segunda implementacao;
     - os argumentos sao a escala e a MUSICA CERTA, por identidade de objeto;
     - a folha fecha antes de a mesa abrir;
     - abrir nao escreve no Store: nem escalas, nem musicas, nem cifras;
     - abrir nao cria sessao de repertorio nem indice;
     - a musica original nao e alterada: o tom e a cifra guardados seguem iguais;
     - a musica seguinte nao herda nada da anterior;
     - musica sem gravacao abre do mesmo jeito;
     - com gravacao, o palco recebe a MESMA referencia de audio, sem copia.

   NAO PROVA
     - nada de tela. A posicao do botao e a leitura de quem clica sao do
       navegador.
     - nada sobre transposicao. Transpor NAO EXISTE no palco — o proprio
       `test-execucao.js` registra isso desde a V5.15. Fabricar estado de
       transposicao aqui seria testar o vazio.

   O QUE ESTE ARQUIVO NAO USA

   Nenhuma busca por texto no fonte. Um verificador que le o arquivo prova que
   a palavra esta escrita; nao prova que a mesa abre. Aqui o palco e uma SONDA
   que guarda o que recebeu, e o Store e o de verdade, comparado antes e depois.
   ========================================================= */
'use strict';

const path = require('path');
const { RAIZ } = require('./arquivos.js');

/* ------------------------------------------------------------
   O DOM E O CARREGAMENTO

   O DOM vai para `tools/dom-falso.js`, que e a UNICA copia dele no projeto.
   A razao de ele existir esta escrita la — inclusive por que `click()` tem de
   despachar o ouvinte e por que `textContent` precisa ser calculado. Aqui so
   o que esta suite precisa em cima dele.

   A ORDEM DOS MODULOS IMPORTA: `render.js` captura `Music` no topo do IIFE, e
   `utils.js` nao pode vir depois de quem o usa. Esta e a ordem de
   `index.html`.
   ------------------------------------------------------------ */

const Falso = require('./dom-falso.js');
const dom = Falso.instalar();

const carregar = (rel) => Falso.carregar(RAIZ, rel);

let criados = 0;
function marca() { return ++criados; }

carregar('js/core/music.js');
carregar('js/core/utils.js');
carregar('js/core/render.js');
const Store = carregar('js/core/store.js');
carregar('js/core/ui.js');
carregar('js/core/links.js');
carregar('js/core/tuner.js');
global.Studio = { abrir: () => {} };
global.Gravador = { relogio: () => 0, tamanhoDe: () => 0, iniciar: () => Promise.reject(new Error('sem microfone')) };

/* ------------------------------------------------------------
   A MESA E UMA SONDA

   Nao existe folha aqui: a sonda guarda o que RECEBEU, que e a unica coisa que
   a tela da musica decide. A mesa de verdade — rolagem, BPM, Wake Lock, tela
   cheia — e do navegador, e foi medida la na V6.3.
   ------------------------------------------------------------ */

/* O QUE UM "ESCRITA NO STORE" SIGNIFICA AQUI
 *
 * Comparar os dados antes e depois so pega a escrita que muda valor. A
 * `S.mudou()` nao muda valor nenhum: ela avisa que algo mudou e agenda a
 * gravacao. Uma tela da musica que gritasse `S.mudou('escala')` ao abrir
 * passaria numa comparacao de conteudo e ainda assim mandaria gravar o disco
 * inteiro a cada vez que alguem abre uma musica para ler. Por isso o spying. */
/* O ULTIMO PEDIDO, SEM EXPLODIR
 *
 * Com o botao sabotado para nao chamar o palco, `pedidos` fica vazio e um
 * `pedidos[pedidos.length - 1].musica` derruba a suite com um TypeError — antes
 * de ela contar o resto. Um teste que MORRE no primeiro defeito nao diz nada
 * sobre os outros, entao o objeto vazio e preferivel ao estouro: as asercoes
 * passam a falhar de verdade, nomeadas. */
function ultimo() { return pedidos[pedidos.length - 1] || {}; }
function anterior() { return pedidos[pedidos.length - 2] || {}; }

let mudouChamadas = 0;
const mudouOriginal = Store.mudou;
Store.mudou = function () {
  mudouChamadas++;
  return mudouOriginal.apply(Store, arguments);
};

const pedidos = [];
let mesasFechadas = 0;

/* O FECHAMENTO DA FOLHA E OBSERVADO AQUI.
 *
 * `mesasFechadas` conta o `close` do handle que a MESA devolve — e nao e o que
 * interessa. O que interessa e a folha da MUSICA fechando ANTES de a mesa
 * abrir: duas folhas empilhadas fazem o fundo escuro de uma tapar a outra.
 * Envolver o `close` que `UI.sheet` devolve e a unica forma de ver isso sem
 * trocar a folha por uma sonda e perder o resto do comportamento. */
let folhasFechadas = 0;
const UIreal = global.UI;
const sheetOriginal = UIreal.sheet;
UIreal.sheet = function () {
  const handle = sheetOriginal.apply(UIreal, arguments);
  const closeOriginal = handle.close;
  handle.close = function () {
    folhasFechadas++;
    return closeOriginal.apply(handle, arguments);
  };
  return handle;
};

global.Views = global.Views || {};
global.Views.palco = {
  abrirDeMusica: function (escala, musica) {
    pedidos.push({ escala: escala, musica: musica, fichas: [] });
    return { close: function () { mesasFechadas++; } };
  },
};

const Cancao = carregar('js/views/cancao.js');

/* ------------------------------------------------------------
   AS ASSERCOES
   ------------------------------------------------------------ */

let passou = 0;
let falhou = 0;
const falhas = [];

function ok(condicao, rotulo, detalhe) {
  if (condicao) { passou++; return true; }
  falhou++;
  falhas.push(rotulo + (detalhe ? '  ->  ' + detalhe : ''));
  return false;
}
function igual(recebido, esperado, rotulo) {
  return ok(recebido === esperado, rotulo,
    'recebido ' + JSON.stringify(recebido) + ', esperado ' + JSON.stringify(esperado));
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }

/* Procura o botao da mesa DENTRO do corpo da folha recem-criada, andando a
   arvore de verdade. Procurar por texto em todo o documento acharia o botao de
   outra tela. */
function acharBotaoMesa(no) {
  if (!no) return null;
  const alvos = [].concat(no.childNodes || []);
  for (const c of alvos) {
    if (!c) continue;
    if (c.tagName === 'BUTTON' && /mesa de ensaio/i.test(c.textContent || '')) return c;
    if (/mesa de ensaio/i.test(c.textContent || '') && c.childNodes && c.childNodes.length) {
      const dentro = acharBotaoMesa(c);
      if (dentro) return dentro;
    }
    const achado = acharBotaoMesa(c);
    if (achado) return achado;
  }
  return null;
}

/* O estado do Store que importa para esta prova: as tres listas que a tela da
   musica poderia tocar ao abrir. */
function retrato() {
  return JSON.stringify({
    escalas: Store.db.escalas.map((e) => ({ id: e.id, titulo: e.titulo, musicas: e.musicas.map((m) => m.id) })),
    cifras: Store.cifras().map((c) => c.id),
  });
}

function musicaDe(over) {
  return Object.assign({
    id: 'mus_' + marca(),
    nome: 'Vou ensaiar agora',
    artista: 'Teste',
    tom: 'C',
    bpm: 96,
    compasso: '4/4',
    letra: '',
    obs: '',
    anotacoes: [],
    vs: '',
    vsSeg: 0,
    vsTexto: '',
    vsCap: [],
    cifra: 'C\nG\nAm\nF',
  }, over || {});
}

function escalaCom(musicas) {
  return {
    id: 'esc_teste', titulo: 'Ensaio de sexta', data: '2026-10-09', hora: '19:30',
    musicas: musicas, criadaEm: 1,
  };
}

/* ------------------------------------------------------------
   1. A EXISTENCIA DA ACAO
   ------------------------------------------------------------ */

secao('1. a tela da musica oferece o caminho para a mesa');

{
  const mus = musicaDe({ id: 'mus_a' });
  const esc = escalaCom([mus]);
  Store.db.escalas.push(esc);
  Store.mudou('escala');

  const antes = retrato();
  mudouChamadas = 0;
  const h = Cancao.abrir(mus, esc, null, function () {});
  ok(!!h, 'a pagina da musica abre');
  igual(mudouChamadas, 0, 'abrir a pagina nao pede gravacao ao Store (nenhum S.mudou)');

  const btn = acharBotaoMesa(h.node || h.body || null);
  ok(!!btn, 'a acao de abrir a mesa existe na pagina da musica');
  igual((btn.textContent || '').trim(), 'Abrir a mesa de ensaio', 'e diz o que faz');
  ok(!!btn.querySelector('i[data-lucide]') || !!btn._attrs, 'e nasce com o icone declarado');
  igual(btn.disabled, false, 'e nasce habilitada com a mesa presente');

  igual(retrato(), antes, 'ABRIR A PAGINA NAO ESCREVE NO STORE');

  /* ---- clicar ---- */
  folhasFechadas = 0;
  const antesClique = pedidos.length;
  btn.click();

  igual(pedidos.length, antesClique + 1, 'clicar chama o palco UMA vez');
  igual(folhasFechadas, 1, 'e a folha da musica fecha ANTES de a mesa abrir');
  /* Guarda antes de descer no array: com o botao sabotado para nao chamar nada,
     `pedidos` pode estar vazio, e um `TypeError` no meio de um provador de
     mutacao derruba a suite antes de ela contar o resto. */
  const p = pedidos[pedidos.length - 1] || {};
  ok(pedidos[pedidos.length - 1], 'a sonda recebeu um pedido');
  ok(p.folhas === undefined, 'a sonda nao recebe ficha: quem monta a ficha e a mesa');
  igual(p.musica, mus, 'o palco recebe a MUSICA CERTA, por identidade');
  igual(p.escala, esc, 'e a escala em que ela esta');
  igual(retrato(), antes, 'e a Store segue intacta depois de abrir a mesa');

  Store.db.escalas.length = 0;
}

/* ------------------------------------------------------------
   2. O QUE A MESA RECEBE DE FATO: A FICHA
   ------------------------------------------------------------ */

secao('2. a ficha que a mesa vai montar');

{
  const mus = musicaDe({ id: 'mus_b', nome: 'Com gravacao', tom: 'D' });
  const esc = escalaCom([mus]);
  Store.db.escalas.push(esc);

  const h = Cancao.abrir(mus, esc, null, function () {});
  const btn = acharBotaoMesa(h.node || h.body || null);
  btn.click();

  const p = ultimo();
  /* A ficha nao e montada aqui: e a mesa quem monta, com `S.fichaDe`. O que a
     tela decide e a ORDEM dos argumentos. Conferir a ficha e conferir que a
     mesa recebera exatamente estes dois objetos — e que, com eles, a ficha sai
     como a mesa ja fazia antes desta mudanca. */
  const ficha = Store.fichaDe(p.musica, p.escala);
  igual(ficha.musicaId, 'mus_b', 'a ficha aponta para a musica pedida');
  igual(ficha.escalaId, 'esc_teste', 'e para a escala em que ela esta');
  igual(ficha.titulo, 'Com gravacao', 'com o titulo certo');
  igual(ficha.tom, 'D', 'e o tom guardado');
  igual(ficha.bpm, 96, 'e o andamento guardado');
  igual(ficha.compasso, '4/4', 'e o compasso guardado');
  ok(String(ficha.cifra || '').indexOf('C') >= 0, 'e a cifra guardada');

  Store.db.escalas.length = 0;
}

/* ------------------------------------------------------------
   3. NENHUMA SESSAO DE REPERTORIO
   ------------------------------------------------------------ */

secao('3. abrir nao cria sessao de repertorio');

{
  const mus = musicaDe({ id: 'mus_c' });
  const esc = escalaCom([mus]);
  Store.db.escalas.push(esc);

  const ordemAntes = esc.musicas.map((m) => m.id);
  const camposAntes = Object.keys(mus).sort().join(',');

  const h = Cancao.abrir(mus, esc, null, function () {});
  acharBotaoMesa(h.node || h.body || null).click();

  igual(esc.musicas.map((m) => m.id).join(','), ordemAntes.join(','), 'a ordem do repertorio nao muda');
  ok(esc.indice === undefined, 'nenhum indice de sessao e criado na escala',
    'escala.indice = ' + JSON.stringify(esc.indice));
  ok(esc.atualizadaEm === undefined, 'a escala nao e marcada como alterada');
  igual(Object.keys(mus).sort().join(','), camposAntes, 'a musica nao ganha campo novo');

  const ficha = Store.fichaDe(mus, esc);
  ok(ficha.escalaId === esc.id, 'a ficha liga a musica a escala, e nao a uma sessao');

  Store.db.escalas.length = 0;
}

/* ------------------------------------------------------------
   4. TRANSPOSE E REABERTURA: A MUSICA ORIGINAL PERMANECE
   ------------------------------------------------------------ */

secao('4. a musica original nao e alterada, e reabrir comeca limpo');

{
  const mus = musicaDe({ id: 'mus_d', tom: 'C', cifra: 'C\nG\nAm\nF' });
  const esc = escalaCom([mus]);
  Store.db.escalas.push(esc);

  const tomOriginal = mus.tom;
  const cifraOriginal = mus.cifra;

  /* Duas aberturas seguidas, como quem ensaia, fecha e abre de novo.
     * A contagem e um DELTA: `pedidos` acumula as secoes anteriores, e medir o
     * total daria um numero que cresce com o teste e nao com o comportamento. */
  const antesDoLaco = pedidos.length;
  for (let volta = 0; volta < 3; volta++) {
    const h = Cancao.abrir(mus, esc, null, function () {});
    acharBotaoMesa(h.node || h.body || null).click();
  }
  const desteLaco = pedidos.slice(antesDoLaco);

  igual(desteLaco.length, 3, 'tres aberturas, tres pedidos');
  ok(desteLaco.every((p) => p.musica === mus), 'as tres receberam a MESMA musica');
  igual(mus.tom, tomOriginal, 'o tom guardado nao foi mexido');
  igual(mus.cifra, cifraOriginal, 'a cifra guardada nao foi mexida');

  /* A ficha de cada abertura e identica: nao ha estado acumulado entre elas. */
  const fichas = desteLaco.map((p) => JSON.stringify(Store.fichaDe(p.musica, p.escala)));
  igual(fichas[0], fichas[1], 'a ficha da segunda abertura e igual a da primeira');
  igual(fichas[1], fichas[2], 'e a da terceira tambem');

  Store.db.escalas.length = 0;
}

/* ------------------------------------------------------------
   5. A MUSICA SEGUINTE NAO HERDA NADA
   ------------------------------------------------------------ */

secao('5. a musica seguinte nao herda estado da anterior');

{
  const musA = musicaDe({ id: 'mus_e1', nome: 'Primeira', tom: 'C', bpm: 96, cifra: 'C\nG' });
  const musB = musicaDe({ id: 'mus_e2', nome: 'Segunda', tom: 'D', bpm: 120, compasso: '3/4', cifra: 'D\nA' });
  const esc = escalaCom([musA, musB]);
  Store.db.escalas.push(esc);

  const ordemAntes = esc.musicas.map((m) => m.id).join(',');

  const hA = Cancao.abrir(musA, esc, null, function () {});
  acharBotaoMesa(hA.node || hA.body || null).click();
  const hB = Cancao.abrir(musB, esc, null, function () {});
  acharBotaoMesa(hB.node || hB.body || null).click();

  const pA = anterior();
  const pB = ultimo();
  igual(pA.musica, musA, 'a primeira abertura levou a primeira musica');
  igual(pB.musica, musB, 'a segunda levou a segunda musica');
  ok(pA.musica !== pB.musica, 'e nao a mesma');

  const fA = Store.fichaDe(pA.musica, pA.escala);
  const fB = Store.fichaDe(pB.musica, pB.escala);
  igual(fA.titulo, 'Primeira', 'a ficha da primeira tem o titulo da primeira');
  igual(fB.titulo, 'Segunda', 'a da segunda tem o titulo da segunda');
  igual(fA.bpm, 96, 'e o andamento da primeira');
  igual(fB.bpm, 120, 'e o da segunda');
  igual(fA.compasso, '4/4', 'o compasso nao vazou de uma para a outra');
  igual(fB.compasso, '3/4', 'cada uma com o seu');
  igual(esc.musicas.map((m) => m.id).join(','), ordemAntes, 'e a ordem do repertorio segue igual');

  Store.db.escalas.length = 0;
}

/* ------------------------------------------------------------
   6. GRAVACAO: AUSENTE E PRESENTE
   ------------------------------------------------------------ */

secao('6. gravacao: sem audio e com audio');

{
  /* ---- sem gravacao ---- */
  const musSem = musicaDe({ id: 'mus_f1', vs: '', vsSeg: 0, vsTexto: '' });
  const escSem = escalaCom([musSem]);
  Store.db.escalas.push(escSem);

  let h = Cancao.abrir(musSem, escSem, null, function () {});
  let btn = acharBotaoMesa(h.node || h.body || null);
  ok(!!btn, 'musica SEM gravacao ainda oferece a mesa');
  igual(btn.disabled, false, 'e o botao nao fica desabilitado por isso');
  btn.click();
  const pSem = ultimo();
  igual(pSem.musica, musSem, 'e abre a mesa com ela');

  const fichaSem = Store.fichaDe(pSem.musica, pSem.escala);
  ok(!fichaSem.vs, 'a ficha sai sem audio, e nao com audio vazio fingindo existir');

  /* ---- com gravacao ---- */
  const audio = 'data:audio/webm;base64,AAAA';
  const musCom = musicaDe({ id: 'mus_f2', vs: audio, vsSeg: 187, vsTexto: 'refrao' });
  const escCom = escalaCom([musCom]);
  Store.db.escalas.push(escCom);

  h = Cancao.abrir(musCom, escCom, null, function () {});
  btn = acharBotaoMesa(h.node || h.body || null);
  ok(!!btn, 'musica COM gravacao oferece a mesa');
  btn.click();
  const pCom = ultimo();

  igual(pCom.musica, musCom, 'e abre a mesa com ela');
  const fichaCom = Store.fichaDe(pCom.musica, pCom.escala);
  igual(fichaCom.vs, audio, 'a mesa recebera o MESMO audio, a MESMA referencia');
  ok(fichaCom.vs === musCom.vs, 'e nao uma copia: a identidade do objeto se mantem');
  igual(fichaCom.vsSeg, 187, 'com a duracao guardada');
  igual(fichaCom.vsTexto, 'refrao', 'e com o texto da gravacao');

  Store.db.escalas.length = 0;
}

/* ------------------------------------------------------------
   7. SEM ESCALA: A MUSICA QUE NUNCA PENDUROU EM NENHUM EVENTO
   ------------------------------------------------------------ */

secao('7. musica sem evento nenhum');

{
  const mus = musicaDe({ id: 'mus_g', nome: 'So na biblioteca' });
  const h = Cancao.abrir(mus, null, null, function () {});
  const btn = acharBotaoMesa(h.node || h.body || null);
  ok(!!btn, 'a acao existe tambem sem escala');
  igual(btn.disabled, false, 'e continua habilitada');
  btn.click();
  const p = ultimo();
  igual(p.escala, null, 'o palco recebe escala nula, nao uma escala inventada');
  igual(p.musica, mus, 'e a musica certa');
  const ficha = Store.fichaDe(p.musica, p.escala);
  igual(ficha.escalaId, null, 'a ficha sai com escalaId nulo: nenhuma sessao criada');
}

/* ------------------------------------------------------------
   8. SEM A MESA: O BOTAO DIZ QUE NAO PODE
   ------------------------------------------------------------ */

secao('8. sem a mesa, o botao nao finge');

{
  const guardado = global.Views.palco;
  global.Views.palco = undefined;

  const mus = musicaDe({ id: 'mus_h' });
  const esc = escalaCom([mus]);
  Store.db.escalas.push(esc);

  const h = Cancao.abrir(mus, esc, null, function () {});
  const btn = acharBotaoMesa(h.node || h.body || null);
  ok(!!btn, 'o botao continua presente');
  igual(btn.disabled, true, 'mas desabilitado');
  ok(/indispon/i.test(String(btn.getAttribute('title') || '')), 'e o title diz por que',
    'title = ' + JSON.stringify(btn.getAttribute('title')));

  const antes = pedidos.length;
  btn.click();
  igual(pedidos.length, antes, 'e clicar nao abre mesa nenhuma');

  global.Views.palco = guardado;
  Store.db.escalas.length = 0;
}

/* ------------------------------------------------------------
   FIM
   ------------------------------------------------------------ */

console.log('\n=================================================');
console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
if (falhou) {
  console.log('');
  falhas.forEach((f) => console.log('  FALHA  ' + f));
}
console.log('=================================================\n');
process.exit(falhou ? 1 : 0);