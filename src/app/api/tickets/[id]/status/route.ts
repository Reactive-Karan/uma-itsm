import { z } from 'zod'
import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/services/audit.service'
import type { TicketStatus } from '@/types/database.types'

const UpdateStatusSchema = z.object({
  status: z.enum(['in_progress', 'pending_requester', 'resolved']),
  reason: z.string().min(1).max(500).optional(),
  resolution_note: z.string().min(10).max(2000).optional(),
})

// Valid status transitions per role
const ALLOWED_TRANSITIONS: Record<string, TicketStatus[]> = {
  dept_user:   ['in_progress', 'pending_requester', 'resolved'],
  manager:     ['in_progress', 'pending_requester', 'resolved'],
  super_admin: ['in_progress', 'pending_requester', 'resolved'],
}

/**
 * PATCH /api/tickets/[id]/status
 *
 * Updates the status of a ticket with validation against the state machine.
 * Business rules:
 *   - in_progress: ticket must be acknowledged first
 *   - pending_requester: pauses SLA timer
 *   - resolved: requires resolution_note (min 10 chars)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  const err = requireRole(user, ['dept_user', 'manager', 'super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  const { id: ticketId } = await params

  let body: unknown
  try { body = await request.json() } catch { return ApiResponse.badRequest('Invalid JSON.') }

  const parsed = UpdateStatusSchema.safeParse(body)
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Validation failed.')

  const { status: newStatus, reason, resolution_note } = parsed.data

  // Check allowed transitions for this role
  if (!ALLOWED_TRANSITIONS[user.role]?.includes(newStatus)) {
    return ApiResponse.forbidden(`Your role cannot transition a ticket to '${newStatus}'.`)
  }

  if (newStatus === 'resolved' && !resolution_note) {
    return ApiResponse.badRequest('Resolution note is required when resolving a ticket.')
  }

  const supabase = await createClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, ticket_number, status, assignee_id, requester_id, sla_paused_at, sla_paused_minutes')
    .eq('id', ticketId)
    .single()

  if (!ticket) return ApiResponse.notFound('Ticket not found.')

  if (user.role === 'dept_user' && ticket.assignee_id !== user.id) {
    return ApiResponse.forbidden('You can only update tickets assigned to you.')
  }

  // State machine guards
  if (newStatus === 'in_progress' && ticket.status === 'new') {
    return ApiResponse.badRequest("Ticket must be acknowledged before marking as 'In Progress'.")
  }

  const now = new Date()
  type TicketUpdate = import('@/types/database.types').Database['public']['Tables']['tickets']['Update']
  const updatePayload: TicketUpdate = { status: newStatus }

  if (newStatus === 'pending_requester') {
    updatePayload.sla_paused_at = now.toISOString()
  } else if (ticket.status === 'pending_requester' && ticket.sla_paused_at) {
    const pausedMinutes = Math.round(
      (now.getTime() - new Date(ticket.sla_paused_at).getTime()) / 60_000,
    )
    updatePayload.sla_paused_at = null
    updatePayload.sla_paused_minutes = (ticket.sla_paused_minutes ?? 0) + pausedMinutes
  }

  if (newStatus === 'resolved') {
    updatePayload.resolution_note = resolution_note
    updatePayload.resolved_at = now.toISOString()
  }

  await supabase.from('tickets').update(updatePayload).eq('id', ticketId)

  await supabase.from('ticket_status_history').insert({
    ticket_id: ticketId,
    from_status: ticket.status,
    to_status: newStatus,
    changed_by: user.id,
    reason: reason ?? null,
  })

  // Notifications
  const { data: requester } = await supabase
    .from('users').select('email, full_name').eq('id', ticket.requester_id).single()

  if (requester) {
    const notifMap: Record<string, string> = {
      in_progress: 'ticket_in_progress',
      pending_requester: 'pending_requester',
      resolved: 'ticket_resolved',
    }
    const subjects: Record<string, string> = {
      in_progress: `[${ticket.ticket_number}] Your request is in progress`,
      pending_requester: `[${ticket.ticket_number}] We need more information`,
      resolved: `[${ticket.ticket_number}] Your request has been resolved`,
    }
    await supabase.from('notifications').insert({
      notification_type: notifMap[newStatus],
      recipient_id: ticket.requester_id,
      recipient_email: requester.email,
      ticket_id: ticketId,
      subject: subjects[newStatus],
      body_html: `<p>Hi ${requester.full_name},</p><p>Ticket <strong>${ticket.ticket_number}</strong> status has been updated to <strong>${newStatus.replace('_', ' ')}</strong>.</p>${resolution_note ? `<p><strong>Resolution:</strong> ${resolution_note}</p>` : ''}`,
    })
  }

  await writeAuditLog(supabase, {
    eventType: 'ticket.status_changed',
    actor: user,
    entityType: 'ticket',
    entityId: ticketId,
    entityRef: ticket.ticket_number,
    payload: { from: ticket.status, to: newStatus, reason },
  })

  return ApiResponse.ok({ status: newStatus })
}
