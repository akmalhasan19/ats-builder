/* T8.8 (Opsi B) — service worker tulisan tangan, tanpa vite-plugin-pwa.
 * Rincian strategi: NetworkFirst untuk navigasi HTML, CacheFirst untuk aset
 * statis. Versi cache mengikuti string injeksi. Daftar precache disuntik saat
 * build oleh scripts/inject-sw-precache.mjs.
 * `ignoreVary: true` wajib: banyak hosting mengirim `Vary: Origin`; tanpa itu
 * request dari halaman (yang membawa header Origin) tidak pernah match
 * entri cache yang ditulis oleh cache.addAll (tanpa Origin) — offline gagal
 * meski URL-nya sama persis. */

const SW_VERSION = '__SW_VERSION__'
const CACHE_NAME = `resume-studio-${SW_VERSION}`
const PRECACHE_URLS = __PRECACHE_URLS__

const MATCH_OPTS = { ignoreVary: true }

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() =>
          caches
            .match(request, MATCH_OPTS)
            .then((hit) => hit ?? caches.match('/index.html', MATCH_OPTS)),
        ),
    )
    return
  }

  event.respondWith(
    caches.match(request, MATCH_OPTS).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (
            response.ok &&
            (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/'))
          ) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
