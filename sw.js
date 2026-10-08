/* =========================================================
   CLAVE - sw.js
   Service worker: cache-first, para funcionar offline.

   A LISTA ERA VERIFICADA POR FERRAMENTA, E ESTAVA ERRADA

   A lista vivia escrita a mao e ja estava desatualizada: `identidade.js`,
   `search.js`, `tuner.js`, `audio.js`, `gravador.js`, `cancao.js`, `afinador.js`
   e `emergencia.js` nunca entraram. O resultado era um app que abria offline e
   depois quebrava ao tocar em busca, no afinador ou em emergencia — que sao
   justamente as coisas de que se precisa sem rede. Quem abriu o app no ensaio,
   num porao sem sinal, achava que o app estava com defeito.

   Aqui a lista e conferida contra o que o `index.html` realmente carrega, e
   nao contra o que alguem lembrou de escrever. `npm run check:sw` falha se um
   arquivo carregado na pagina nao estiver aqui. Um arquivo novo no index
   entra com um aviso, nao com um defeito em campo.
   ========================================================= */
/* O nome do cache. Mudou de `v3` para `v4` porque a ESTRATEGIA mudou: o
   `activate` apaga todo cache com outro nome, entao subir o numero descarta
   os arquivos guardados pela regra antiga em vez de reaproveita-los.

   E um numero que so muda a mao, que e o jeito de esse numero ficar errado.
   Por isso a mudanca de estrategia tambem tem de ser feita a mao: subir o
   cache nao conserta a regra, e regra errada com cache novo serve coisa errada
   com mais efficiency. */
const CACHE = 'clave-v4';

const RECURSOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/logo.svg',
  './assets/icon-512.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './assets/icon-maskable-512.png',
  './css/base.css',
  './css/components.css',
  './css/features.css',
  './js/core/identidade.js',
  './js/core/music.js',
  './js/core/utils.js',
  './js/core/store.js',
  './js/core/armazenamento.js',
  './js/core/ui.js',
  './js/core/render.js',
  './js/core/print.js',
  './js/core/links.js',
  './js/core/search.js',
  './js/core/tuner.js',
  './js/core/timbre.js',
  './js/core/audio.js',
  './js/core/gravador.js',
  './js/core/metronome.js',
  './js/core/palco.js',
  './js/core/gfx.js',
  './js/core/cena.js',
  './js/core/viva.js',
  './js/core/studio.js',
  './js/core/notify.js',
  './js/core/share.js',
  './js/data/base.js',
  './js/views/hoje.js',
  './js/views/agenda.js',
  './js/views/repertorio.js',
  './js/views/teoria.js',
  './js/views/instrumentos.js',
  './js/views/ajustes.js',
  './js/views/afinador.js',
  './js/views/emergencia.js',
  './js/views/violao3d.js',
  './js/views/traste3d.js',
  './js/views/palco.js',
  './js/views/execucao.js',
  './js/views/cancao.js',
  './js/app.js',
];

/* ------------------------------------------------------------
   INSTALAR: O QUE GUARDA, E O QUE FAZ O APP ATUALIZAR

   Aqui estava o defeito mais serio deste arquivo, e ele nao aparecia em
   nenhum lugar.

   Era isto:

       caches.open(CACHE).then(c => c.addAll(RECURSOS)).then(() => skipWaiting())

   O `skipWaiting` — que e o que troca o worker velho pelo novo — estava DEPOIS
   do `addAll`. E o `addAll` e atomico: se UM dos 45 recursos falhar, a promessa
   inteira e rejeitada, o `skipWaiting` nunca roda, e o worker novo fica
   esperando para sempre enquanto o velho continua servindo o app antigo.

   O resultado e o mais difcil de diagnosticar que existe: o app abre, abre
   bem, e nao e o app novo. Sem erro, sem aviso, sem nada no console. E o
   sintoma e exatamente o que foi relatado — o violao 3D que 'sumiu' e o
   afinador que 'nao foi implementado': as duas coisas estavam no codigo, e
   quem olhava via a versao que o cache mantinha viva.

   A correcao tem duas partes, e as duas importam:

     1. `skipWaiting` NAO pode depender do cache encher. Ele vai sempre.
        O cache e um extra — e o que faz o app abrir no porao sem sinal —, nao
        uma condicao para a versao nova existir.

     2. Os recursos entram UM POR UM, cada um tolerante a falha. Um
        `addAll` que perde 44 arquivos bons por causa de uma imagem que
        faltou e o mesmo defeito em escala menor: o offline fica sem quase
        nada, e ninguem sabe o que sumiu.
   ------------------------------------------------------------ */
