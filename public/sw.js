// Maia's service worker. It does one thing: when a page can't be loaded
// because the device is offline, it shows /offline.html instead of the
// browser's error page. Everything else (scripts, engines, model weights, API
// calls) goes to the network exactly as without it, so it can never serve a
// stale copy of the site.
//
// Changing OFFLINE_FILES? Bump the version so the new files are cached.
const CACHE = 'maia-offline-v1'
const OFFLINE_URL = '/offline.html'
const OFFLINE_FILES = [OFFLINE_URL, '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_FILES))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith('maia-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      )
      // Lets the page's request start while the worker is starting, so
      // having a worker doesn't delay page loads.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable()
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse
          if (preloaded) return preloaded
          return await fetch(request)
        } catch (error) {
          const cached = await caches.match(OFFLINE_URL)
          if (cached) return cached
          throw error
        }
      })(),
    )
    return
  }
  // The offline page's own image, while offline.
  if (OFFLINE_FILES.includes(new URL(request.url).pathname)) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || Response.error()),
      ),
    )
  }
})
