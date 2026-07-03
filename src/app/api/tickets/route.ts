import { z } from 'zod'
import { getSessionUser, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createTicket, listTickets, type TicketListFilters } from '@/services/ticket.service'

const CreateTicketSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters').max(150),
  description: z.string().min(20, 'Description must be at least 20 characters').max(2000),
  request_type: z.enum(['it_service', 'data_service']),
  sub_type: z.enum(['hardware', 'software', 'analysis', 'discrepancy', 'issues']),
  priority: z.enum(['high', 'medium', 'low']),
}).refine(
  (data) => {
    if (data.request_type === 'it_service') return ['hardware', 'software'].includes(data.sub_type)
    return ['analysis', 'discrepancy', 'issues'].includes(data.sub_type)
  },
  { message: 'Sub-type does not match the selected request type.' },
)

/**
 * GET /api/tickets
 * Returns all tickets visible to the current user (RLS-scoped).
 */
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'all'
  const priority = searchParams.get('priority') ?? undefined
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const supabase = await createClient()
  const { tickets, count } = await listTickets(supabase, {
    status: (status as TicketListFilters['status']) ?? 'all',
    priority: priority as TicketListFilters['priority'],
    page,
    pageSize: 20,
  })

  return ApiResponse.ok({ tickets, count, page })
}

/**
 * POST /api/tickets
 * Creates a new ticket for the authenticated user.
 * Triggers routing engine and SLA deadline calculation.
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  if (!user.region_id) {
    return ApiResponse.badRequest(
      'Your account has not been assigned to a region. Contact your administrator.',
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return ApiResponse.badRequest('Request body must be valid JSON.')
  }

  const parsed = CreateTicketSchema.safeParse(body)
  if (!parsed.success) {
    return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Validation failed.')
  }

  const supabase = await createClient()
  const { ticket, error } = await createTicket(supabase, user.id, user.region_id, parsed.data)

  if (error) {
    console.error('[POST /api/tickets] Create error:', error)
    return ApiResponse.serverError('Failed to create ticket. Please try again.')
  }

  return ApiResponse.created(ticket)
}
