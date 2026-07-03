'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Loader2, Send } from 'lucide-react'

interface CommentComposerProps {
  ticketId: string
  canAddInternal?: boolean
}

export function CommentComposer({ ticketId, canAddInternal = false }: CommentComposerProps) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), is_internal: isInternal }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message ?? 'Failed to add comment.')
        return
      }

      setBody('')
      setIsInternal(false)
      router.refresh() // re-render the server component to show new comment
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {canAddInternal && (
        <div className="flex gap-3">
          {[
            { value: false, label: 'Public Reply' },
            { value: true,  label: 'Internal Note' },
          ].map(({ value, label }) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setIsInternal(value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                isInternal === value
                  ? value
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-[#EFF6FF] border-blue-300 text-[#1E40AF]'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          isInternal
            ? 'Add an internal note (only visible to support staff)…'
            : 'Add a reply visible to the requester…'
        }
        rows={3}
        maxLength={5000}
        className={cn(
          'w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 resize-none',
          'focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent',
          isInternal ? 'border-amber-300 bg-amber-50' : 'border-slate-300 bg-white',
        )}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{body.length}/5000</p>
        <button
          type="submit"
          disabled={isSubmitting || !body.trim()}
          className={cn(
            buttonVariants({ size: 'sm' }),
            'gap-2 bg-[#1E40AF] hover:bg-[#1e3a8a]',
            (isSubmitting || !body.trim()) && 'opacity-50 cursor-not-allowed',
          )}
        >
          {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {isSubmitting ? 'Posting…' : 'Post Reply'}
        </button>
      </div>
    </form>
  )
}
