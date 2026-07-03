'use client'

import { useEffect } from 'react'

/**
 * Registers the Next.js PWA service worker on mount.
 * Must be a Client Component — placed in the root layout body.
 *
 * @ducanh2912/next-pwa generates /sw.js automatically during `npm run build`.
 * In development mode, PWA is disabled in next.config.ts so this is a no-op.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service worker registered:', registration.scope)
        })
        .catch((error) => {
          console.error('[PWA] Service worker registration failed:', error)
        })
    }
  }, [])

  return null
}
