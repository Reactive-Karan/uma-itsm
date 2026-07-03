import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import { PriorityBadge } from './PriorityBadge'
import { timeAgo } from '@/lib/ticket/sla'
import { cn } from '@/lib/utils'
import { Clock, User } from 'lucide-react'
import type { TicketWithRequester } from '@/services/ticket.service'

interface TicketCardProps {
  ticket: TicketWithRequester
  href: string
  className?: string
}

const TYPE_LABELS: Record<string, string> = {
  it_service: 'IT Service',
  data_service: 'Data Service',
}
const SUBTYPE_LABELS: Record<string, string> = {
  hardware: 'Hardware', software: 'Software',
  analysis: 'Analysis', discrepancy: 'Discrepancy', issues: 'Issues',
}

export function TicketCard({ ticket, href, className }: TicketCardProps) {
  const isOverdue =
    ticket.sla_ack_deadline &&
    ticket.status === 'new' &&
    new Date(ticket.sla_ack_deadline) < new Date()

  return (
    <Link
      href={href}
      className={cn(
        'block px-5 py-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400 flex-shrink-0">
              {ticket.ticket_number}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              {TYPE_LABELS[ticket.request_type]} — {SUBTYPE_LABELS[ticket.sub_type]}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm font-medium text-slate-900 truncate leading-snug">
            {ticket.title}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(ticket.created_at)}
            </span>
            {ticket.assignee && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {ticket.assignee.full_name}
              </span>
            )}
            {!ticket.assignee && (
              <span className="text-amber-500 font-medium">Unassigned</span>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} showIcon />
          {isOverdue && (
            <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
              SLA Overdue
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
