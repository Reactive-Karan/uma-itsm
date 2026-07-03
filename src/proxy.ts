import { type NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'
import { type UserRole, ROUTE_ROLE_MAP, ROLE_DASHBOARD_PATHS } from '@/types/user.types'

const PUBLIC_PATHS = ['/login', '/auth/callback', '/unauthorized']
const AUTH_PATH = '/login'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabase, supabaseResponse } = createMiddlewareClient(request)

  // Refresh the session token — this MUST happen on every request
  // to keep the user session alive. Do not remove.
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  // Allow public paths through without any auth checks
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    // Redirect authenticated users away from login
    if (pathname.startsWith(AUTH_PATH) && authUser) {
      const profile = await loadUserProfile(supabase, authUser.id)
      if (profile) {
        return NextResponse.redirect(
          new URL(ROLE_DASHBOARD_PATHS[profile.role as UserRole], request.url),
        )
      }
    }
    return supabaseResponse
  }

  // Unauthenticated user attempting to access protected route
  if (!authUser) {
    const loginUrl = new URL(AUTH_PATH, request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Load user profile to get role
  const profile = await loadUserProfile(supabase, authUser.id)

  if (!profile) {
    // Auth user exists but no platform profile — likely inactive or not provisioned
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  // RBAC route check
  const matchedRoute = Object.keys(ROUTE_ROLE_MAP).find((route) =>
    pathname.startsWith(route),
  )

  if (matchedRoute) {
    const allowedRoles = ROUTE_ROLE_MAP[matchedRoute]
    if (!allowedRoles.includes(profile.role as UserRole)) {
      // User is authenticated but accessing a route above their role
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  return supabaseResponse
}

/**
 * Loads the ITSM user profile for the given Supabase auth user ID.
 * Kept lightweight — only fetches role for middleware RBAC check.
 */
async function loadUserProfile(
  supabase: ReturnType<typeof import('@supabase/ssr').createServerClient>,
  authUserId: string,
) {
  const { data } = await supabase
    .from('users')
    .select('id, role, is_active')
    .eq('auth_id', authUserId)
    .single()

  if (!data || !data.is_active) return null
  return data
}

export const config = {
  matcher: [
    /*
     * Run middleware on all routes EXCEPT:
     * - _next/static (Next.js static files)
     * - _next/image (image optimisation)
     * - favicon.ico, site assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
