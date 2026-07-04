/**
 * UMA ITSM — Service Worker v3
 *
 * Caching strategy:
 *   /_next/static/   → Cache First  (content-hashed, safe to cache forever)
 *   Static assets    → Cache First  (images, fonts, icons, manifest)
 *   HTML navigation  → Network First → cache fallback → offline.html
 *   RSC / data fetch → Network Only  (never serve stale RSC payloads)
 *   /api/*           → Network Only  (never cache API responses)
 */

const CACHE_VERSION  = 'uma-itsm-v3'
const STATIC_CACHE   = `${CACHE_VERSION}-static`
const PAGES_CACHE    = `${CACHE_VERSION}-pages`
const OFFLINE_PAGE   = '/offline.html'   // Pure static HTML — no JS chunk dependency

// ── Install: precache critical assets individually so one failure cannot
//    abort the entire install (cache.addAll rejects on any single error).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      const assets = [
        OFFLINE_PAGE,
        '/manifest.json',
        '/icons/icon-192.svg',
        '/icons/icon-512.svg',
      ]
      return Promise.allSettled(
        assets.map((url) =>
          cache.add(url).catch((err) =>
            console.warn(`[SW] Precache miss for ${url}:`, err),
          ),
        ),
      )
    }),
  )
  // Take control immediately — no need to wait for old SW clients to close
  self.skipWaiting()
})

// ── Activate: delete any caches from previous versions ───────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (k) =>
              k.startsWith('uma-itsm-') &&
              k !== STATIC_CACHE &&
              k !== PAGES_CACHE,
          )
          .map((k) => caches.delete(k)),
      ),
    ),
  )
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== location.origin) return

  // ── 1. API calls — always network, never cache ────────────────────────────
  if (url.pathname.startsWith('/api/')) {
    // Let it fall through; no event.respondWith = default browser behaviour
    return
  }

  // ── 2. RSC / server component data fetches ────────────────────────────────
  // Next.js 16 App Router sends background fetches for server component payloads.
  // These have Accept: text/x-component or a _rsc= query param.
  // We NEVER cache these (stale RSC payloads break hydration) and we let them
  // fail naturally so the global-error boundary in the app handles it.
  const acceptHeader = request.headers.get('Accept') ?? ''
  const isRsc =
    acceptHeader.includes('text/x-component') ||
    url.searchParams.has('_rsc') ||
    url.pathname.startsWith('/_next/data/')

  if (isRsc) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'offline', message: 'No network connection.' }),
          {
            status: 503,
            headers: {
              'Content-Type': 'text/x-component',
              'X-Offline': 'true',
            },
          },
        ),
      ),
    )
    return
  }

  // ── 3. Next.js static build chunks — Cache First ──────────────────────────
  // All /_next/static/ URLs include a content hash in the path, so a new build
  // always busts the cache naturally. Safe to cache permanently.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              caches
                .open(STATIC_CACHE)
                .then((c) => c.put(request, response.clone()))
            }
            return response
          }),
      ),
    )
    return
  }

  // ── 4. Static files — Cache First ─────────────────────────────────────────
  if (/\.(svg|png|jpg|jpeg|ico|webp|woff2?|ttf|css|js)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              caches
                .open(STATIC_CACHE)
                .then((c) => c.put(request, response.clone()))
            }
            return response
          }),
      ),
    )
    return
  }

  // ── 5. HTML navigation — Network First → cache → offline.html ────────────
  // Covers full-page loads (address bar, back/forward, hard refresh).
  // We always fall back to offline.html on ANY network failure, regardless of
  // navigator.onLine — that value is unreliable on flaky WiFi / captive portals.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            // Cache the freshly-loaded page for next time
            caches
              .open(PAGES_CACHE)
              .then((c) => c.put(request, response.clone()))
          }
          return response
        })
        .catch(() =>
          // Try the page from cache first, then fall back to the static offline page
          caches
            .match(request)
            .then(
              (cached) =>
                cached ??
                caches.match(OFFLINE_PAGE).then(
                  (offlinePage) =>
                    offlinePage ??
                    new Response(
                      '<!doctype html><html><body style="font-family:sans-serif;text-align:center;padding:3rem"><h2>You are offline</h2><p>Please reconnect and refresh.</p><button onclick="location.reload()">Retry</button></body></html>',
                      { status: 503, headers: { 'Content-Type': 'text/html' } },
                    ),
                ),
            ),
        ),
    )
    return
  }
})
