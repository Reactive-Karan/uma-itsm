import { z } from 'zod'
import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

const ReassignSchema = z.object({
  assignee_id: z.string().uuid('Invalid user ID.'),
  reason: z.string().min(1).max(500).optional(),
})

/**
 * PATCH /api/tickets/[id]/reassign
 * Reassigns a ticket to a different Dept User.
 * Only Managers (dept-scoped) and Super Admins may reassign.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  const err = requireRole(user, ['manager', 'super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  const { id: ticketId } = await params
  let body: unknown
  try { body = await request.json() } catch { return ApiResponse.badRequest('Invalid JSON.') }

  const parsed = ReassignSchema.safeParse(body)
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Validation failed.')

  const { assignee_id, reason } = parsed.data

  const supabase = await createClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, ticket_number, status, assignee_id, department_id, requester_id')
    .eq('id', ticketId)
    .single()

  if (!ticket) return ApiResponse.notFound('Ticket not found.')

  // Manager scope check
  if (user.role === 'manager' && ticket.department_id !== user.department_id) {
    return ApiResponse.forbidden('Managers can only reassign tickets within their department.')
  }

  if (['resolved', 'closed'].includes(ticket.status)) {
    return ApiResponse.badRequest('Cannot reassign a resolved or closed ticket.')
  }

  // Validate new assignee exists and is active
  const { data: newAssignee } = await supabase
    .from('users')
    .select('id, full_name, email, department_id, role')
    .eq('id', assignee_id)
    .eq('is_active', true)
    .single()

  if (!newAssignee) return ApiResponse.badRequest('Target user not found or inactive.')
  if (newAssignee.role !== 'dept_user') return ApiResponse.badRequest('Target user must have the Department User role.')

  await supabase.from('tickets').update({
    assignee_id,
    department_id: newAssignee.department_id ?? ticket.department_id,
  }).eq('id', ticketId)

  await supabase.from('ticket_status_history').insert({
    ticket_id: ticketId,
    from_status: ticket.status,
    to_status: ticket.status,
    changed_by: user.id,
    reason: reason ?? `Reassigned to ${newAssignee.full_name}`,
  })

  // NR-10: notify new assignee
  await supabase.from('notifications').insert({
    notification_type: 'ticket_reassigned',
    recipient_id: assignee_id,
    recipient_email: newAssignee.email,
    ticket_id: ticketId,
    subject: `[${ticket.ticket_number}] Ticket reassigned to you`,
    body_html: `<p>Hi ${newAssignee.full_name},</p><p>Ticket <strong>${ticket.ticket_number}</strong> has been reassigned to you. Please review and acknowledge it.</p>`,
  })

  return ApiResponse.ok({ assignee_id, assignee_name: newAssignee.full_name })
}
