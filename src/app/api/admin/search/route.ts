import { z } from 'zod'
import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

const QuerySchema = z.object({
  q: z.string().min(2, 'Search term must be at least 2 characters.').max(200),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
})

/**
 * GET /api/admin/search?q=term&status=new&page=1
 *
 * Full-text search across all tickets using the PostgreSQL tsvector index.
 * Also matches ticket numbers exactly (TKT-NNNN lookup).
 * Super Admin only.
 */
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  const err = requireRole(user, ['super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    q: searchParams.get('q') ?? '',
    status: searchParams.get('status') ?? undefined,
    page: searchParams.get('page') ?? '1',
  })

  if (!parsed.success) {
    return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Invalid search parameters.')
  }

  const { q, status, page } = parsed.data
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()

  // Exact ticket number match
  if (/^TKT-\d+$/i.test(q.trim())) {
    const { data } = await supabase
      .from('tickets')
      .select('*, requester:users!tickets_requester_id_fkey(id,full_name,email), assignee:users!tickets_assignee_id_fkey(id,full_name)')
      .ilike('ticket_number', q.trim().toUpperCase())
      .limit(1)
    return ApiResponse.ok({ tickets: data ?? [], count: data?.length ?? 0, q, page })
  }

  // Full-text search using websearch_to_tsquery
  let query = supabase
    .from('tickets')
    .select(
      '*, requester:users!tickets_requester_id_fkey(id,full_name,email), assignee:users!tickets_assignee_id_fkey(id,full_name)',
      { count: 'exact' },
    )
    .textSearch('search_vector', q, { type: 'websearch', config: 'english' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) query = query.eq('status', status as import('@/types/database.types').TicketStatus)

  const { data, count, error } = await query

  if (error) {
    // search_vector not available yet — fall back to ilike on title
    const fallback = await supabase
      .from('tickets')
      .select('*, requester:users!tickets_requester_id_fkey(id,full_name,email), assignee:users!tickets_assignee_id_fkey(id,full_name)', { count: 'exact' })
      .ilike('title', `%${q}%`)
      .order('created_at', { ascending: false })
      .range(from, to)

    return ApiResponse.ok({
      tickets: fallback.data ?? [],
      count: fallback.count ?? 0,
      q, page,
      note: 'Full-text index not available — using title match fallback.',
    })
  }

  return ApiResponse.ok({ tickets: data ?? [], count: count ?? 0, q, page })
}
