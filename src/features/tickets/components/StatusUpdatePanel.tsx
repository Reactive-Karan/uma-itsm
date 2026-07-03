'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Loader2, ChevronDown } from 'lucide-react'
import type { TicketStatus } from '@/types/database.types'

interface StatusUpdatePanelProps {
  ticketId: string
  currentStatus: TicketStatus
  className?: string
}

const TRANSITION_OPTIONS: { from: TicketStatus[]; to: TicketStatus; label: string; requiresNote?: boolean }[] = [
  { from: ['acknowledged', 'escalated'], to: 'in_progress', label: 'Mark In Progress' },
  { from: ['acknowledged', 'in_progress'], to: 'pending_requester', label: 'Request More Info (Pause SLA)' },
  { from: ['pending_requester'], to: 'in_progress', label: 'Resume — Continue Working' },
  { from: ['acknowledged', 'in_progress', 'escalated', 'pending_requester'], to: 'resolved', label: 'Mark as Resolved', requiresNote: true },
]

export function StatusUpdatePanel({ ticketId, currentStatus, className }: StatusUpdatePanelProps) {
  const router = useRouter()
  const [selectedTo, setSelectedTo] = useState<TicketStatus | ''>('')
  const [reason, setReason] = useState('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableTransitions = TRANSITION_OPTIONS.filter((t) =>
    t.from.includes(currentStatus),
  )

  if (!availableTransitions.length) return null

  const selected = availableTransitions.find((t) => t.to === selectedTo)

  async function handleUpdate() {
    if (!selectedTo) return
    if (selected?.requiresNote && resolutionNote.length < 10) {
      setError('Resolution note must be at least 10 characters.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedTo,
          reason: reason || undefined,
          resolution_note: selected?.requiresNote ? resolutionNote : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message ?? 'Failed to update status.')
        return
      }
      setSelectedTo('')
      setReason('')
      setResolutionNote('')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          Update Status
        </label>
        <div className="relative">
          <select
            value={selectedTo}
            onChange={(e) => { setSelectedTo(e.target.value as TicketStatus); setError(null) }}
            className="w-full appearance-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 bg-white pr-8 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
          >
            <option value="">— Select transition —</option>
            {availableTransitions.map((t) => (
              <option key={t.to} value={t.to}>{t.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {selectedTo && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Reason <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Brief note about this status change…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
            />
          </div>

          {selected?.requiresNote && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Resolution Note <span className="text-red-500">*</span>
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Describe the resolution clearly. This will be visible to the requester."
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
              />
              <p className="text-xs text-slate-400 mt-0.5">{resolutionNote.length}/2000</p>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleUpdate}
            disabled={isSubmitting || !selectedTo}
            className={cn(
              buttonVariants({ size: 'sm' }),
              'bg-[#1E40AF] hover:bg-[#1e3a8a] gap-2 w-full',
              isSubmitting && 'opacity-60 cursor-not-allowed',
            )}
          >
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {isSubmitting ? 'Updating…' : 'Apply Status Change'}
          </button>
        </>
      )}
    </div>
  )
}
