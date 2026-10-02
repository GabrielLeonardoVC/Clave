/* =========================================================
   tools/test-sw.js
   O service worker decide: rede primeiro, e o worker novo assume.

   POR QUE ESTE ARQUIVO EXECUTA O CODIGO E NAO LE O CODIGO

   `check-sw.js` confere se o cache tem o que a pagina carrega. Isso e uma
   pergunta sobre uma LISTA. A pergunta que importa agora e sobre uma DECISAO:
   dado um pedido e uma rede, o worker responde com a rede ou com o cache?

   Um verificador que le o arquivo e procura `fetch` antes de `caches.match`
   nao prova a decisao — prova a ordem das palavras. E a ordem das palavras foi
   exatamente o defeito: o `skipWaiting` estava DEPOIS do `addAll` no texto, e
   por isso so rodava depois — e nao rodava.

   Este arquivo roda o `sw.js` de verdade, num `vm` com `caches`, `fetch` e
   `setTimeout` de mentira, e faz as perguntas de verdade:

     - com rede boa, a resposta vem da rede?
     - sem rede, vem do cache?
     - a rede lenta perde para o prazo?
     - o `skipWaiting` depende do cache encher?
     - uma aba de outro site manda no worker?

   O QUE ISTO NAO PROVA

   Que o navegador honra o `respondWith`, e que `skipWaiting` de fato ativa o
   worker. Isso depende do navegador, e so o navegador responde. O que este
   arquivo prova e que o CODIGO do worker toma a decisao certa — que era onde o
   defeito morava.
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const ARQ_SW = path.join(RAIZ, 'sw.js');
const ARQ_APP = path.join(RAIZ, 'js', 'app.js');

let passou = 0;
let falhou = 0;
const problemas = [];

function ok(cond, titulo, detalhe) {
  if (cond) {
    passou++;
    console.log('  ok    ' + titulo + (detalhe ? '  (' + detalhe + ')' : ''));
  } else {
    falhou++;
    problemas.push(titulo);
    console.log('  FALHA ' + titulo);
    if (detalhe) console.log('        ' + detalhe);
  }
}

function secao(t) { console.log('\n=== ' + t + ' ==='); }
function dormir(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* ------------------------------------------------------------------ */
/* O WORKER DE MENTIRA                                                  */
/*                                                                     */
/* Nao e um navegador: e o minimo para o `sw.js` carregar e decidir. O que */
/* ele Faz de diferente e que expoe o que aconteceu — quantas vezes o cache */
/* foi aberto, o que o worker gravou — para o teste conferir a DECISAO, e nao */
/* apenas se algo quebrou.                                             */
/* ------------------------------------------------------------------ */

