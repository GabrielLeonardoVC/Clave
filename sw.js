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
const CACHE = 'clave-v3';

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
  './js/core/studio.js',
  './js/core/notify.js',
  './js/core/share.js',
  './js/data/base.js',
  './js/views/hoje.js',
  './js/views/agenda.js',
  './js/views/repertorio.js',
  './js/views/teoria.js',
  './js/views/ajustes.js',
  './js/views/afinador.js',
  './js/views/emergencia.js',
  './js/views/violao3d.js',
  './js/views/traste3d.js',
  './js/views/palco.js',
  './js/views/cancao.js',
  './js/app.js',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(RECURSOS))
      .then(() => self.skipWaiting())
      .catch(() => { /* um recurso falhou: segue sem ele */ })
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // deixa passar recursos externos (fontes, youtube) direto da rede
  if (url.origin !== location.origin) return;

  ev.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        // atualiza em segundo plano
        fetch(req).then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        }).catch(() => { /* offline: usa o cache */ });
        return hit;
      }
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});

/* Clique em notificacao: abre o app na rota pedida */
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
