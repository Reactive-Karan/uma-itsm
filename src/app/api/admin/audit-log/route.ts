import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { queryAuditLog } from '@/services/audit.service'

/**
 * GET /api/admin/audit-log
 * Paginated audit log with optional filters.
 * Super Admin only.
 */
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  const err = requireRole(user, ['super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  const { searchParams } = new URL(request.url)

  const supabase = await createClient()
  const { entries, count } = await queryAuditLog(supabase, {
    eventType:  searchParams.get('event_type') ?? undefined,
    actorId:    searchParams.get('actor_id') ?? undefined,
    entityType: searchParams.get('entity_type') ?? undefined,
    fromDate:   searchParams.get('from') ?? undefined,
    toDate:     searchParams.get('to') ?? undefined,
    page:       parseInt(searchParams.get('page') ?? '1', 10),
    pageSize:   parseInt(searchParams.get('page_size') ?? '50', 10),
  })

  return ApiResponse.ok({ entries, count, page: parseInt(searchParams.get('page') ?? '1', 10) })
}
