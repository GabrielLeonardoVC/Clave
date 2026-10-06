/* =========================================================
   ACORDE - tools/test-palco-viva.js
   A mesa de ensaio sobrevive a uma interrupcao.

   Existe por causa de tres ausencias que so aparecem com o aparelho na mao:

     - nada pedia a tela acesa, e o celular apaga a tela no meio do ensaio;
     - nao havia tela cheia, e a cifra ficava numa faixa com o aparelho inteiro
       em volta;
     - nada tratava `visibilitychange` na mesa. O navegador corta os temporizadores
       quando a aba some, e o proximo passo — um minuto ou uma hora depois —
       somava o tempo inteiro de uma vez. A rolagem da cifra pulava para o fim e
       todas as anotacoes do intervalo acendiam juntas.

   O teste aqui e de COMPORTAMENTO, nao de texto: nada procura `source.includes`.
   Um verificador que le o arquivo prova que a palavra esta escrita; nao prova
   que a tela acende.

   O `Viva` aceita `document` e `navigator` por parametro justamente para isso:
   em Node nao existe Wake Lock nem tela cheia, e sem injeccao o teste so poderia
   afirmar "nao quebrou" — jamais "funciona".

   Rodar: node tools/test-palco-viva.js
   ========================================================= */
'use strict';

const path = require('path');
const { RAIZ } = require('./arquivos.js');

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
function perto(recebido, esperado, tolerancia, rotulo) {
  return ok(Math.abs(recebido - esperado) <= tolerancia, rotulo,
    'recebido ' + recebido + ', esperado ' + esperado + ' +/- ' + tolerancia);
}
function secao(t) { console.log('\n=== ' + t + ' ==='); }

/* Reexigir a tela acesa passa por uma promessa: o pedido e assincrono, e o
   `visibilitychange` e um evento sincrono. Conferir o estado no mesmo tique
   mediria a fila de promessas, nao o comportamento — e um `acender` quebrado
   passaria. Por isso o `tique`. */
function tique() { return new Promise(function (r) { setTimeout(r, 0); }); }

/* =========================================================
   1. O RELOGIO: congelar e degelar
   ========================================================= */

/* O nucleo do problema: `criarRelogio` le o tempo de `performance.now()` E agenda
   o proximo passo com `setTimeout`. As duas coisas sao controladas aqui.
   Sem controlar o temporizador o teste teria de esperar 10 segundos de
   relogio de verdade para ver um minuto pular, e o resultado dependeria da
   velocidade da maquina — que e exatamente o defeito que o relogio do projeto
   existe para evitar. */
function comRelogioControlado(fn) {
  const salvos = {
    performance: global.performance,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
  };
  let t = 1000;
  let agendado = null;

  global.performance = { now: function () { return t; } };
  global.setTimeout = function (cb) { agendado = cb; return 1; };
  global.clearTimeout = function () { agendado = null; };

  /* Um passo do relogio: avanca o tempo e roda o que estava agendado. */
  const passo = function (ms) {
    t += ms;
    const cb = agendado;
    agendado = null;
    if (cb) cb();
  };
  /* Um salto de tempo com o passo ainda AGENDADO: e o que o navegador faz com a
     aba oculta. O temporizador nao e descartado — ele fica suspenso e dispara
     tarde, e e por isso que o proximo passo soma o tempo inteiro de uma vez.
     Descartar o agendamento aqui seria um modelo diferente, e mediria um
     defeito que o relogio nao tem. */
  const salto = function (ms) { t += ms; };

  try { return fn(passo, salto); }
  finally {
    global.performance = salvos.performance;
    global.setTimeout = salvos.setTimeout;
    global.clearTimeout = salvos.clearTimeout;
  }
}

secao('1. O relogio nao salta quando a tela apaga');

