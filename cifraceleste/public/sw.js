/**
 * sw.js — service worker do CifraCeleste.
 *
 * Estratégia deliberada: rede primeiro, com o cache como reserva.
 *
 * O oposto do mais comum. Um app de cifras é usado com internet instável —
 * celular no campo, porão da igreja, configuração do santa missa — e quem
 * precisa da cifra na hora não pode esperar o carregamento. Então: tenta a
 * rede, e se não houver, serve o cache. O usuário nunca fica olhando uma tela
 * em branco, e ainda recebe as atualizações assim que há conexão.
 */

const VERSAO = 'cifraceleste-v1'

const RECURSOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
]

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(VERSAO)
      // addAll falha inteiro se um item falhar; a aplicação não deve ficar
      // sem cache por causa de um arquivo só.
      .then((cache) => Promise.allSettled(RECURSOS.map((r) => cache.add(r))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request

  if (requisicao.method !== 'GET') return

  const url = new URL(requisicao.url)
  // Recursos de terceiros (fontes, ícones) vão direto para a rede.
  if (url.origin !== self.location.origin) return

  evento.respondWith(
    fetch(requisicao)
      .then((resposta) => {
        if (resposta && resposta.ok && resposta.type === 'basic') {
          const copia = resposta.clone()
          caches.open(VERSAO).then((cache) => cache.put(requisicao, copia))
        }
        return resposta
      })
      .catch(async () => {
        const cache = await caches.open(VERSAO)
        const guardado = await cache.match(requisicao)
        if (guardado) return guardado

        // Navegação sem cache: devolve a casca, para o app abrir e explicar
        // que está sem conexão em vez de mostrar a página 404 do navegador.
        if (requisicao.mode === 'navigate') {
          const casca = await cache.match('./index.html')
          if (casca) return casca
        }
        return new Response('Sem conexão e sem cópia salva.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }),
  )
})

/** Clique no aviso: abre o app já na tela pedida. */
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = (evento.notification.data && evento.notification.data.url) || './index.html#/hoje'

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ('focus' in janela) {
          janela.navigate(destino)
          return janela.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino)
      return undefined
    }),
  )
})
