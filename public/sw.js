// Offline support for The Rumi self check-in app.
// Navigations: network first, fall back to the cached app shell.
// Same-origin assets: serve from cache, refresh in the background.
// API calls to Supabase are never cached.
// The build id in CACHE is filled in at build time (vite.config.ts), so each deploy installs a new worker.
const CACHE = 'rumi-__BUILD_ID__'
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
          // Only a good page may become the offline copy (never a 404 or a server error page).
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put('/', copy))
          }
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  if (url.origin !== self.location.origin) return

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
