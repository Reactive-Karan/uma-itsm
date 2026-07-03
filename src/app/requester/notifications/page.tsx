'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bell, CheckCheck, Ticket, RefreshCw, Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/ticket/sla'

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
  ticket_received:      '📥',
  ticket_acknowledged:  '✅',
  ticket_in_progress:   '🔄',
  ticket_resolved:      '🎉',
  ticket_auto_closed:   '🔒',
  ticket_escalated_mgr: '🚨',
  ticket_escalated_req: '⚠️',
  pending_requester:    '❓',
  manager_inaction:     '⏰',
  escalation_loop:      '🔴',
  default:              '🔔',
}

type FilterTab = 'all' | 'unread' | 'read'

export default function RequesterNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/notifications/inbox')
      if (!res.ok) return
      const { data } = await res.json()
      setNotifications(data?.notifications ?? [])
    } catch { /* silent */ } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  async function markAsRead(id: string) {
    await fetch(`/api/notifications/inbox/${id}/read`, { method: 'PATCH' })
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n),
    )
  }

  async function markAllRead() {
    setMarkingAll(true)
    const unread = notifications.filter((n) => !n.read_at)
    await Promise.all(unread.map((n) => fetch(`/api/notifications/inbox/${n.id}/read`, { method: 'PATCH' })))
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    setMarkingAll(false)
  }

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.read_at
    if (filter === 'read') return !!n.read_at
    return true
  })

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const showEmpty = filtered.length === 0 && !isLoading

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all', label: `All (${notifications.length})` },
    { id: 'unread', label: `Unread (${unreadCount})` },
    { id: 'read', label: `Read (${notifications.length - unreadCount})` },
  ]

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Your service desk updates from the last 30 days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E40AF] text-white text-xs font-medium hover:bg-[#1e3a8a] transition-colors disabled:opacity-60"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {markingAll ? 'Marking…' : `Mark all read (${unreadCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              filter === tab.id
                ? 'border-[#1E40AF] text-[#1E40AF]'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {tab.id === 'all' && <Filter className="h-3.5 w-3.5" />}
            {tab.label}
            {tab.id === 'unread' && unreadCount > 0 && (
              <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-0.5">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading && (
          <div className="py-16 text-center">
            <RefreshCw className="h-6 w-6 text-slate-300 mx-auto animate-spin" />
            <p className="text-sm text-slate-400 mt-3">Loading notifications…</p>
          </div>
        )}

        {showEmpty && (
          <div className="py-16 text-center">
            <Bell className="h-10 w-10 text-slate-200 mx-auto" />
            <p className="text-slate-500 text-sm font-medium mt-3">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications found'}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              {filter === 'unread'
                ? 'You are all caught up.'
                : 'You will be notified here when your tickets are updated.'}
            </p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="divide-y divide-slate-100">
            {filtered.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-4 px-5 py-4 transition-colors',
                  n.read_at ? 'bg-white' : 'bg-blue-50/60',
                )}
              >
                {/* Unread dot */}
                <div className="mt-1.5 shrink-0">
                  <div className={n.read_at ? 'h-2 w-2 rounded-full bg-transparent' : 'h-2 w-2 rounded-full bg-[#1E40AF]'} />
                </div>

                {/* Type icon */}
                <span className="text-xl shrink-0 mt-0.5 leading-none">
                  {TYPE_ICONS[n.notification_type] ?? TYPE_ICONS.default}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm leading-snug wrap-break-word',
                    n.read_at ? 'text-slate-700' : 'font-semibold text-slate-900',
                  )}>
                    {n.subject}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  {n.ticket_id && (
                    <Link
                      href={`/requester/tickets/${n.ticket_id}`}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:text-[#1E40AF] transition-colors"
                    >
                      <Ticket className="h-3.5 w-3.5" />
                      View Ticket
                    </Link>
                  )}
                  {!n.read_at && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 hover:text-[#1E40AF] transition-colors"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {!isLoading && notifications.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing last 30 days · {notifications.length} total notifications
            </p>
            <p className="text-xs text-slate-400">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