self.addEventListener('install', (ev) => {
  ev.waitUntil((async function () {
    const c = await caches.open(CACHE);

    /* `cache: 'reload'` em cada um. Sem isso, o `cache.add` pode guardar no
       Cache Storage a copia que o CACHE HTTP do navegador ainda tem — que e
       uma camada abaixo deste arquivo e que ele nao controla. Guardar ali a
       versao antiga do script e justapoe a conta que a rede principal tenta
       acertar. E a verificacao no navegador ja mostrou isso happening:
       `deliveryType: 'cache-storage'` numa resposta que deveria ter vindo da
       rede. */
    await Promise.all(RECURSOS.map(async function (recurso) {
      try {
        await c.add(new Request(recurso, { cache: 'reload' }));
      } catch (e) {
        /* Um recurso que faltou nao pode derrubar os outros, e nao pode
           derrubar a instalacao. Segue sem ele: o app ainda funciona online, e
           so o offline perde aquele arquivo. */
      }
    }));

    /* Sempre, e por ultimo. E o que faz a versao nova assumir. */
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ------------------------------------------------------------
   O QUE ESTE BLOCO FAZ, E POR QUE NAO E "CACHE-FIRST"

   A versao anterior respondia com o cache primeiro para TUDO, e atualizava em
   segundo plano. Isso e rapido e e o jeito errado.

   O defeito: quem abre o app depois de uma atualizacao recebe a versao
   ANTERIOR, e so recebe a nova na segunda visita. Sem erro, sem aviso: apenas
   um app velho, que parece defeito do app e e defeito do cache. Foi assim que o
   violao 3D "sumiu" e que o afinador "nao foi implementado" — as duas coisas
   estavam no codigo, e quem olhava via uma versao do cache.

   POR QUE "REDE PRIMEIRO" E NAO SO PARA A NAVEGACAO

   A primeira correcao deste arquivo pegava so a navegacao: o `index.html` ia
   na rede primeiro, e os arquivos seguiam cache-primeiro. Parecia resolvido e
   nao era, e a propria verificacao no navegador mostrou por que.

   O `index.html` nao muda quando um `js/` muda. O guarda-corpo era "o HTML
   mudou? entao descarta o cache" — e como o HTML nao tinha mudado, nada era
   descartado. Resultado: HTML novo (ou o mesmo) com scripts velhos, e o app
   abria com uma versao antiga do codigo. Foi o que aconteceu na propria rodada
   em que a correcao foi escrita: o painel novo do 3D existia no disco, o
   navegador servia a copia guardada, e a tela caiu em
   `ReferenceError: painelInstrumento is not defined`.

   E nao ha como acertar isso olhando o HTML: num app sem etapa de build, o
   HTML nao muda quando qualquer arquivo muda. A unica coisa que responde a
   pergunta "o que esta guardado ainda e o que existe?" e a propria rede. Por
   isso a rede vem primeiro para TUDO que e do proprio app.

   O CACHE CONTINUA, E E O QUE FAZ O APP ABRIR NO PORAO

   A rede e tentada primeiro com um PRAZO. Se ela responde dentro do prazo, e
   ela que responde. Se nao responde — sem sinal, sinal fraco, NSAp em BACKGROUND
   — o cache responde, e a atualizacao fica em segundo plano para a proxima
   vez. Quem abre o ensaio sem sinal abre o mesmo app de sempre, e quem abre
   com sinal recebe a versao do dia, na mesma abertura.

   Uma regra so, para o HTML e para os scripts. Nao ha combinacao de dois
   criterios que seja mais correta que isso, e nao ha combinacao de dois
   criterios que nao tenha um caso em que os dois discordam.
   ------------------------------------------------------------ */

/* O prazo. Longo o bastante para que uma rede saudavel semprevenca, curto o
   bastante para que um porao sem sinal nao fique com a tela branca esperando.
   Tres segundos e o compromise: uma abertura de 34 arquivos pequenos nao
   leva isso em rede nenhuma, e sem sinal o `fetch` falha em milissegundos. */
const PRAZO = 3000;

/* A rede primeiro, com prazo. Devolve a resposta da rede, ou `null` se ela nao
   respondeu a tempo (ou nao respondeu bem). Nunca rejeita: quem chama decide o
   que fazer com o `null`. */
function redePrimeiro(req) {
  return new Promise(function (resolve) {
    let decidido = false;
    const responder = function (v) {
      if (decidido) return;
      decidido = true;
      clearTimeout(cronometro);
      resolve(v);
    };
    self.__PORQUE = self.__PORQUE || {};
const cronometro = setTimeout(function () { responder(null); }, PRAZO);
    self.__PORQUE[new URL(req.url).pathname] = 'a rede nao respondeu em ' + PRAZO + 'ms';

    /* `cache: 'no-cache'` nao e o mesmo que "sem cache".
     *
     * Sem esta opcao, o `fetch(req)` dentro do worker reaproveita o CACHE HTTP
     * do navegador — que fica DEBAIXO do service worker e que este arquivo nao
     * controla. A medicao no navegador mostrou isso: `deliveryType: "cache"` e
     * `transferSize: 0` numa resposta que deveria ter vindo da rede. O
     * resultado era o defeito original, um passo mais abaixo: rede "primeira"
     * que nao vai a lugar nenhum porque algem respondeu antes dela.
     *
     * `no-cache` nao proibe guardar: proibe USAR sem perguntar. O navegador
     * revalida com o servidor antes de responder, e um 304 sai barato. E o que
     * faz "rede primeiro" significar rede mesmo. */
    const pergunta = new Request(req, { cache: 'no-cache' });

    const caminho = new URL(req.url).pathname;
    fetch(pergunta).then(function (res) {
      if (!res || !res.ok) {
        self.__PORQUE[caminho] = 'rede respondeu ' + (res ? res.status : 'nada');
        responder(null); return;
      }
      self.__PORQUE[caminho] = 'da rede (' + res.status + ')';
      // Guarda a copia nova ANTES de devolver a original: `res` vai para o
      // navegador, e depois de consumida nao ha mais `clone()`.
      const copia = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copia); }).catch(function () { /* cache cheio */ });
      responder(res);
    }).catch(function (e) {
      self.__PORQUE[caminho] = 'a rede FALHOU: ' + e.name + ': ' + e.message;
      responder(null);
    });
  });
}

self.addEventListener('fetch', function (ev) {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Deixa passar recursos externos (fontes, youtube) direto da rede: sao de
  // terceiros, nao fazem parte do app, e guardar_video do YouTube em cache
  // seriaveloce que nunca acaba.
  if (url.origin !== location.origin) return;

  ev.respondWith(
    redePrimeiro(req).then(function (res) {
      if (res) return res;

      /* Sem rede a tempo. O cache responde; se nao houver nada guardado, e a
         pagina do proprio app que salva a proxima navegacao. */
      return caches.match(req).then(function (hit) {
        if (hit) {
          // Deixa a rede tentar de novo em segundo plano: o proximo pacote vem
          // de onde vier, mas o cache ja fica mais perto do atual.
          fetch(req).then(function (r2) {
            if (r2 && r2.ok) caches.open(CACHE).then(function (c) { c.put(req, r2.clone()); });
          }).catch(function () { /* segue offline */ });
          return hit;
        }
        return caches.match('./index.html');
      });
    })
  );
});

self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  const rota = (ev.notification.data && ev.notification.data.rota) || 'hoje';
  ev.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ('focus' in c) { c.navigate && c.navigate(c.url.split('#')[0] + '#' + rota); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html#' + rota);
    })
  );
});

