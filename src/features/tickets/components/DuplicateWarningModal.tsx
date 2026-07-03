'use client'

import { AlertTriangle, ExternalLink, X } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TicketStatus } from '@/types/database.types'

interface SimilarTicket {
  ticket_id: string
  ticket_number: string
  title: string
  status: TicketStatus
  rank: number
}

interface DuplicateWarningModalProps {
  duplicates: SimilarTicket[]
  onProceed: () => void
  onDismiss: () => void
}

/**
 * Shown just before ticket submission when similar open tickets are found.
 * Lets the requester decide to:
 *   a) Watch an existing ticket (navigate to it)
 *   b) Submit anyway (override — logged in audit trail)
 */
export function DuplicateWarningModal({
  duplicates,
  onProceed,
  onDismiss,
}: DuplicateWarningModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900">Similar tickets found</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              We found {duplicates.length} open ticket{duplicates.length > 1 ? 's' : ''} that may
              describe the same issue. Consider watching one of these instead of creating a duplicate.
            </p>
          </div>
          <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Similar tickets list */}
        <div className="px-6 pb-4 space-y-2">
          {duplicates.map((t) => (
            <div
              key={t.ticket_id}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-[#1E40AF] hover:bg-[#EFF6FF] transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-slate-400">{t.ticket_number}</span>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
              </div>
              <a
                href={`/requester/tickets/${t.ticket_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#1E40AF] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onProceed}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'flex-1 text-sm',
            )}
          >
            Submit anyway
          </button>
          <button
            onClick={onDismiss}
            className={cn(
              buttonVariants(),
              'flex-1 bg-[#1E40AF] hover:bg-[#1e3a8a] text-sm',
            )}
          >
            Go back and review
          </button>
        </div>
      </div>
    </div>
  )
}
