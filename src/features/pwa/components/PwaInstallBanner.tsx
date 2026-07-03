'use client'

import { useEffect, useState } from 'react'
import { X, Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Shows a non-intrusive "Add to Home Screen" banner when the browser
 * fires the beforeinstallprompt event (Chrome, Edge, Android).
 *
 * On iOS Safari, shows a manual instruction since that browser does
 * not support the beforeinstallprompt event.
 *
 * Dismissed state is persisted in localStorage for 7 days.
 */
export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    // Don't show if already installed or recently dismissed
    if (isAppInstalled()) return
    if (wasDismissedRecently()) return

    const isIosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream: unknown }).MSStream
    const isInStandaloneMode =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches

    if (isInStandaloneMode) return // Already running as PWA

    if (isIosDevice) {
      setIsIos(true)
      setIsVisible(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setIsVisible(false)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    setIsVisible(false)
    localStorage.setItem('pwa-banner-dismissed', String(Date.now()))
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#1E40AF] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">U</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">Install UMA ITSM</p>
            {isIos ? (
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Tap <strong>Share</strong> then <strong>"Add to Home Screen"</strong> to install this app on your device.
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">
                Add to your home screen for faster access and offline support.
              </p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isIos && deferredPrompt && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#1E40AF] hover:bg-[#1e3a8a] text-white text-xs font-medium rounded-lg py-2 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Install App
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-lg py-2 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function wasDismissedRecently(): boolean {
  if (typeof window === 'undefined') return false
  const ts = localStorage.getItem('pwa-banner-dismissed')
  if (!ts) return false
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  return Date.now() - parseInt(ts, 10) < SEVEN_DAYS
}
