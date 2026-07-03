import { z } from 'zod'
import { getSessionUser, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

const BodySchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
})

/**
 * POST /api/ai/check-duplicates
 *
 * Finds open tickets in the requester's region that are similar to the
 * provided title and description, using PostgreSQL full-text search
 * (tsvector + ts_rank_cd). Called just before the user submits a ticket.
 *
 * Returns up to 5 similar open tickets. The requester can choose to
 * "watch" an existing ticket instead of creating a duplicate.
 *
 * Uses the fn_find_similar_tickets database function created in sprint5.sql.
 * Degrades gracefully if the search_vector column is not yet populated.
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  if (!user.region_id) {
    return ApiResponse.ok({ duplicates: [], available: false })
  }

  let body: unknown
  try { body = await request.json() } catch { return ApiResponse.badRequest('Invalid JSON.') }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return ApiResponse.ok({ duplicates: [], available: false })

  const { title, description } = parsed.data
  const queryText = `${title} ${description}`

  const supabase = await createClient()

  try {
    const { data, error } = await supabase.rpc('fn_find_similar_tickets', {
      query_text:  queryText,
      p_region_id: user.region_id,
      max_results: 5,
    })

    if (error) {
      // sprint5.sql not run yet — degrade gracefully
      console.warn('[check-duplicates] fn_find_similar_tickets not available:', error.message)
      return ApiResponse.ok({ duplicates: [], available: false })
    }

    return ApiResponse.ok({ duplicates: data ?? [], available: true })
  } catch {
    return ApiResponse.ok({ duplicates: [], available: false })
  }
}
