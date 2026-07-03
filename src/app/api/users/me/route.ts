import { getSessionUser, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateMeSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  is_ooo: z.boolean().optional(),
  ooo_start_date: z.string().date().nullable().optional(),
  ooo_end_date: z.string().date().nullable().optional(),
  ooo_backup_user_id: z.string().uuid().nullable().optional(),
})

/**
 * GET /api/users/me
 * Returns the full profile of the currently authenticated user.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  return ApiResponse.ok(user)
}

/**
 * PATCH /api/users/me
 *
 * Allows users to update their own non-sensitive profile fields:
 * - full_name
 * - OOO settings (is_ooo, ooo_start_date, ooo_end_date, ooo_backup_user_id)
 *
 * Role, region, department, and is_active CANNOT be changed here.
 * Those fields are managed exclusively by Super Admins via /api/users/[id].
 */
export async function PATCH(request: Request) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return ApiResponse.badRequest('Request body must be valid JSON.')
  }

  const parsed = UpdateMeSchema.safeParse(body)
  if (!parsed.success) {
    return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body.')
  }

  const updates = parsed.data

  // OOO date range validation
  if (updates.ooo_start_date && updates.ooo_end_date) {
    if (new Date(updates.ooo_start_date) > new Date(updates.ooo_end_date)) {
      return ApiResponse.badRequest('OOO start date must be before or equal to end date.')
    }
  }

  // Prevent self-backup assignment
  if (updates.ooo_backup_user_id === user.id) {
    return ApiResponse.badRequest('You cannot assign yourself as your own backup.')
  }

  const supabase = await createClient()

  const { data: updated, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    console.error('[PATCH /api/users/me] Update error:', error.message)
    return ApiResponse.serverError('Failed to update profile. Please try again.')
  }

  return ApiResponse.ok(updated)
}
