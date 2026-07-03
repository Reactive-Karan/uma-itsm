'use client'

/**
 * Ticket Draft Store
 *
 * Persists the in-progress ticket submission form to localStorage so that:
 * - If the session expires before submission, the draft is recovered on next login
 * - If the user goes offline mid-draft, their work is not lost
 * - If the browser tab is accidentally closed, the draft survives
 *
 * The draft is cleared automatically after a successful ticket submission.
 * It expires after 24 hours to prevent stale drafts surfacing.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RequestType, SubType, Priority } from '@/types/database.types'

export interface TicketDraft {
  request_type: RequestType | null
  sub_type: SubType | null
  title: string
  description: string
  priority: Priority
  savedAt: number | null
}

interface DraftStore {
  draft: TicketDraft
  setDraft: (partial: Partial<Omit<TicketDraft, 'savedAt'>>) => void
  clearDraft: () => void
  hasDraft: () => boolean
}

const BLANK_DRAFT: TicketDraft = {
  request_type: null,
  sub_type: null,
  title: '',
  description: '',
  priority: 'medium',
  savedAt: null,
}

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      draft: BLANK_DRAFT,

      setDraft: (partial) => {
        set((state) => ({
          draft: {
            ...state.draft,
            ...partial,
            savedAt: Date.now(),
          },
        }))
      },

      clearDraft: () => {
        set({ draft: BLANK_DRAFT })
      },

      hasDraft: () => {
        const { draft } = get()
        if (!draft.savedAt) return false
        // Expire drafts older than 24 hours
        if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
          set({ draft: BLANK_DRAFT })
          return false
        }
        return !!(draft.title || draft.description)
      },
    }),
    {
      name: 'uma-itsm-ticket-draft',
      // Only persist the draft — not the function references
      partialize: (state) => ({ draft: state.draft }),
    },
  ),
)
