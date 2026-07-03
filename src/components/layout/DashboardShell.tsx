'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { GlobalNav } from '@/components/layout/GlobalNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { useSessionStore } from '@/stores/session.store'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/types/user.types'

interface DashboardShellProps {
  children: React.ReactNode
  initialProfile?: UserProfile | null
}

/**
 * Root shell for all authenticated pages.
 * Manages the sidebar toggle state and hydrates the session store
 * from the server-resolved initial profile.
 */
export function DashboardShell({ children, initialProfile }: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()
  const setProfile = useSessionStore((s) => s.setProfile)
  const setLoading = useSessionStore((s) => s.setLoading)

  // Hydrate session store from server-resolved profile
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile)
    } else {
      // Fallback: load profile client-side if not passed from server
      loadProfileClientSide()
    }
  }, [initialProfile])

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  async function loadProfileClientSide() {
    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setProfile(null)
      return
    }
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .single()
    setProfile(profile ?? null)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <GlobalNav onMenuClick={() => setIsSidebarOpen(true)} />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main content — offset for fixed navbar (56px) and desktop sidebar (256px) */}
      <main className="pt-14 md:pl-64">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
