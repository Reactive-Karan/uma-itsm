/**
 * UMA ITSM — Service Worker
 * Caching strategy:
 *   - Static assets (JS, CSS, images, fonts)  → Cache First
 *   - HTML navigation pages                    → Network First (offline fallback)
 *   - API calls (/api/*)                       → Network Only  (never serve stale data)
 */

const CACHE_VERSION = 'uma-itsm-v2'
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const PAGES_CACHE   = `${CACHE_VERSION}-pages`
const OFFLINE_URL   = '/offline'

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
]

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  )
  // Take control immediately — don't wait for old SW to become inactive
  self.skipWaiting()
})

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('uma-itsm-') && k !== STATIC_CACHE && k !== PAGES_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  // Claim all open clients so they use this SW immediately
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== location.origin) return

  // API calls — always go to network, never cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // Next.js internals — Network First so JS module chunks are never stale.
  // /_next/static/ assets have content hashes in production, so they are
  // safe to cache; but dev-mode chunks share the same URL across builds and
  // MUST be re-fetched to avoid "module factory not available" crashes when
  // source files change. Caching them as a fallback is still fine for offline.
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Static assets (images, fonts, icons, manifests) — Cache First
  if (/\.(svg|png|jpg|jpeg|ico|woff2?|ttf|css|js)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached ?? fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone))
          }
          return response
        })
      )
    )
    return
  }

  // HTML navigation — Network First, fall back to cache, then offline page
  if (request.mode === 'navigate' || request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(PAGES_CACHE).then((c) => c.put(request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached
            // Only show the offline page when the device is genuinely offline.
            // If the device is online but the server failed (cold-start, transient
            // error, auth-redirect loop), return a 503 and let the browser retry.
            if (!navigator.onLine) return caches.match(OFFLINE_URL)
            return new Response(
              '<!doctype html><html><body><p>Service temporarily unavailable. Please refresh.</p></body></html>',
              { status: 503, headers: { 'Content-Type': 'text/html' } },
            )
          })
        )
    )
    return
  }
})
