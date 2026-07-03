import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegistration } from '@/features/pwa/components/ServiceWorkerRegistration'
import { PwaInstallBanner } from '@/features/pwa/components/PwaInstallBanner'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'UMA ITSM',
    template: '%s — UMA ITSM',
  },
  description:
    'UMA Group IT Service Management — centralised support for ten African regional entities.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'UMA ITSM',
  },
  other: {
    // Disable browser-native install prompts on iOS — handled by PwaInstallBanner
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#1E40AF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="h-full antialiased font-sans bg-[#F8FAFC] text-slate-900">
        <ServiceWorkerRegistration />
        {children}
        <PwaInstallBanner />
      </body>
    </html>
  )
}
