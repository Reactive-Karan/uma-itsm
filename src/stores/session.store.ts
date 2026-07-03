'use client'

import { create } from 'zustand'
import type { UserProfile } from '@/types/user.types'

interface SessionState {
  profile: UserProfile | null
  isLoading: boolean
  setProfile: (profile: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  clearSession: () => void
}

/**
 * Client-side session store — caches the authenticated user's profile
 * so components can access the current user without re-fetching.
 *
 * Use the `useSessionUser` hook from features/auth to read this store.
 * The store is populated by the root layout on mount.
 */
export const useSessionStore = create<SessionState>((set) => ({
  profile: null,
  isLoading: true,
  setProfile: (profile) => set({ profile, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clearSession: () => set({ profile: null, isLoading: false }),
}))
