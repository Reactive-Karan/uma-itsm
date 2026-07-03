import type { NextConfig } from 'next'

/**
 * PWA Note: @ducanh2912/next-pwa uses webpack plugins, which conflict with
 * Next.js 16's Turbopack default. PWA is instead implemented via a manually
 * authored service worker at /public/sw.js and registered in layout.tsx.
 */
const nextConfig: NextConfig = {
  turbopack: {},
}

export default nextConfig
