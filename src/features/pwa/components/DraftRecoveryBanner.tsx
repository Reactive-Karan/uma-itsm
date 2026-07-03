'use client'

import { useEffect, useState } from 'react'
import { useDraftStore } from '@/stores/ticket-draft.store'
import { FileText, X } from 'lucide-react'

/**
 * Shown at the top of the ticket submission page if a saved draft exists.
 * The draft is automatically loaded into the form (via the store hydration).
 * This banner just makes it visible to the user that their draft was restored.
 */
export function DraftRecoveryBanner() {
  const { hasDraft, clearDraft, draft } = useDraftStore()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(hasDraft())
  }, [hasDraft])

  if (!visible) return null

  const savedAt = draft.savedAt
    ? new Date(draft.savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-[#EFF6FF] border border-blue-200 rounded-lg">
      <FileText className="h-4 w-4 text-[#1E40AF] flex-shrink-0" />
      <p className="text-sm text-[#1E40AF] flex-1">
        <span className="font-semibold">Draft restored</span>
        {savedAt && <span className="font-normal text-blue-600"> · saved at {savedAt}</span>}
        {draft.title && <span className="font-normal text-blue-600"> · &ldquo;{draft.title.slice(0, 40)}{draft.title.length > 40 ? '…' : ''}&rdquo;</span>}
      </p>
      <button
        onClick={() => { clearDraft(); setVisible(false) }}
        className="text-blue-400 hover:text-blue-600 flex-shrink-0"
        aria-label="Discard draft"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
