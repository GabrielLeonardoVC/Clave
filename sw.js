/* =========================================================
   ACORDE - sw.js
   Service worker: cache-first, para funcionar offline.
   ========================================================= */
const CACHE = 'acorde-v4';

const RECURSOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/logo.svg',
  './assets/icon-512.svg',
  './css/base.css',
  './css/components.css',
  './css/features.css',
  './js/core/music.js',
  './js/core/utils.js',
  './js/core/store.js',
  './js/core/ui.js',
  './js/core/render.js',
  './js/core/print.js',
  './js/core/links.js',
  './js/core/metronome.js',
  './js/core/studio.js',
  './js/core/notify.js',
  './js/core/share.js',
  './js/data/base.js',
  './js/views/hoje.js',
  './js/views/agenda.js',
  './js/views/repertorio.js',
  './js/views/teoria.js',
  './js/views/ajustes.js',
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
