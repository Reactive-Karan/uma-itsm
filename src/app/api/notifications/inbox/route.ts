import { getSessionUser, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/notifications/inbox
 *
 * Returns the current user's recent notifications (last 30 days).
 * Used to populate the notification bell and inbox panel.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  const supabase = await createClient()
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const { data, count } = await supabase
    .from('notifications')
    .select('id, notification_type, subject, ticket_id, read_at, created_at, status', { count: 'exact' })
    .eq('recipient_id', user.id)
    .eq('status', 'sent')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(20)

  const unreadCount = (data ?? []).filter((n) => !n.read_at).length

  return ApiResponse.ok({ notifications: data ?? [], total: count ?? 0, unreadCount })
}
