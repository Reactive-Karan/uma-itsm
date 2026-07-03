import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { calcResDeadline } from '@/lib/ticket/sla-business'
import { tmplTicketAcknowledged } from '@/lib/email/templates'

/**
 * PATCH /api/tickets/[id]/acknowledge
 *
 * Marks a ticket as Acknowledged by the assigned Dept User.
 * Business rules:
 *   - Only the assigned Dept User, a Manager (dept scope), or Super Admin may acknowledge.
 *   - Ticket must be in `new` or `escalated` status.
 *   - Sets status → `acknowledged` and computes the resolution SLA deadline.
 *   - Queues NR-03 notification to Requester.
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  const err = requireRole(user, ['dept_user', 'manager', 'super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  const { id: ticketId } = await params
  const supabase = await createClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, ticket_number, title, status, assignee_id, region_id, priority, request_type, requester_id')
    .eq('id', ticketId)
    .single()

  if (!ticket) return ApiResponse.notFound('Ticket not found.')

  // Dept User may only acknowledge their own assigned ticket
  if (user.role === 'dept_user' && ticket.assignee_id !== user.id) {
    return ApiResponse.forbidden('You can only acknowledge tickets assigned to you.')
  }

  if (!['new', 'escalated'].includes(ticket.status)) {
    return ApiResponse.badRequest(`Cannot acknowledge a ticket in '${ticket.status}' status.`)
  }

  const now = new Date()
  const slaResDeadline = await calcResDeadline(supabase, ticket.region_id, ticket.priority, now)

  await supabase
    .from('tickets')
    .update({
      status: 'acknowledged',
      sla_res_deadline: slaResDeadline.toISOString(),
    })
    .eq('id', ticketId)

  await supabase.from('ticket_status_history').insert({
    ticket_id: ticketId,
    from_status: ticket.status,
    to_status: 'acknowledged',
    changed_by: user.id,
  })

  // NR-03: notify requester of acknowledgment
  const { data: requester } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', ticket.requester_id)
    .single()

  if (requester) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await supabase.from('notifications').insert({
      notification_type: 'ticket_acknowledged',
      recipient_id: ticket.requester_id,
      recipient_email: requester.email,
      ticket_id: ticketId,
      subject: `[${ticket.ticket_number}] Your request has been acknowledged — UMA ITSM`,
      body_html: tmplTicketAcknowledged({
        ticketNumber: ticket.ticket_number,
        title: ticket.title ?? '',
        requestType: (ticket.request_type ?? 'it_service').replace('_', ' '),
        priority: ticket.priority ?? 'medium',
        requesterName: requester.full_name,
        recipientName: requester.full_name,
        assigneeName: user.full_name,
        appUrl,
      }),
    })
  }

  return ApiResponse.ok({ status: 'acknowledged', sla_res_deadline: slaResDeadline.toISOString() })
}
