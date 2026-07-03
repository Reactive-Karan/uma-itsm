import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'
import type { UserProfile } from '@/types/user.types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !profile.is_active) redirect('/login?error=unauthorized')
  if (profile.role !== 'super_admin') redirect('/unauthorized')

  return (
    <DashboardShell initialProfile={profile as UserProfile}>
      {children}
    </DashboardShell>
  )
}
