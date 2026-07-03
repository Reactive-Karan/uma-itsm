import { getSessionUser, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/notifications/inbox/[id]/read
 * Marks a notification as read for the current user.
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('recipient_id', user.id) // security: only own notifications

  if (error) return ApiResponse.serverError()
  return ApiResponse.ok({ read: true })
}