function montarWorker(opts) {
  opts = opts || {};
  const REDE = opts.rede || 'boa';
  const ATRASO = opts.atraso || 0;
  const guardado = new Map(Object.entries(opts.cache || {}));

  const eventos = {};
  const chamados = [];
  let aberturas = 0;
  const REDE_BASE = 'https://exemplo/';

  function chaveDe(req) {
    const u = String(req && req.url ? req.url : req);
    /* Caminho relativo vira caminho absoluto. A Cache API real resolve
     * `'./index.html'` contra o escopo do worker antes de comparar, e sem isso
     * o teste afirma que o app nao tem nem a propria pagina guardada — o que e
     * falso. Foi a primeira versao deste teste que falhou aqui. */
    if (u.indexOf('.') === 0) return u.replace(/^\.\//, '');
    return u.indexOf(REDE_BASE) === 0 ? u.slice(REDE_BASE.length) : u;
  }

  function resposta(corpo) {
    return {
      ok: true,
      status: 200,
      clone: function () { return resposta(corpo); },
      text: function () { return Promise.resolve(corpo); },
    };
  }

  function caixa(nome) {
    return {
      put: function (req, res) {
        if (!nome) return Promise.reject(new Error('cache sem nome'));
        return res.text().then(function (t) { guardado.set(chaveDe(req), t); });
      },
      add: function (req) {
        if (opts.addFalha) return Promise.reject(new Error('recurso indisponivel'));
        guardado.set(chaveDe(req), 'adicionado');
        return Promise.resolve();
      },
      keys: function () {
        return Promise.resolve([].concat(Array.from(guardado.keys())).map(function (k) {
          return { url: REDE_BASE + k };
        }));
      },
      delete: function (req) { return Promise.resolve(guardado.delete(chaveDe(req))); },
      match: function (req) {
        return Promise.resolve(guardado.has(chaveDe(req))
          ? resposta(guardado.get(chaveDe(req))) : undefined);
      },
    };
  }

  const caches = {
    open: function (nome) { aberturas++; return Promise.resolve(caixa(nome)); },
    keys: function () { return Promise.resolve([]); },
    match: function (req) {
      return Promise.resolve(guardado.has(chaveDe(req))
        ? resposta(guardado.get(chaveDe(req))) : undefined);
    },
  };

  const self = {
    location: { origin: 'https://exemplo' },
    skipWaiting: function () { chamados.push('skipWaiting'); return Promise.resolve(); },
    clients: {
      claim: function () { chamados.push('claim'); return Promise.resolve(); },
      matchAll: function () { return Promise.resolve([]); },
    },
    addEventListener: function (tipo, fn) {
      if (!eventos[tipo]) eventos[tipo] = [];
      eventos[tipo].push(fn);
    },
  };

  function rede(req) {
    if (REDE === 'fora') return Promise.reject(new TypeError('Failed to fetch'));
    if (ATRASO > 0) {
      return new Promise(function (r) { setTimeout(function () { r(resposta(queVemDeOnde(req))); }, ATRASO); });
    }
    return Promise.resolve(resposta(queVemDeOnde(req)));
  }

  /* A REDE TEM DUAS RESPOSTAS, E A DIFERENCA E O `cache` DO PEDIDO.
   *
   * O navegador tem DUAS camadas de cache. A de cima e o Cache Storage, que o
   * worker controla — e o que este arquivo testa. A de baixo e o cache HTTP do
   * proprio navegador, que fica DEBAIXO do worker e que o worker nao controla:
   * `fetch(req)` sem `cache: 'no-cache'` pode sair de la sem tocar na rede.
   *
   * E o que aconteceu na verificacao no navegador: `deliveryType: 'cache'` e
   * `transferSize: 0` numa resposta que a rede deveria ter servido. O worker
   * estava no caminho certo e nao chegou na rede por causa de uma camada que
   * ninguem olhava.
   *
   * Sem esta distincao aqui, o teste nao teria como ver a diferenca entre
   * `new Request(req, { cache: 'no-cache' })` e `new Request(req)` — as duas
   * linhas parecem iguais, e dariam o mesmo resultado num sandbox que so sabe
   * responder "tem rede" ou "nao tem". Por isso a rede aqui tem DUAS respostas,
   * e qual delas sai depende do `cache` do pedido. */
  function queVemDeOnde(req) {
    const modo = (req && req.cache) || 'default';
    if (modo === 'no-cache' || modo === 'reload' || modo === 'no-store') {
      return 'da rede, agora';
    }
    return 'do cache http do navegador';
  }

  class Req {
    constructor(entrada, opcoes) {
      opcoes = opcoes || {};
      this.url = String(entrada && entrada.url ? entrada.url : entrada);
      this.method = (entrada && entrada.method) || 'GET';
      this.mode = (entrada && entrada.mode) || 'same-origin';
      this.cache = opcoes.cache || 'default';
    }
  }

  const contexto = {
    self: self,
    caches: caches,
    fetch: rede,
    Request: Req,
    URL: URL,
    console: console,
    Promise: Promise,
    /* O PRAZO DO WORKER E DE 3000ms, e o teste inteiro nao pode levar 3
     * segundos para provar uma coisa de 3 segundos. O `setTimeout` do sandbox
     * encolhe o tempo em 60 vezes: o prazo de 3000ms vira 50ms aqui, e a
     * espera continua sendo de verdade — o que muda e a unidade, nao o
     * comportamento. Um teste que espera 3s para provar que o cache responde
     * antes da rede e um teste que ninguem roda. */
    setTimeout: function (fn, ms) { return setTimeout(fn, Math.max(1, Math.round(ms / 60))); },
    clearTimeout: clearTimeout,
    location: self.location,
  };
  vm.createContext(contexto);
  vm.runInContext(fs.readFileSync(ARQ_SW, 'utf8'), contexto, { filename: 'sw.js' });

  return {
    self: self,
    eventos: eventos,
    chamados: chamados,
    guardado: guardado,
    aberturas: function () { return aberturas; },
  };
}

/* Faz um pedido e devolve o que o worker entregou. */
async function pedir(w, caminho) {
  const ouvintes = w.eventos.fetch || [];
  if (!ouvintes.length) return { respondeu: false };

  let entregue;
  let respondeu = false;
  const ev = {
    request: { url: 'https://exemplo/' + caminho, method: 'GET', mode: 'no-cors' },
    respondWith: function (p) {
      respondeu = true;
      p.then(function (r) { entregue = r; }, function () { entregue = 'ERRO'; });
    },
  };
  ouvintes.forEach(function (fn) { fn(ev); });
  await dormir(ATRASO_PADRAO);
  return { respondeu: respondeu, entregue: entregue };
}

const ATRASO_PADRAO = 140;

/* Manda uma mensagem ao worker, como a pagina faria. */
async function mandar(w, origem, dados, comPorta) {
  const ouvintes = w.eventos.message || [];
  const antes = w.chamados.length;
  const respostas = [];
  const ev = {
    origin: origem,
    data: dados,
    ports: comPorta ? [] : [],
    source: { postMessage: function (m) { respostas.push(m); } },
    waitUntil: function (p) { if (p && p.catch) p.catch(function () {}); },
  };
  ouvintes.forEach(function (fn) { fn(ev); });
  await dormir(80);
  return {
    chamouSkipWaiting: w.chamados.length > antes,
    respostas: respostas,
    chamados: w.chamados.slice(antes),
  };
}

/* ------------------------------------------------------------------ */

async function main() {

  secao('1. O worker carrega e registra o que precisa');
  const w = montarWorker({});
  ok((w.eventos.install || []).length === 1, 'um listener de install',
    (w.eventos.install || []).length + ' (tem de ser 1)');
  ok((w.eventos.activate || []).length === 1, 'um listener de activate');
  ok((w.eventos.fetch || []).length === 1, 'um listener de fetch',
    (w.eventos.fetch || []).length + ' (tem de ser 1)');
  ok((w.eventos.message || []).length === 1, 'um listener de message');
  ok(typeof w.self.skipWaiting === 'function', 'o worker sabe pular a fila');

  secao('2. Com rede boa, a resposta vem da rede');
  {
    const w2 = montarWorker({ rede: 'boa', cache: { 'js/app.js': 'guardado antes' } });
    const r = await pedir(w2, 'js/app.js');
    const corpo = r.entregue && r.entregue.text ? await r.entregue.text() : r.entregue;
    ok(r.respondeu, 'o worker respondeu');
    ok(corpo === 'da rede, agora',
      'e veio da REDE, mesmo com o cache cheio',
      'veio: ' + corpo);
    ok(corpo !== 'do cache http do navegador',
      'e NAO saiu do cache HTTP do navegador, que fica abaixo do worker',
      'veio: ' + corpo);
  }

  secao('3. O cache e o que salva quem esta sem sinal');
  {
    const w3 = montarWorker({ rede: 'fora', cache: { 'js/app.js': 'guardado antes' } });
    const r = await pedir(w3, 'js/app.js');
    const corpo = r.entregue && r.entregue.text ? await r.entregue.text() : r.entregue;
    ok(corpo === 'guardado antes', 'sem rede, o CACHE responde', 'veio: ' + corpo);
  }
  {
    const w3b = montarWorker({ rede: 'fora', cache: { 'index.html': 'a pagina do app' } });
    const r = await pedir(w3b, 'js/nunca-guardado.js');
    const corpo = r.entregue && r.entregue.text ? await r.entregue.text() : r.entregue;
    ok(corpo === 'a pagina do app',
      'sem rede e sem cache, a propria pagina do app salva a aba', 'veio: ' + corpo);
  }

  secao('4. A rede lenta nao segura a tela');
  {
    const w4 = montarWorker({
      rede: 'boa', atraso: 900, cache: { 'js/app.js': 'guardado antes' },
    });
    const t0 = Date.now();
    const r = await pedir(w4, 'js/app.js');
    const dt = Date.now() - t0;
    const corpo = r.entregue && r.entregue.text ? await r.entregue.text() : r.entregue;
    ok(corpo === 'guardado antes',
      'a rede atrasada nao venceu: o cache respondeu', 'veio: ' + corpo);
    ok(dt < 600, 'e respondeu sem esperar a rede terminar', dt + 'ms');
  }

  secao('5. O worker novo assume MESMO que o cache nao encha');
  {
    /* O defeito da rodada: `skipWaiting` depois do `addAll`, e `addAll` e
     * atomico. Com um recurso indisponivel, o worker novo nao assume — para
     * sempre, sem aviso. Aqui o `add` falha de proposito. */
    const w5 = montarWorker({ addFalha: true });
    (w5.eventos.install || []).forEach(function (fn) {
      fn({ waitUntil: function (p) { if (p && p.catch) p.catch(function () {}); } });
    });
    await dormir(120);
    ok(w5.chamados.indexOf('skipWaiting') >= 0,
      'com TODOS os recursos indisponiveis, o worker ainda se declara',
      'chamou: ' + (w5.chamados.join(', ') || 'nada'));
  }
  {
    const codigo = fs.readFileSync(ARQ_SW, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    ok(!/\.addAll\s*\(/.test(codigo),
      'e nao usa `addAll`: um recurso faltando apagaria os outros do offline');
  }

  secao('6. O worker so obedece a quem e da casa');
  {
    const w6 = montarWorker({});
    const deFora = await mandar(w6, 'https://site-de-terceiros.example', { tipo: 'assumir' });
    ok(!deFora.chamouSkipWaiting,
      'uma aba de OUTRO site nao manda o worker assumir',
      'origem: https://site-de-terceiros.example');
    ok(deFora.respostas.length === 0, 'e nem recebe resposta do canal de diagnostico');

    const deCasa = await mandar(w6, 'https://exemplo', { tipo: 'assumir' });
    ok(deCasa.chamouSkipWaiting, 'a propria pagina manda, e o worker obedece');
  }

  secao('7. O canal de diagnostico responde a quem perguntou de casa');
  {
    const w7 = montarWorker({ cache: { 'js/app.js': 'guardado' } });
    const r = await mandar(w7, 'https://exemplo', { tipo: 'diagnostico' });
    ok(r.respostas.length === 1, 'a pergunta foi respondida', r.respostas.length + ' resposta(s)');
    const d = r.respostas[0];
    if (d) {
      ok(d.tipo === 'diagnostico', 'a resposta se identifica');
      ok(typeof d.cache === 'string' && d.cache.length > 0, 'diz qual cache esta em uso', d.cache);
      ok(typeof d.guardados === 'number', 'diz quantos arquivos estao guardados', String(d.guardados));
    }
  }

  secao('8. A pagina pergunta se ha versao nova esperando');
  {
    const app = fs.readFileSync(ARQ_APP, 'utf8');
    const codigo = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    ok(/function atualizarServiceWorker/.test(app), 'a pagina tem a funcao que faz a pergunta');
    ok(/getRegistration/.test(codigo), 'ela consulta o registro do worker');
    ok(/reg\.waiting/.test(codigo), 'e olha se ha um worker ESPERANDO');
    ok(/reg\.waiting\.update\(\)|reg\.update\(\)/.test(codigo),
      'e pede a atualizacao antes de olhar, para o worker novo existir');

    const pedido = /postMessage\(\{\s*tipo:\s*'([^']+)'/.exec(codigo);
    ok(pedido !== null, 'o pedido da pagina tem um tipo legivel');
    if (pedido) {
      const sw = fs.readFileSync(ARQ_SW, 'utf8');
      ok(new RegExp("dados\\.tipo === '" + pedido[1] + "'").test(sw),
        'e o worker reconhece esse tipo', 'a pagina pede "' + pedido[1] + '"');
    }
  }

  secao('9. Uma regra so de cada');

  {
    const codigo = fs.readFileSync(ARQ_SW, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    ['fetch', 'install', 'activate', 'message'].forEach(function (tipo) {
      const quantos = (codigo.match(new RegExp("addEventListener\\('" + tipo + "'", 'g')) || []).length;
      ok(quantos === 1, 'um listener de ' + tipo + ' — dois fariam o ultimo ganhar', String(quantos));
    });
  }

  secao('10. O nome do cache nao volta ao que ja foi');

  {
    /* O cache mudou de nome quando a estrategia mudou. Sem isso, o `activate`
     * nao apaga nada, e os arquivos guardados pela regra antiga ficam: um cache
     * com versao velha que ninguem sabe de onde veio. */
    const codigo = fs.readFileSync(ARQ_SW, 'utf8');
    const m = /const CACHE = '([^']+)'/.exec(codigo);
    ok(m !== null, 'o cache tem nome declarado');
    ok(m && /-v[0-9]+$/.test(m[1]), 'e o nome termina em versao', m ? m[1] : '');
    ok(m && m[1] === 'clave-v4',
      'e a versao acompanha a estrategia nova', m ? m[1] : '');
  }

  console.log('\n' + '='.repeat(54));
  console.log('  ' + passou + ' passaram, ' + falhou + ' falharam');
  if (falhou) {
    console.log('\n  Um worker que responde a coisa errada nao da erro nenhum: da o');
    console.log('  app antigo, que abre bem e parece certo.');
    for (const p of problemas) console.log('    - ' + p);
  }
  console.log('='.repeat(54) + '\n');
}

main().catch(function (erro) {
  console.error('O TESTE QUEBROU:');
  console.error(erro && erro.stack ? erro.stack : erro);
  process.exit(1);
});