/* O WORKER RESPONDE QUANDO ALGUEM PERGUNTA
 *
 * Este canal nao e enfeite: e o unico jeito de saber, de dentro, qual versao o
 * aparelho esta rodando. O defeito que este arquivo teve era exatamente o
 * opaco — o app abria, e nao era o app novo, sem erro em lugar nenhum. Quem
 * recebe o relato "o app nao atualiza" nao tem como descobrir isso no console,
 * porque o console do worker nao aparece junto com o da pagina.
 *
 * Com este canal, a pagina (e um teste) pode perguntar: qual cache, quantos
 * arquivos guardados, e o que a rede respondeu da ultima vez. */
/* ------------------------------------------------------------
   O WORKER RESPONDE A ALGUEM — E SO A ALGUEM
 *
 * Duas ordens chegam por aqui. A primeira e do app: "assumir", para o
 * worker novo assumir enquanto esta aba estiver aberta. A segunda e de quem
 * pergunta: qual cache, quantos arquivos, e o que a rede respondeu.
 *
 * A segunda existe porque este arquivo teve um defeito invisivel. O app
 * abria, e nao era o app novo — sem erro, sem aviso, e sem nada no console
 * de quem tem o aparelho. Quem recebe o relato "o app nao atualiza" nao tem
 * como investigar aquilo, e o jeito de descobrir a versao que roda e PERGUNTAR
 * ao worker.
 *
 * E A CONFERENCIA DE ORIGEM NAO E OPCIONAL. Um `message` sem comparar
 * `ev.origin` e um pedido que qualquer aba do navegador pode mandar: aberta
 * uma pagina cualquiera em outra aba, ela fala com este worker. O
 * `check-seguranca` llama isso pelo nome — "mensagem sem conferir a origem" —
 * e ele estava certo. O que a pagina de origem ganha com isso e zero:
 * assumir um worker novo e uma coisa que so a propria pagina deve pedir.
   ------------------------------------------------------------ */
