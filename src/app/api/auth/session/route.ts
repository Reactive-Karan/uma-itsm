import { getSessionUser, ApiResponse } from '@/lib/auth/guards'

/**
 * GET /api/auth/session
 *
 * Returns the currently authenticated user's ITSM profile.
 * Used by client-side components to hydrate the session store.
 *
 * Response 200: { success: true, data: UserProfile }
 * Response 401: { success: false, error: { code: 'UNAUTHORIZED' } }
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  return ApiResponse.ok(user)
}
