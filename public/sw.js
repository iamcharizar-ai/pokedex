// Offline app shell.
//  • hashed build assets (/assets/*) never change → cache-first, instant loads
//  • sprites never change either → cache-first, in their own cache so a shell
//    update does not throw away every sprite already seen
//  • the page itself → network-first with a short timeout, cached fallback
// Bump CACHE when this file's strategy changes; old shell caches are dropped on activate.
const CACHE = 'pokedex-shell-v1'
const SPRITES = 'pokedex-sprites-v1'
const PAGE_TIMEOUT_MS = 2500

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== SPRITES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const store = (name, req, res) => {
  if (res.ok) {
    const copy = res.clone()
    caches.open(name).then((c) => c.put(req, copy))
  }
  return res
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  const fixed = url.pathname.startsWith('/sprites/') ? SPRITES : url.pathname.startsWith('/assets/') ? CACHE : null
  if (fixed) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => store(fixed, req, res))))
    return
  }

  e.respondWith(
    Promise.race([
      fetch(req).then((res) => store(CACHE, req, res)),
      new Promise((_, reject) => setTimeout(reject, PAGE_TIMEOUT_MS)),
    ]).catch(() => caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match('/'))),
  )
})
