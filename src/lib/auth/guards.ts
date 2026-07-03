import { createClient } from '@/lib/supabase/server'
import { type UserProfile, type UserRole } from '@/types/user.types'
import { NextResponse } from 'next/server'

export interface ApiError {
  code: string
  message: string
}

/**
 * Loads the currently authenticated user profile from the database.
 * Returns null if unauthenticated or if the user account is inactive.
 */
export async function getSessionUser(): Promise<UserProfile | null> {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) return null

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authUser.id)
    .single()

  if (profileError || !profile) return null
  if (!profile.is_active) return null

  return profile
}

/**
 * Checks that the authenticated user has one of the allowed roles.
 * Returns an ApiError if the check fails, or null if the user is allowed.
 */
export function requireRole(user: UserProfile, allowedRoles: UserRole[]): ApiError | null {
  if (!allowedRoles.includes(user.role)) {
    return {
      code: 'INSUFFICIENT_PERMISSIONS',
      message: `Role '${user.role}' is not permitted to perform this action.`,
    }
  }
  return null
}

/**
 * Standard JSON API response helpers.
 */
export const ApiResponse = {
  ok: <T>(data: T, status = 200) =>
    NextResponse.json({ success: true, data }, { status }),

  created: <T>(data: T) =>
    NextResponse.json({ success: true, data }, { status: 201 }),

  unauthorized: (message = 'Authentication required.') =>
    NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message } }, { status: 401 }),

  forbidden: (message = 'You do not have permission to perform this action.') =>
    NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message } }, { status: 403 }),

  notFound: (message = 'Resource not found.') =>
    NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message } }, { status: 404 }),

  badRequest: (message: string) =>
    NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message } }, { status: 400 }),

  serverError: (message = 'An unexpected error occurred.') =>
    NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message } },
      { status: 500 },
    ),
}
