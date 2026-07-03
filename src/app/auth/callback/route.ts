import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { type UserRole, ROLE_DASHBOARD_PATHS } from '@/types/user.types'

/**
 * OAuth 2.0 callback handler.
 *
 * After the user authenticates with Google, Supabase redirects here with
 * an authorization code. This handler exchanges the code for a session,
 * loads the user's ITSM profile, and redirects to their role dashboard.
 *
 * Flow:
 *   Google → Supabase Auth → /auth/callback → role dashboard
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? ''
  const errorParam = searchParams.get('error')

  // Handle OAuth error returned from Google / Supabase
  if (errorParam) {
    console.error('[auth/callback] OAuth error:', errorParam)
    return NextResponse.redirect(`${origin}/login?error=oauth_error`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createClient()

  // Exchange authorization code for session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[auth/callback] Code exchange error:', exchangeError.message)
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`)
  }

  // Load ITSM user profile to determine redirect target
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('auth_id', user.id)
    .single()

  if (profileError || !profile) {
    // User authenticated via Google but no ITSM profile exists yet.
    // The fn_create_user_profile trigger should have created it — if missing,
    // the Super Admin needs to provision the account.
    console.error('[auth/callback] No ITSM profile found for user:', user.email)
    return NextResponse.redirect(`${origin}/login?error=unauthorized`)
  }

  if (!profile.is_active) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=unauthorized`)
  }

  // Use the 'next' param if it's a safe internal path, otherwise use role dashboard
  const isSafeRedirect = next.startsWith('/') && !next.startsWith('//')
  const redirectPath = isSafeRedirect ? next : ROLE_DASHBOARD_PATHS[profile.role as UserRole]

  return NextResponse.redirect(`${origin}${redirectPath}`)
}