self.addEventListener('message', function (ev) {

  /* A porta e do navegador; a origem e de quem mandou. Sao coisas
   * diferentes, e e a segunda que decide se o pedido e de confianca. Uma
   * aba de outro site nao tem porta nossa, mas tambem nao tem origem nossa. */
  if (!ev.origin || ev.origin !== self.location.origin) return;

  const dados = ev.data || {};

  /* A ordem que a pagina da: o worker novo assume agora. */
  if (dados.tipo === 'assumir') {
    ev.waitUntil(self.skipWaiting());
    return;
  }

  if (dados.tipo !== 'diagnostico') return;

  const responder = ev.ports && ev.ports[0] ? ev.ports[0] : (ev.source || null);
  ev.waitUntil((async function () {
    const c = await caches.open(CACHE);
    const guardados = (await c.keys()).length;
    const caminho = dados.arquivo || './js/core/identidade.js';
    let oQueARedeResponde;
    try {
      const r = await fetch(new Request(caminho, { cache: 'no-cache' }));
      oQueARedeResponde = r.status + (r.ok ? ' (ok)' : ' (NAO ok)');
    } catch (e) {
      oQueARedeResponde = 'LANCOU ' + e.name + ': ' + e.message;
    }
    if (!responder) return;
    responder.postMessage({
      tipo: 'diagnostico',
      cache: CACHE,
      guardados: guardados,
      porque: self.__PORQUE || {},
      redeAgora: oQueARedeResponde,
    });
  })());
});
