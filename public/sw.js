/*
 * Service worker do Mapa Burger.
 * Guarda SÓ os arquivos do próprio app (telas, ícones), pra abrir rápido e
 * funcionar sem internet. NUNCA guarda dados do Supabase nem da /api:
 * tudo que é dado vem sempre da internet, na hora.
 */
const CACHE = 'mapa-burger-app-v1'
const BASICO = ['/', '/manifest.webmanifest', '/icon-192.png', '/logo.png', '/favicon-32.png']
const LIMITE_ARQUIVOS = 80

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(BASICO))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function limitar(cache) {
  const chaves = await cache.keys()
  for (let i = 0; i < chaves.length - LIMITE_ARQUIVOS; i++) await cache.delete(chaves[i])
}

async function guardar(pedido, resposta) {
  if (!resposta || !resposta.ok || resposta.type !== 'basic') return
  const cache = await caches.open(CACHE)
  await cache.put(pedido, resposta.clone())
  limitar(cache)
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request
  if (pedido.method !== 'GET') return
  const url = new URL(pedido.url)
  // Outros sites (Supabase etc.) e a /api: o navegador resolve, sem cache.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // Telas: internet primeiro (sempre a versão mais nova); sem internet, a última guardada.
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((resposta) => {
          guardar('/', resposta.clone())
          return resposta
        })
        .catch(async () => (await caches.match('/')) || Response.error()),
    )
    return
  }

  // Arquivos do build (/assets/...) nunca mudam de conteúdo: guardado primeiro.
  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith(
      caches.match(pedido).then(
        (guardado) =>
          guardado ||
          fetch(pedido).then((resposta) => {
            guardar(pedido, resposta.clone())
            return resposta
          }),
      ),
    )
    return
  }

  // Ícones, logo, manifesto: guardado se tiver, e atualiza em segundo plano.
  evento.respondWith(
    caches.match(pedido).then((guardado) => {
      const daRede = fetch(pedido)
        .then((resposta) => {
          guardar(pedido, resposta.clone())
          return resposta
        })
        .catch(() => guardado)
      return guardado || daRede
    }),
  )
})
