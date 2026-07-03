import { cn } from '@/lib/utils'
import type { TicketStatus } from '@/types/database.types'

interface StatusBadgeProps {
  status: TicketStatus
  className?: string
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; classes: string }> = {
  new:               { label: 'New',               classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  acknowledged:      { label: 'Acknowledged',      classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress:       { label: 'In Progress',       classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  pending_requester: { label: 'Pending You',       classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  escalated:         { label: 'Escalated',         classes: 'bg-red-50 text-red-700 border-red-200' },
  resolved:          { label: 'Resolved',          classes: 'bg-green-50 text-green-700 border-green-200' },
  closed:            { label: 'Closed',            classes: 'bg-slate-50 text-slate-500 border-slate-200' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, classes } = STATUS_CONFIG[status] ?? STATUS_CONFIG.new

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        classes,
        className,
      )}
    >
      {label}
    </span>
  )
}
