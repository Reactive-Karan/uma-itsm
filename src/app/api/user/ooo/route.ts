import { getSessionUser, ApiResponse } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * PATCH /api/user/ooo
 *
 * Updates the current user's Out-of-Office settings.
 * Uses the service client to bypass RLS, but verifies the session first
 * and only updates the authenticated user's own profile.
 */
export async function PATCH(request: Request) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  if (!['dept_user'].includes(user.role)) {
    return ApiResponse.forbidden('Only department users can set OOO status.')
  }

  const body = await request.json().catch(() => null)
  if (!body) return ApiResponse.badRequest('Invalid request body.')

  const {
    is_ooo,
    ooo_start_date,
    ooo_end_date,
    ooo_backup_user_id,
  } = body as {
    is_ooo: boolean
    ooo_start_date: string | null
    ooo_end_date: string | null
    ooo_backup_user_id: string | null
  }

  if (typeof is_ooo !== 'boolean') {
    return ApiResponse.badRequest('is_ooo must be a boolean.')
  }

  if (is_ooo && !ooo_backup_user_id) {
    return ApiResponse.badRequest('A backup user is required when setting OOO status.')
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('users')
    .update({
      is_ooo,
      ooo_start_date: is_ooo ? ooo_start_date : null,
      ooo_end_date: is_ooo ? ooo_end_date : null,
      ooo_backup_user_id: is_ooo ? ooo_backup_user_id : null,
    })
    .eq('id', user.id)

  if (error) return ApiResponse.serverError('Failed to update OOO settings.')

  return ApiResponse.ok({ updated: true, is_ooo })
}
