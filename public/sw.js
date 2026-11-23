// A release is ready only after its shell, scripts, fonts and hotel pictures
// are saved together. An offline restart can then load even the first visit.
const CACHE = 'rumi-__BUILD_ID__'
const FILES = /* __RELEASE_FILES__ */ []
const FILE_SET = new Set(FILES)
const RELEASE_NAME = /^rumi-\d{14}$/
const APP_ROUTES = new Set(['/', '/tablet', '/staff'])

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    try {
      await cache.addAll(FILES.map((path) => new Request(path, { cache: 'reload' })))
    } catch (error) {
      await caches.delete(CACHE)
      throw error
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // A guest already checking in may still request a chunk from the previous build.
    const releases = (await caches.keys()).filter((key) => RELEASE_NAME.test(key)).sort().reverse()
    const previous = releases.find((key) => key < CACHE)
    await Promise.all(releases.filter((key) => key < CACHE && key !== previous).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  const navigation = request.mode === 'navigate'
  const path = navigation ? url.pathname.replace(/\/$/, '') || '/' : url.pathname
  if (navigation && !APP_ROUTES.has(path)) return
  if (!navigation && !FILE_SET.has(path) && !path.startsWith('/assets/')) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const key = navigation ? '/index.html' : path
    const hit = await cache.match(key)
    if (hit) return hit
    if (path.startsWith('/assets/')) {
      // Asset names contain a content hash, so an older tab can use the exact previous file.
      const releases = (await caches.keys()).filter((name) => name !== CACHE && RELEASE_NAME.test(name))
      for (const name of releases) {
        const previous = await (await caches.open(name)).match(path)
        if (previous) return previous
      }
    }
    return fetch(request)
  })())
})