comRelogioControlado(function (passo, salto) {
  delete require.cache[require.resolve(path.join(RAIZ, 'js/core/palco.js'))];
  const Palco = require(path.join(RAIZ, 'js/core/palco.js'));

  /* --- o defeito antigo, reproduzido: sem congelar, o salto acontece --- */
  const sem = Palco.criarRelogio();
  sem.iniciar(300);
  passo(10000);   // dez segundos de ensaio
  const antesDoSalto = sem.posicao;
  ok(antesDoSalto > 9 && antesDoSalto < 11, 'sem congelar, o passo conta o tempo',
    'posicao ' + antesDoSalto.toFixed(2));
  salto(60000);   // UM MINUTO com a aba oculta: os temporizadores param
  passo(100);     // a pessoa volta e o proximo passo roda
  const posDepois = sem.posicao;
  ok(posDepois - antesDoSalto > 55, 'SEM congelar, o relogio salta o tempo oculto',
    'saltou ' + (posDepois - antesDoSalto).toFixed(1) + 's — este e o defeito');
  sem.pausar();

  /* --- com congelar, o intervalo oculto nao entra --- */
  const com = Palco.criarRelogio();
  com.iniciar(300);
  passo(10000);
  const base = com.posicao;
  ok(base > 9 && base < 11, 'antes de apagar, o relogio conta o tempo certo',
    'posicao ' + base.toFixed(2));

  com.congelar();
  igual(com.congelado, true, 'congelar marca o relogio como congelado');
  salto(60000);   // um minuto oculto
  passo(100);     // um passo que nao devia existir: congelado cortou o agendamento
  igual(com.posicao, base, 'com congelado, o tempo oculto NAO entra na conta');
  ok(com.tocando, 'e o relogio continua "tocando": ninguem parou o ensaio');

  com.degelar(true);
  igual(com.congelado, false, 'degelar volta a correr');
  passo(10000);
  ok(com.posicao > base + 9 && com.posicao < base + 11,
    'e volta a contar o tempo de verdade, do ponto em que ficou',
    'de ' + base.toFixed(2) + ' para ' + com.posicao.toFixed(2));

  /* --- congelar duas vezes nao faz mal --- */
  com.congelar();
  com.congelar();
  salto(5000);
  igual(com.congelado, true, 'congelar duas vezes nao quebra');
  com.degelar(true);
  igual(com.congelado, false, 'e um degelar basta');

  /* --- degelar sem estar congelado nao faz nada --- */
  const p = com.posicao;
  passo(5000);
  igual(com.degelar(false), false, 'degelar sem estar congelado devolve falso');
  ok(com.posicao >= p, 'e nao mexe na posicao');

  com.pausar();
});

/* =========================================================
   2. O DONO DOS RECURSOS: Wake Lock
   ========================================================= */

function fakeDocument(opts) {
  opts = opts || {};
  const ouvintes = {};
  const doc = {
    visibilityState: 'visible',
    fullscreenEnabled: opts.fullscreen !== false,
    fullscreenElement: null,
    addEventListener: function (n, f) { (ouvintes[n] = ouvintes[n] || []).push(f); },
    removeEventListener: function (n, f) {
      const l = ouvintes[n] || [];
      const i = l.indexOf(f);
      if (i >= 0) l.splice(i, 1);
    },
    disparar: function (n) { for (const f of (ouvintes[n] || []).slice()) f({ type: n }); },
    quantos: function (n) { return (ouvintes[n] || []).length; },
  };
  return doc;
}

function fakeSentinel(doc) {
  const s = { released: false, ouvintes: {} };
  s.addEventListener = function (n, f) { (s.ouvintes[n] = s.ouvintes[n] || []).push(f); };
  s.release = function () {
    if (s.released) return;
    s.released = true;
    for (const f of (s.ouvintes.release || []).slice()) f();
  };
  s.disparar = function (n) { for (const f of (s.ouvintes[n] || []).slice()) f(); };
  return s;
}

function fakeNavigator(opts) {
  opts = opts || {};
  if (opts.semWakeLock) return {};
  const nav = { wakeLock: {} };
  nav.wakeLock.request = function () {
    nav.pedidos = (nav.pedidos || 0) + 1;
    if (opts.rejeitar) return Promise.reject(new Error('NotAllowedError'));
    if (opts.lancar) throw new Error('lancou');
    const s = fakeSentinel();
    nav.ultimo = s;
    return Promise.resolve(s);
  };
  return nav;
}

function criarViva(opts) {
  delete require.cache[require.resolve(path.join(RAIZ, 'js/core/viva.js'))];
  const Viva = require(path.join(RAIZ, 'js/core/viva.js'));
  return Viva.criar(opts);
}

