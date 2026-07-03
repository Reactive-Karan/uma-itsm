import { StatusBadge } from './StatusBadge'
import { formatDateTime } from '@/lib/ticket/sla'
import { cn } from '@/lib/utils'
import { MessageSquare, ArrowRight, Lock } from 'lucide-react'
import type { TicketStatus } from '@/types/database.types'

type TimelineEntry =
  | {
      type: 'status'
      id: string
      from_status: TicketStatus | null
      to_status: TicketStatus
      reason: string | null
      created_at: string
      actor: { id: string; full_name: string; role: string } | null
    }
  | {
      type: 'comment'
      id: string
      body: string
      is_internal: boolean
      created_at: string
      author: { id: string; full_name: string; role: string } | null
    }

interface ActivityTimelineProps {
  entries: TimelineEntry[]
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ActivityTimeline({ entries }: ActivityTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center">
        <MessageSquare className="h-8 w-8 text-slate-300 mx-auto" />
        <p className="text-sm text-slate-400 mt-2">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex gap-3">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold mt-1',
                entry.type === 'status'
                  ? 'bg-[#EFF6FF] text-[#1E40AF] border border-blue-200'
                  : entry.type === 'comment' && entry.is_internal
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-100 text-slate-600',
              )}
            >
              {entry.type === 'status'
                ? <ArrowRight className="h-3.5 w-3.5" />
                : entry.type === 'comment' && entry.is_internal
                ? <Lock className="h-3 w-3" />
                : entry.type === 'comment' && entry.author
                ? initials(entry.author.full_name ?? '?')
                : <MessageSquare className="h-3.5 w-3.5" />}
            </div>
            {index < entries.length - 1 && (
              <div className="w-px flex-1 bg-slate-200 my-1 min-h-[16px]" />
            )}
          </div>

          {/* Content */}
          <div className="pb-5 flex-1 min-w-0">
            {entry.type === 'status' ? (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {entry.from_status ? (
                  <>
                    <StatusBadge status={entry.from_status} />
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </>
                ) : null}
                <StatusBadge status={entry.to_status} />
                <span className="text-xs text-slate-400">
                  by {entry.actor?.full_name ?? 'System'}
                </span>
                {entry.reason && (
                  <span className="text-xs text-slate-500 italic">— {entry.reason}</span>
                )}
                <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
                  {formatDateTime(entry.created_at)}
                </span>
              </div>
            ) : (
              <div
                className={cn(
                  'rounded-lg border p-3 mt-0.5',
                  entry.is_internal
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-white border-slate-200',
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {entry.author?.full_name ?? 'Unknown'}
                    </span>
                    {entry.is_internal && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-200">
                        <Lock className="h-2.5 w-2.5" /> Internal Note
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {formatDateTime(entry.created_at)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {entry.body}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
