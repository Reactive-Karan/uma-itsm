'use client'

/**
 * Offline fallback page.
 * Served by the service worker when the user is offline and the requested
 * page is not in the cache.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-2xl bg-[#1E40AF] flex items-center justify-center shadow-lg">
            <span className="text-white text-4xl font-bold">U</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">You are offline</h1>
        <p className="text-slate-500 mt-3 text-sm leading-relaxed">
          It looks like you have lost your internet connection. UMA ITSM requires
          an active connection to submit and manage service requests.
        </p>

        {/* What you can still do */}
        <div className="mt-6 bg-white rounded-xl border border-slate-200 px-5 py-4 text-left">
          <p className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">
            While you are offline you can still:
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Draft a new ticket — it will be saved locally</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>View recently cached pages and ticket details</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-300 mt-0.5">✗</span>
              <span className="text-slate-400">Submit tickets or add comments (requires connection)</span>
            </li>
          </ul>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-6 w-full rounded-lg bg-[#1E40AF] text-white px-4 py-2.5 text-sm font-medium hover:bg-[#1e3a8a] transition-colors"
        >
          Try Again
        </button>

        <p className="text-xs text-slate-400 mt-4">
          UMA ITSM · Reconnecting automatically when online
        </p>
      </div>
    </div>
  )
}
