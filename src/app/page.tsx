import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type UserRole, ROLE_DASHBOARD_PATHS } from '@/types/user.types'

/**
 * Root page — smart redirect.
 * Authenticated users go to their role dashboard.
 * Unauthenticated users go to /login.
 * Middleware handles protection, this page handles post-auth routing.
 */
export default async function RootPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (!profile) {
    redirect('/login?error=unauthorized')
  }

  redirect(ROLE_DASHBOARD_PATHS[profile.role as UserRole])
}
