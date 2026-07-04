'use client'

import { useEffect, useState } from 'react'

/**
 * Global error boundary for the App Router.
 * Catches unhandled errors including RSC fetch failures that occur when
 * the user loses network while navigating between pages.
 *
 * Must be a Client Component and must include <html>/<body> since it
 * replaces the root layout when triggered.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    // Detect whether the error is network-related
    const offline =
      !navigator.onLine ||
      error.message?.toLowerCase().includes('fetch') ||
      error.message?.toLowerCase().includes('network') ||
      error.message?.toLowerCase().includes('failed to fetch') ||
      error.message?.toLowerCase().includes('load failed')

    setIsOffline(offline)

    // Auto-reset when connection is restored
    function handleOnline() {
      setIsOffline(false)
      reset()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [error, reset])

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#1E40AF" />
        <title>{isOffline ? 'You are offline' : 'Something went wrong'} — UMA ITSM</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
            background: #F8FAFC;
            min-height: 100dvh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
          }
        `}</style>
      </head>
      <body>
        {isOffline ? <OfflineView reset={reset} /> : <ErrorView reset={reset} digest={error.digest} />}
      </body>
    </html>
  )
}

function OfflineView({ reset }: { reset: () => void }) {
  return (
    <div style={styles.card}>
      <div style={styles.iconWrap}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <circle cx="12" cy="20" r="1" fill="#fff" stroke="none" />
        </svg>
      </div>
      <h1 style={styles.heading}>You are offline</h1>
      <p style={styles.subtitle}>
        UMA ITSM needs an active connection to load. Please reconnect and try again.
      </p>
      <div style={styles.infoBox}>
        <p style={styles.infoTitle}>While offline you can still:</p>
        <ul style={styles.list}>
          <li style={styles.listItem}><span style={{ color: '#22C55E' }}>✓</span><span>Draft a ticket — saved locally until reconnected</span></li>
          <li style={styles.listItem}><span style={{ color: '#22C55E' }}>✓</span><span>View recently cached pages</span></li>
          <li style={styles.listItem}><span style={{ color: '#CBD5E1' }}>✗</span><span style={{ color: '#94A3B8' }}>Submit or update tickets (requires connection)</span></li>
        </ul>
      </div>
      <button style={styles.btn} onClick={reset}>Try Again</button>
      <p style={styles.footer}>Reconnecting automatically when online…</p>
    </div>
  )
}

function ErrorView({ reset, digest }: { reset: () => void; digest?: string }) {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.iconWrap, background: '#DC2626' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 style={styles.heading}>Something went wrong</h1>
      <p style={styles.subtitle}>
        An unexpected error occurred. Please try again or contact your IT administrator if the problem persists.
      </p>
      {digest && (
        <p style={{ ...styles.footer, marginBottom: '1rem', fontFamily: 'monospace' }}>
          Error ID: {digest}
        </p>
      )}
      <button style={styles.btn} onClick={reset}>Try Again</button>
      <button
        style={{ ...styles.btn, background: '#fff', color: '#1E40AF', border: '1px solid #1E40AF', marginTop: '0.5rem' }}
        onClick={() => { window.location.href = '/' }}
      >
        Go to Home
      </button>
    </div>
  )
}

const styles = {
  card: {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: '1rem',
    padding: '2.5rem 2rem',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center' as const,
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.07)',
  },
  iconWrap: {
    width: '72px',
    height: '72px',
    background: '#1E40AF',
    borderRadius: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.5rem',
  },
  heading: {
    fontSize: '1.375rem',
    fontWeight: 700,
    color: '#0F172A',
    marginBottom: '0.625rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#64748B',
    lineHeight: 1.6,
    marginBottom: '1.5rem',
  },
  infoBox: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '0.75rem',
    padding: '1rem 1.25rem',
    textAlign: 'left' as const,
    marginBottom: '1.5rem',
  },
  infoTitle: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: '#475569',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: '0.75rem',
  },
  list: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  listItem: {
    display: 'flex',
    gap: '0.5rem',
    fontSize: '0.8125rem',
    color: '#475569',
    lineHeight: 1.5,
  },
  btn: {
    display: 'block',
    width: '100%',
    padding: '0.625rem 1rem',
    background: '#1E40AF',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: '0',
  },
  footer: {
    fontSize: '0.6875rem',
    color: '#94A3B8',
    marginTop: '1rem',
  },
}
