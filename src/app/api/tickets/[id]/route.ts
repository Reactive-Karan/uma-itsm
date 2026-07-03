import { getSessionUser, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getTicketById } from '@/services/ticket.service'

/**
 * GET /api/tickets/[id]
 * Returns a single ticket by ID. RLS ensures users only see tickets they are allowed to.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  const { id } = await params
  const supabase = await createClient()
  const ticket = await getTicketById(supabase, id)

  if (!ticket) return ApiResponse.notFound('Ticket not found.')
  return ApiResponse.ok(ticket)
}
