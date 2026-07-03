'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2 } from 'lucide-react'

interface AcknowledgeButtonProps {
  ticketId: string
  className?: string
}

export function AcknowledgeButton({ ticketId, className }: AcknowledgeButtonProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAcknowledge() {
    if (!confirm('Acknowledge this ticket? The requester will be notified and the resolution SLA clock will start.')) return

    setIsPending(true)
    setError(null)

    try {
      const res = await fetch(`/api/tickets/${ticketId}/acknowledge`, { method: 'PATCH' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message ?? 'Failed to acknowledge.')
        return
      }
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleAcknowledge}
        disabled={isPending}
        className={cn(
          buttonVariants(),
          'bg-[#1E40AF] hover:bg-[#1e3a8a] gap-2',
          isPending && 'opacity-60 cursor-not-allowed',
          className,
        )}
      >
        {isPending
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Acknowledging…</>
          : <><CheckCircle2 className="h-4 w-4" /> Acknowledge</>}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
