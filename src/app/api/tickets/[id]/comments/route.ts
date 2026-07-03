import { z } from 'zod'
import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getTicketById } from '@/services/ticket.service'

const CreateCommentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty.').max(5000),
  is_internal: z.boolean().default(false),
})

/**
 * POST /api/tickets/[id]/comments
 * Adds a comment to a ticket. Internal notes restricted to staff roles.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  const { id: ticketId } = await params
  const supabase = await createClient()

  // Verify the ticket exists and is RLS-accessible to this user
  const ticket = await getTicketById(supabase, ticketId)
  if (!ticket) return ApiResponse.notFound('Ticket not found.')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return ApiResponse.badRequest('Request body must be valid JSON.')
  }

  const parsed = CreateCommentSchema.safeParse(body)
  if (!parsed.success) {
    return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Validation failed.')
  }

  // Internal notes restricted to staff
  if (parsed.data.is_internal) {
    const err = requireRole(user, ['dept_user', 'manager', 'super_admin'])
    if (err) return ApiResponse.forbidden(err.message)
  }

  const { data: comment, error } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id: ticketId,
      author_id: user.id,
      body: parsed.data.body,
      is_internal: parsed.data.is_internal,
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/tickets/[id]/comments]', error.message)
    return ApiResponse.serverError('Failed to add comment.')
  }

  return ApiResponse.created(comment)
}
