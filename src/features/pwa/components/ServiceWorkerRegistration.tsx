'use client'

import { useEffect } from 'react'

/**
 * Registers /public/sw.js on mount.
 * Runs in both production and development so the offline flow can be
 * tested locally with `next dev` (Chrome DevTools → Application → Service Workers).
 *
 * The SW is re-registered on every mount — the browser deduplicates automatically
 * and only installs a new worker when the sw.js byte content has changed.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[PWA] Service worker registered (dev):', registration.scope)
        }
      })
      .catch((error) => {
        console.error('[PWA] Service worker registration failed:', error)
      })
  }, [])

  return null
}