secao('2. Wake Lock: pede, segura e solta');

(async function () {
  /* --- 2a. quando existe, e adquirido ao abrir --- */
  {
    const doc = fakeDocument();
    const nav = fakeNavigator();
    const v = criarViva({ document: doc, navigator: nav });
    igual(v.podeAcender(), true, 'com a API presente, o modulo diz que pode acender');
    v.abrir();
    /* ABRIR SO. Nenhum `acender()` depois.
     *
     * E o que separa "a mesa pede a tela acesa sozinha" de "a mesa espera
     * alguem pedir". Com o `acender()` explicito aqui, a asercao passaria
     * mesmo que `abrir` nao fizesse nada — e o teste estaria medindo a
     * propria chamada do teste, que e a forma mais facil de um teste passar
     * sem provar nada. */
    await tique();
    igual(v.estado().acendendo, true, 'abrir a mesa ja pede a tela acesa');
    ok(!!nav.ultimo, 'o navegador recebeu o pedido de Wake Lock');

    /* fechar solta */
    v.destruir();
    igual(v.estado().acendendo, false, 'fechar a mesa solta o Wake Lock');
    /* Guarda antes do `.released`: sem ela, uma mesa que nunca pediu o
       Wake Lock derrubaria a suite com um `TypeError` no meio de um provador de
       mutacao — e uma suite que morre no primeiro defeito nao diz nada sobre o
       resto. Aqui o teste falha, continua, e conta. */
    igual(!!nav.ultimo && nav.ultimo.released, true, 'e o handle foi mesmo liberado');

    /* Reabrir nao acumula.
     *
     * Ate aqui o navegador recebeu UM pedido, da primeira mesa. A segunda
     * sessao abre e pede mais tres vezes; o total tem que ser exatamente dois —
     * um por sessao que realmente ficou aberta. Cada `acender()` a mais devolve
     * o handle que ja existe, e `abrir` de novo nao faz nada. */
    const v2 = criarViva({ document: doc, navigator: nav });
    v2.abrir();
    await tique();
    v2.abrir();                       // abrir duas vezes
    await v2.acender();
    await v2.acender();                // pedir varias vezes
    igual(nav.pedidos, 2, 'abrir e pedir de novo nao cria Wake Lock a cada vez');
    igual(v2.estado().acendendo, true, 'e continua com um so handle');
    v2.destruir();
  }

  /* --- 2b. quando a API nao existe --- */
  {
    const doc = fakeDocument();
    const nav = fakeNavigator({ semWakeLock: true });
    const v = criarViva({ document: doc, navigator: nav });
    igual(v.podeAcender(), false, 'sem a API, o modulo diz que nao pode acender');
    v.abrir();
    const r = await v.acender();
    igual(r, false, 'pedir mesmo assim devolve falso, e nao erro');
    igual(v.estado().acendendo, false, 'e nada finge estar aceso');
    igual(v.estado().suportaAcender, false, 'o estado expoe a verdade para a interface');
    v.abrir();
    await v.acender();
    v.destruir();
    ok(true, 'abrir e fechar sem a API nao quebra nada');
  }

  /* --- 2c. quando o navegador recusa --- */
  {
    const doc = fakeDocument();
    const nav = fakeNavigator({ rejeitar: true });
    const v = criarViva({ document: doc, navigator: nav });
    v.abrir();
    const r = await v.acender();
    igual(r, false, 'recusa devolve falso');
    igual(v.estado().acendendo, false, 'e nada fica aceso');
    igual(v.estado().recusado, true, 'o estado registra que foi recusado');
    // e continua usavel: um novo pedido nao fica travado
    igual((await v.acender()), false, 'pedir de novo nao trava');
    v.destruir();
  }

  /* --- 2d. quando `request` lanca --- */
  {
    const doc = fakeDocument();
    const nav = fakeNavigator({ lancar: true });
    const v = criarViva({ document: doc, navigator: nav });
    v.abrir();
    igual(await v.acender(), false, 'uma excecao sincrona vira falso, nao excecao');
    igual(v.estado().acendendo, false, 'e nada fica aceso');
    v.destruir();
  }

  /* --- 2e. o handle chega depois da mesa fechar --- */
  {
    const doc = fakeDocument();
    let resolver;
    const nav = { wakeLock: { request: function () { return new Promise(function (r) { resolver = r; }); } } };
    const v = criarViva({ document: doc, navigator: nav });
    v.abrir();
    const p = v.acender();          // pedido em voo
    v.destruir();                   // e a mesa fecha antes da resposta
    const tarde = fakeSentinel();
    resolver(tarde);
    igual(await p, false, 'pedido que chega depois do fechamento e recusado');
    igual(tarde.released, true, 'e o handle tarde e solto na hora');
  }

  secao('3. Wake Lock: ocultacao e reaquecimento');

  /* --- 3a. esconder solta; voltar readquire --- */
  {
    const doc = fakeDocument();
    const nav = fakeNavigator();
    const eventos = [];
    const v = criarViva({
      document: doc, navigator: nav,
      aoFicar: function () { eventos.push('oculta'); },
      aoVoltar: function (h) { eventos.push('volta:' + h); },
    });
    v.abrir();
    await v.acender();
    const antes = nav.pedidos;
    igual(v.estado().acendendo, true, 'comeca aceso');

    doc.visibilityState = 'hidden';
    doc.disparar('visibilitychange');
    igual(v.estado().acendendo, false, 'ao ocultar, o handle e solto');
    igual(v.estado().interrompido, true, 'e a interrupcao fica registrada');
    ok(v.estado().aberto, 'a mesa continua aberta durante a ocultacao');

    doc.visibilityState = 'visible';
    doc.disparar('visibilitychange');
    await tique();
    igual(v.estado().acendendo, true, 'ao voltar, a tela e reacendida');
    igual(nav.pedidos, antes + 1, 'e isso custou exatamente um novo pedido');
    igual(v.estado().interrompido, false, 'a interrupcao foi consumida');
    igual(eventos.join(','), 'oculta,volta:true', 'os ganchos foram chamados na ordem');
    v.destruir();
  }

  /* --- 3b. varias ocultacoes nao acumulam handle --- */
  {
    const doc = fakeDocument();
    const nav = fakeNavigator();
    const v = criarViva({ document: doc, navigator: nav });
    v.abrir();
    await v.acender();
    for (let i = 0; i < 4; i++) {
      doc.visibilityState = 'hidden'; doc.disparar('visibilitychange');
      doc.visibilityState = 'visible'; doc.disparar('visibilitychange');
      await tique();
    }
    igual(v.estado().acendendo, true, 'quatro ocultacoes deixam a mesa acesa');
    igual(v.estado().suportaAcender, true, 'e o estado continua coerente');
    v.destruir();
    igual(v.estado().acendendo, false, 'o fim da mesa solta o que restava');
  }

  /* --- 3c. recusa nao vira reaquecimento eterno --- */
  {
    const doc = fakeDocument();
    let recusa = true;
    const nav = { wakeLock: { request: function () {
      if (recusa) return Promise.reject(new Error('negado'));
      return Promise.resolve(fakeSentinel());
    } } };
    const v = criarViva({ document: doc, navigator: nav });
    v.abrir();
    await v.acender();
    igual(v.estado().recusado, true, 'a recusa ficou registrada');
    recusa = false;
    const pedidosAntes = (nav.pedidos || 0);
    doc.visibilityState = 'hidden'; doc.disparar('visibilitychange');
    doc.visibilityState = 'visible'; doc.disparar('visibilitychange');
    await tique();
    igual(v.estado().acendendo, false, 'depois de uma recusa, o modulo NAO insiste sozinho');
    igual(nav.pedidos || 0, pedidosAntes, 'e nao fica pedindo em loop');
    v.destruir();
  }

  /* --- 3d. um gancho que lanca nao derruba a mesa ---
   *
   * O `viva.js` embrulha `aoFicar` e `aoVoltar` em `try/catch`. Esse `catch`
   * e o unico lugar onde uma falha de quem paints a mesa vira um problema
   * menor: o relogio ou a interface pode falhar, mas o handle de tela acesa e
   * os ouvintes tem de sair limpos mesmo assim. Sem este caso, o `catch` e
   * codigo defensivo que ninguem nunca exercitou — e codigo defensivo nao
   * testado e o que se apaga primeiro na proxima manutencao. */
  {
    const doc = fakeDocument();
    const nav = fakeNavigator();
    let ocultou = 0;
    const v = criarViva({
      document: doc, navigator: nav,
      aoFicar: function () { ocultou++; throw new Error('o relogio explodiu'); },
      aoVoltar: function () { throw new Error('a interface explodiu'); },
    });
    v.abrir();
    await tique();
    igual(v.estado().acendendo, true, 'a mesa comeca acesa');

    doc.visibilityState = 'hidden';
    doc.disparar('visibilitychange');
    igual(ocultou, 1, 'o gancho foi chamado mesmo lancando');
    igual(v.estado().acendendo, false, 'e o handle foi solto MESMO com o gancho quebrado');

    doc.visibilityState = 'visible';
    doc.disparar('visibilitychange');
    await tique();
    igual(v.estado().acendendo, true, 'ao voltar, reacende mesmo com o gancho quebrado');
    igual(v.estado().aberto, true, 'e a mesa continua aberta');
    v.destruir();
    igual(v.estado().acendendo, false, 'e fecha limpamente');
  }

  secao('4. Tela cheia');

  function fakeAlvo() {
    const alvo = { pedido: 0 };
    alvo.requestFullscreen = function () {
      alvo.pedido++;
      if (alvo.recusar) return Promise.reject(new Error('negado'));
      return Promise.resolve();
    };
    return alvo;
  }

  /* --- 4a. pedir e sair --- */
  {
    const doc = fakeDocument();
    const alvo = fakeAlvo();
    const mudancas = [];
    const v = criarViva({
      document: doc, navigator: fakeNavigator(), alvo: alvo,
      emMudanca: function (e) { mudancas.push(e.telaCheia); },
    });
    v.abrir();
    igual(v.podeTelaCheia(), true, 'com a API presente, a tela cheia e possivel');

    igual(await v.pedirTelaCheia(), true, 'pedir tela cheia funciona');
    igual(alvo.pedido, 1, 'e o pedido vai para o elemento certo');

    // o navegador e quem confirma: so agora o estado muda
    igual(v.estado().telaCheia, false, 'antes do `fullscreenchange`, nao se declara tela cheia');
    doc.fullscreenElement = alvo;
    doc.disparar('fullscreenchange');
    igual(v.estado().telaCheia, true, 'o `fullscreenchange` confirma a entrada');

    doc.exitFullscreen = function () { doc.fullscreenElement = null; return Promise.resolve(); };
    igual(await v.sairTelaCheia(), true, 'sair da tela cheia funciona');
    doc.disparar('fullscreenchange');
    igual(v.estado().telaCheia, false, 'e a saida e confirmada');

    ok(mudancas.indexOf(true) >= 0 && mudancas.indexOf(false) >= 0,
      'quem pinta a interface foi avisado das duas bordas');
    v.destruir();
  }

  /* --- 4b. sair por Esc: quem saiu, saiu --- */
  {
    const doc = fakeDocument();
    const alvo = fakeAlvo();
    const v = criarViva({ document: doc, navigator: fakeNavigator(), alvo: alvo });
    v.abrir();
    await v.pedirTelaCheia();
    doc.fullscreenElement = alvo;
    doc.disparar('fullscreenchange');
    igual(v.estado().telaCheia, true, 'entrou em tela cheia');
    // o navegador tira o elemento sem ninguem pedir
    doc.fullscreenElement = null;
    doc.disparar('fullscreenchange');
    igual(v.estado().telaCheia, false, 'a saida pelo navegador tambem e lida');
    igual(alvo.pedido, 1, 'e o modulo NAO{forca a tela cheia de volta');
    v.destruir();
  }

  /* --- 4c. sem suporte --- */
  {
    const doc = fakeDocument({ fullscreen: false });
    const v = criarViva({ document: doc, navigator: fakeNavigator() });
    v.abrir();
    igual(v.podeTelaCheia(), false, 'sem a API, o modulo diz que nao pode');
    igual(await v.pedirTelaCheia(), false, 'pedir devolve falso, e nao erro');
    igual(v.estado().telaCheia, false, 'e nada finge estar em tela cheia');
    v.destruir();
  }

  /* --- 4d. o pedido e recusado --- */
  {
    const doc = fakeDocument();
    const alvo = fakeAlvo();
    alvo.recusar = true;
    const v = criarViva({ document: doc, navigator: fakeNavigator(), alvo: alvo });
    v.abrir();
    igual(await v.pedirTelaCheia(), false, 'recusa do navegador vira falso, e nao excecao');
    igual(v.estado().telaCheia, false, 'e o estado continua dizendo a verdade');
    v.abrir();
    await v.pedirTelaCheia();
    v.destruir();
    ok(true, 'pedir de novo depois de recusado nao quebra');
  }

  secao('5. Ouvintes e limpeza');

  /* --- 5a. um ouvinte por evento --- */
  {
    const doc = fakeDocument();
    const v = criarViva({ document: doc, navigator: fakeNavigator() });
    v.abrir();
    v.abrir();
    v.abrir();
    igual(doc.quantos('visibilitychange'), 1, 'tres `abrir` nao criam tres ouvintes de visibilidade');
    igual(doc.quantos('fullscreenchange'), 1, 'nem tres de tela cheia');
    v.destruir();
    igual(doc.quantos('visibilitychange'), 0, 'destruir tira o ouvinte de visibilidade');
    igual(doc.quantos('fullscreenchange'), 0, 'e o de tela cheia');
    igual(doc.quantos('webkitfullscreenchange'), 0, 'e o do prefixo legado');
  }

  /* --- 5b. abrir, fechar, abrir --- */
  {
    const doc = fakeDocument();
    const nav = fakeNavigator();
    let destruido = 0;
    for (let i = 0; i < 3; i++) {
      const v = criarViva({ document: doc, navigator: nav, emMudanca: function () { destruido++; } });
      v.abrir();
      await v.acender();
      v.destruir();
      v.destruir();     // destruir duas vezes nao pode explodir
    }
    igual(doc.quantos('visibilitychange'), 0, 'tres ciclos nao deixam ouvinte nenhum');
    igual(doc.quantos('fullscreenchange'), 0, 'nem de tela cheia');
    igual(nav.ultimo.released, true, 'e o ultimo handle foi solto');
  }

  /* --- 5c. usar depois de fechar --- */
  {
    const doc = fakeDocument();
    const nav = fakeNavigator();
    const v = criarViva({ document: doc, navigator: nav });
    v.abrir();
    await v.acender();
    v.destruir();
    // nada aqui pode lancar
    const r1 = await v.acender();
    const r2 = await v.pedirTelaCheia();
    const r3 = await v.sairTelaCheia();
    igual(r1, false, 'pedir Wake Lock depois de fechar devolve falso');
    igual(r2, false, 'pedir tela cheia depois de fechar devolve falso');
    igual(r3, false, 'sair tela cheia depois de fechar devolve falso');
    igual(v.estado().aberto, false, 'e o estado continua dizendo que a mesa nao esta aberta');
    doc.visibilityState = 'hidden';
    doc.disparar('visibilitychange');
    ok(true, 'e um evento que chega depois do fechamento nao lanca');
  }

  await fechar();
})();

function fechar() {
  console.log('\n=================================================');
  /* A grafia deste relatorio NAO e livre.
   *
   * O `conta-teste.js` le o que os testes IMPRIMEM para somar o total do
   * projeto, e reconhece o numero em "N passaram, M falharam". Escrever
   * "passou(aram)" — que e a forma mais cuidada em portugues — faz o contador
   * ler ZERO deste arquivo sem reclamar de nada: o verificador nao acusa
   * subtotal zero, entao o total inteiro fica menor e parece normal.
   *
   * Foi assim que seis testes deste projeto somavam zero antes de o
   * `conta-teste.js` existir. Nao "melhore" esta frase sem rodar
   * `node tools/conta-teste.js` e conferir que este arquivo aparece com o
   * numero, e nao com zero. */
  console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
  if (falhou) {
    console.log('');
    falhas.forEach(function (f) { console.log('  FALHA  ' + f); });
  }
  console.log('=================================================\n');
  process.exit(falhou ? 1 : 0);
}