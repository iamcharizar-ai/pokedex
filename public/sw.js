// Offline app shell.
//  • install precaches the page and the build assets it references, so the very first
//    offline start works (not only after a second online visit)
//  • hashed build assets (/assets/*) never change → cache-first, instant loads
//  • the page itself → network-first with a short timeout, cached fallback
//  • sprites never change either → cache-first, in their own cache so a shell update does not
//    throw away every sprite already seen
//  • /api/* is never touched: a signed-in response must not outlive the session in a cache
// Only good responses are cached: ok, HTML for the shell, nothing marked no-store.
// Bump CACHE when this file's strategy changes; old caches are dropped on activate.
const CACHE = 'pokedex-shell-v2'
const SPRITES = 'pokedex-sprites-v1'
const PAGE_TIMEOUT_MS = 2500

const cacheable = (res, shell) =>
  res.ok &&
  !/no-store/i.test(res.headers.get('cache-control') || '') &&
  (!shell || /text\/html/i.test(res.headers.get('content-type') || ''))

// A failed cache write (quota, closed cache) must never fail the response it belongs to.
const put = (name, req, res) =>
  caches.open(name).then((c) => c.put(req, res)).catch(() => {})

async function precache() {
  const c = await caches.open(CACHE)
  const page = await fetch('/', { cache: 'reload' })
  if (!cacheable(page, true)) return
  const html = await page.clone().text()
  await c.put('/', page)
  const grab = async (path) => {
    try {
      const res = await fetch(path)
      if (!res.ok) return null
      await c.put(path, res.clone())
      return res
    } catch {
      return null
    }
  }
  const assets = new Set(html.match(/\/assets\/[^"'\s)<>]+/g) || [])
  await Promise.all([...assets].map(async (a) => {
    const res = await grab(a)
    if (!res || !a.endsWith('.css')) return
    // fonts and images a stylesheet pulls in are needed to render offline too
    const css = await res.text()
    const urls = [...css.matchAll(/url\(\s*['"]?([^'")]+)/g)].map((m) => new URL(m[1], self.location.origin + a).pathname)
    await Promise.all(urls.filter((p) => p.startsWith('/assets/')).map(grab))
  }).map((p) => p.catch(() => {})))
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== SPRITES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  const fixed = url.pathname.startsWith('/sprites/') ? SPRITES : url.pathname.startsWith('/assets/') ? CACHE : null
  if (fixed) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (cacheable(res)) e.waitUntil(put(fixed, req, res.clone()))
        return res
      })),
    )
    return
  }

  const nav = req.mode === 'navigate'
  const key = nav ? '/' : req
  let write = Promise.resolve()
  const network = fetch(req).then((res) => {
    if (cacheable(res, nav)) write = put(CACHE, key, res.clone())
    return res
  })
  // keep the worker alive until the cache write finishes, without making the response wait for it
  e.waitUntil(network.then(() => write, () => {}))
  e.respondWith(
    Promise.race([network, new Promise((_, reject) => setTimeout(reject, PAGE_TIMEOUT_MS))]).catch(async () =>
      (await caches.match(key, { ignoreSearch: true })) ||
      (nav ? await caches.match('/') : undefined) ||
      new Response('Offline', { status: 503, statusText: 'Offline' }),
    ),
  )
})
