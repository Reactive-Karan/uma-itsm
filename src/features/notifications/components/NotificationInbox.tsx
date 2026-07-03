'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, Ticket, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/ticket/sla'
import { useSessionStore } from '@/stores/session.store'
import type { UserRole } from '@/types/user.types'

const TICKET_PATH_BY_ROLE: Record<UserRole, string> = {
  requester: '/requester/tickets',
  dept_user: '/dept-user/tickets',
  manager: '/dept-user/tickets',
  super_admin: '/dept-user/tickets',
}

interface Notification {
  id: string
  notification_type: string
  subject: string
  ticket_id: string | null
  read_at: string | null
  created_at: string
  status: string
}

const TYPE_ICONS: Record<string, string> = {
  ticket_received:       '📥',
  ticket_acknowledged:   '✅',
  ticket_in_progress:    '🔄',
  ticket_resolved:       '🎉',
  ticket_auto_closed:    '🔒',
  ticket_escalated_mgr:  '🚨',
  ticket_escalated_req:  '⚠️',
  pending_requester:     '❓',
  manager_inaction:      '⏰',
  escalation_loop:       '🔴',
  default:               '🔔',
}

export function NotificationInbox() {
  const role = useSessionStore((s) => s.profile?.role ?? 'requester')
  const ticketBasePath = TICKET_PATH_BY_ROLE[role]
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/notifications/inbox')
      if (!res.ok) return
      const { data } = await res.json()
      setNotifications(data?.notifications ?? [])
      setUnreadCount(data?.unreadCount ?? 0)
    } catch { /* silent */ } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch on mount and every 60s
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click or touch (mobile-safe)
  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      const target = (e as TouchEvent).touches
        ? (e as TouchEvent).touches[0]?.target
        : (e as MouseEvent).target
      if (
        panelRef.current && !panelRef.current.contains(target as Node) &&
        buttonRef.current && !buttonRef.current.contains(target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [])

  async function markAsRead(id: string) {
    await fetch(`/api/notifications/inbox/${id}/read`, { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read_at)
    await Promise.all(unread.map((n) => fetch(`/api/notifications/inbox/${n.id}/read`, { method: 'PATCH' })))
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    setUnreadCount(0)
  }

  return (
    <div className="relative">
      {/* Bell button — 44px touch target on mobile for PWA compliance */}
      <button
        ref={buttonRef}
        onClick={() => { setOpen((o) => !o); if (!open) fetchNotifications() }}
        className="relative flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Inbox panel
          Mobile:  fixed to viewport, full-width with safe gutters, pinned below nav (top-16)
          Desktop: absolute dropdown anchored to the bell button (right-0 top-10 w-80)
      */}
      {open && (
        <div
          ref={panelRef}
          className={[
            'z-50 rounded-xl border border-slate-200 bg-white shadow-xl',
            // Mobile: fixed so it never clips outside the viewport
            'fixed left-2 right-2 top-[60px]',
            // Desktop: classic dropdown
            'md:absolute md:left-auto md:right-0 md:top-10 md:w-80',
          ].join(' ')}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[10px] text-[#1E40AF] hover:underline"
                >
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="ml-2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List — constrained height so it never overflows the screen on any device */}
          <div className="max-h-[55vh] md:max-h-80 overflow-y-auto divide-y divide-slate-100">
            {isLoading && (
              <div className="py-6 text-center text-xs text-slate-400">Loading…</div>
            )}
            {!isLoading && notifications.length === 0 && (
              <div className="py-8 text-center">
                <Bell className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-400 mt-2">No notifications yet</p>
              </div>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 transition-colors',
                  n.read_at ? '' : 'bg-blue-50',
                )}
              >
                {/* Mark-as-read button wraps icon + text */}
                <button
                  type="button"
                  className="flex items-start gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                  onClick={() => { if (!n.read_at) markAsRead(n.id) }}
                  disabled={!!n.read_at}
                >
                  <span className="text-lg shrink-0 mt-0.5">
                    {TYPE_ICONS[n.notification_type] ?? TYPE_ICONS.default}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs leading-snug wrap-break-word', n.read_at ? 'text-slate-700' : 'font-semibold text-slate-900')}>
                      {n.subject}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
                {n.ticket_id && (
                  <Link
                    href={`${ticketBasePath}/${n.ticket_id}`}
                    className="shrink-0 mt-0.5"
                  >
                    <Ticket className="h-3.5 w-3.5 text-slate-400 hover:text-[#1E40AF]" />
                  </Link>
                )}
                {n.read_at ? null : (
                  <div className="h-2 w-2 rounded-full bg-[#1E40AF] shrink-0 mt-1.5" />
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2 text-center">
              <p className="text-[10px] text-slate-400">Last 30 days · {notifications.length} total</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
