import type { Priority } from '@/types/database.types'

/**
 * SLA windows in calendar hours (Sprint 2 simplification).
 * Sprint 3 replaces this with full business-hours-aware calculation.
 */
export const SLA_ACK_HOURS = 4

export const SLA_RESOLUTION_HOURS: Record<Priority, number> = {
  high: 8,
  medium: 24,
  low: 72,
}

/** Compute the acknowledgment SLA deadline from the current time. */
export function calcAckDeadline(from: Date = new Date()): Date {
  return new Date(from.getTime() + SLA_ACK_HOURS * 60 * 60 * 1000)
}

/** Compute the resolution SLA deadline from the acknowledgment time. */
export function calcResDeadline(priority: Priority, from: Date = new Date()): Date {
  const hours = SLA_RESOLUTION_HOURS[priority]
  return new Date(from.getTime() + hours * 60 * 60 * 1000)
}

/**
 * Returns how much of the SLA window has elapsed as a percentage (0–100).
 * Used to drive progress bar colours in the UI.
 */
export function slaElapsedPercent(deadline: Date, createdAt: Date): number {
  const now = Date.now()
  const total = deadline.getTime() - createdAt.getTime()
  const elapsed = now - createdAt.getTime()
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
}

/**
 * Returns a human-readable countdown string for a deadline.
 * e.g. "2h 14m remaining" or "Overdue by 30m"
 */
export function slaCountdown(deadline: Date): { label: string; isBreached: boolean; isWarning: boolean } {
  const diffMs = deadline.getTime() - Date.now()
  const isBreached = diffMs < 0
  const absMs = Math.abs(diffMs)

  const hours = Math.floor(absMs / 3600000)
  const minutes = Math.floor((absMs % 3600000) / 60000)

  let label: string
  if (hours > 0) {
    label = `${hours}h ${minutes}m`
  } else {
    label = `${minutes}m`
  }

  const isWarning = !isBreached && diffMs < 2 * 3600000 // < 2h remaining

  return {
    label: isBreached ? `Overdue by ${label}` : `${label} remaining`,
    isBreached,
    isWarning,
  }
}

/** Format a date as a short relative string: "2 hours ago", "3 days ago" etc. */
export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Format a date/time for display: "3 Jul 2026, 14:32" */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
