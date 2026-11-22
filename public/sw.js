// Offline support for The Rumi self check-in app.
// Navigations: network first, fall back to the cached app shell.
// Same-origin assets and Google Fonts: serve from cache, refresh in the background.
// API calls to Supabase are never cached.
const CACHE = 'rumi-v5'
const SHELL = ['/', '/emblem.svg', '/manifest.webmanifest', '/icons/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  const cacheable =
    url.origin === self.location.origin ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  if (!cacheable) return

  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req)
      const net = fetch(req)
        .then((res) => {
          if (res.ok || res.type === 'opaque') c.put(req, res.clone())
          return res
        })
        .catch(() => hit)
      return hit || net
    }),
  )
})
