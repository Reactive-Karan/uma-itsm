/**
 * Escalation Service
 *
 * Handles the full escalation lifecycle:
 * - Acknowledgment SLA miss → escalate to Manager
 * - Resolution SLA miss     → escalate to Manager
 * - Manager inaction (>4h)  → notify Super Admins
 * - Escalation loop cap     → route to Super Admin when count ≥ 2
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const MANAGER_INACTION_HOURS = 4
const ESCALATION_LOOP_CAP = 2

export type EscalationType = 'ack_sla_miss' | 'res_sla_miss' | 'manager_inaction' | 'loop_detected'

interface EscalationResult {
  escalated: boolean
  reason: string
  ticketNumber: string
}

// ─── Core escalation logic ────────────────────────────────────────────────────

/**
 * Escalate a single ticket. Records the event, updates ticket status,
 * and queues the appropriate notifications.
 *
 * Enforces the escalation loop cap: if escalation_count >= ESCALATION_LOOP_CAP,
 * routes to Super Admin instead of Manager.
 */
export async function escalateTicket(
  supabase: SupabaseClient<Database>,
  ticketId: string,
  escalationType: EscalationType,
): Promise<EscalationResult> {
  // Load ticket with current state
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, requester:users!tickets_requester_id_fkey(id,email,full_name), assignee:users!tickets_assignee_id_fkey(id,email,full_name,department_id)')
    .eq('id', ticketId)
    .single()

  if (!ticket) return { escalated: false, reason: 'Ticket not found', ticketNumber: '' }

  // Already closed or resolved — skip
  if (['resolved', 'closed'].includes(ticket.status)) {
    return { escalated: false, reason: 'Ticket already resolved/closed', ticketNumber: ticket.ticket_number }
  }

  const isLoopDetected = ticket.escalation_count >= ESCALATION_LOOP_CAP

  // Find the escalation target
  const target = await resolveEscalationTarget(supabase, ticket, isLoopDetected)

  if (!target) {
    return { escalated: false, reason: 'No escalation target found', ticketNumber: ticket.ticket_number }
  }

  const now = new Date().toISOString()
  const missDurationMinutes = calcMissDurationMinutes(ticket, escalationType)
  const finalType: EscalationType = isLoopDetected ? 'loop_detected' : escalationType

  // 1. Record escalation event
  await supabase.from('escalation_events').insert({
    ticket_id: ticketId,
    escalated_from: ticket.assignee_id,
    escalated_to: target.id,
    escalation_type: finalType,
    miss_duration_minutes: missDurationMinutes,
  })

  // 2. Update ticket
  await supabase
    .from('tickets')
    .update({
      status: 'escalated',
      escalation_count: ticket.escalation_count + 1,
      last_escalated_at: now,
    })
    .eq('id', ticketId)

  // 3. Write status history
  await supabase.from('ticket_status_history').insert({
    ticket_id: ticketId,
    from_status: ticket.status,
    to_status: 'escalated',
    changed_by: ticket.assignee_id ?? ticket.requester_id,
    reason: getEscalationReason(finalType, missDurationMinutes),
  })

  // 4. Queue notifications
  await queueEscalationNotifications(supabase, ticket, target, finalType, isLoopDetected)

  return { escalated: true, reason: finalType, ticketNumber: ticket.ticket_number }
}

// ─── SLA breach scanners ──────────────────────────────────────────────────────

/**
 * Scan for acknowledgment SLA breaches.
 * Finds all `new` tickets past their ack deadline and escalates them.
 */
export async function scanAckBreaches(
  supabase: SupabaseClient<Database>,
): Promise<{ processed: number; escalated: number }> {
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, ticket_number')
    .eq('status', 'new')
    .not('sla_ack_deadline', 'is', null)
    .lt('sla_ack_deadline', new Date().toISOString())

  if (!tickets?.length) return { processed: 0, escalated: 0 }

  let escalated = 0
  for (const t of tickets) {
    const result = await escalateTicket(supabase, t.id, 'ack_sla_miss')
    if (result.escalated) escalated++
  }

  return { processed: tickets.length, escalated }
}

/**
 * Scan for resolution SLA breaches.
 * Finds open (non-pending, non-resolved, non-closed) tickets past resolution deadline.
 */
export async function scanResBreaches(
  supabase: SupabaseClient<Database>,
): Promise<{ processed: number; escalated: number }> {
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, ticket_number')
    .in('status', ['acknowledged', 'in_progress'])
    .not('sla_res_deadline', 'is', null)
    .lt('sla_res_deadline', new Date().toISOString())

  if (!tickets?.length) return { processed: 0, escalated: 0 }

  let escalated = 0
  for (const t of tickets) {
    const result = await escalateTicket(supabase, t.id, 'res_sla_miss')
    if (result.escalated) escalated++
  }

  return { processed: tickets.length, escalated }
}

/**
 * Scan for manager inaction: escalated tickets with no status change in 4h.
 * Notifies all Super Admins.
 */
export async function scanManagerInaction(
  supabase: SupabaseClient<Database>,
): Promise<{ processed: number; notified: number }> {
  const cutoff = new Date(Date.now() - MANAGER_INACTION_HOURS * 3_600_000).toISOString()

  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, ticket_number')
    .eq('status', 'escalated')
    .not('last_escalated_at', 'is', null)
    .lt('last_escalated_at', cutoff)

  if (!tickets?.length) return { processed: 0, notified: 0 }

  // Get all Super Admins for notification
  const { data: superAdmins } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('role', 'super_admin')
    .eq('is_active', true)

  let notified = 0
  for (const t of tickets) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('ticket_number, title, assignee_id')
      .eq('id', t.id)
      .single()

    for (const admin of superAdmins ?? []) {
      await supabase.from('notifications').insert({
        notification_type: 'manager_inaction',
        recipient_id: admin.id,
        recipient_email: admin.email,
        ticket_id: t.id,
        subject: `[Action Required] Manager inaction detected — ${ticket?.ticket_number}`,
        body_html: `
          <p>Hi ${admin.full_name},</p>
          <p>Ticket <strong>${ticket?.ticket_number}</strong> ("${ticket?.title}") has been in <em>Escalated</em> status for more than ${MANAGER_INACTION_HOURS} hours without manager action.</p>
          <p>Please review and intervene immediately.</p>
        `,
      })
      notified++
    }

    // Update last_escalated_at to prevent re-notification in next scan
    await supabase
      .from('tickets')
      .update({ last_escalated_at: new Date().toISOString() })
      .eq('id', t.id)
  }

  return { processed: tickets.length, notified }
}

/**
 * Auto-close resolved tickets that have been in resolved state for more than 72h.
 * Creates a closed status history entry and queues NR-12 notification.
 */
export async function autoCloseResolvedTickets(
  supabase: SupabaseClient<Database>,
): Promise<{ processed: number; closed: number }> {
  const cutoff = new Date(Date.now() - 72 * 3_600_000).toISOString()

  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, ticket_number, requester_id, resolved_at')
    .eq('status', 'resolved')
    .not('resolved_at', 'is', null)
    .lt('resolved_at', cutoff)

  if (!tickets?.length) return { processed: 0, closed: 0 }

  // Get system user for status history
  const { data: systemUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'system@uma.internal')
    .single()

  let closed = 0
  const now = new Date().toISOString()

  for (const t of tickets) {
    const actorId = systemUser?.id ?? t.requester_id

    await supabase.from('tickets').update({ status: 'closed', closed_at: now }).eq('id', t.id)

    await supabase.from('ticket_status_history').insert({
      ticket_id: t.id,
      from_status: 'resolved',
      to_status: 'closed',
      changed_by: actorId,
      reason: 'Auto-closed after 72 hours in Resolved state with no requester response.',
    })

    // Queue NR-12 auto-close notification to requester
    const { data: requester } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', t.requester_id)
      .single()

    if (requester) {
      await supabase.from('notifications').insert({
        notification_type: 'ticket_auto_closed',
        recipient_id: t.requester_id,
        recipient_email: requester.email,
        ticket_id: t.id,
        subject: `[${t.ticket_number}] Your ticket has been closed`,
        body_html: `
          <p>Hi ${requester.full_name},</p>
          <p>Ticket <strong>${t.ticket_number}</strong> has been automatically closed after 72 hours in Resolved state.</p>
          <p>If your issue has not been resolved, please raise a new ticket and reference <strong>${t.ticket_number}</strong>.</p>
        `,
      })
    }

    closed++
  }

  return { processed: tickets.length, closed }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function resolveEscalationTarget(
  supabase: SupabaseClient<Database>,
  ticket: { region_id: string; department_id: string | null },
  isLoopDetected: boolean,
) {
  if (isLoopDetected) {
    // Loop cap reached — escalate to any active Super Admin in the same region
    const { data } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('role', 'super_admin')
      .eq('is_active', true)
      .limit(1)
      .single()
    return data
  }

  // Find the Manager for the ticket's department in the ticket's region
  if (ticket.department_id) {
    const { data } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('role', 'manager')
      .eq('department_id', ticket.department_id)
      .eq('region_id', ticket.region_id)
      .eq('is_active', true)
      .limit(1)
      .single()
    if (data) return data
  }

  // Fallback: any manager in the region
  const { data } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('role', 'manager')
    .eq('region_id', ticket.region_id)
    .eq('is_active', true)
    .limit(1)
    .single()
  return data
}

function calcMissDurationMinutes(
  ticket: { sla_ack_deadline: string | null; sla_res_deadline: string | null },
  type: EscalationType,
): number | null {
  const deadline =
    type === 'ack_sla_miss'
      ? ticket.sla_ack_deadline
      : type === 'res_sla_miss'
      ? ticket.sla_res_deadline
      : null
  if (!deadline) return null
  return Math.round((Date.now() - new Date(deadline).getTime()) / 60_000)
}

function getEscalationReason(type: EscalationType, minutes: number | null): string {
  const dur = minutes ? ` (${minutes} minutes overdue)` : ''
  switch (type) {
    case 'ack_sla_miss': return `Acknowledgment SLA missed${dur} — auto-escalated`
    case 'res_sla_miss': return `Resolution SLA missed${dur} — auto-escalated`
    case 'manager_inaction': return `Manager inaction detected — Super Admin notified`
    case 'loop_detected': return `Escalation loop detected — Super Admin assigned`
  }
}

async function queueEscalationNotifications(
  supabase: SupabaseClient<Database>,
  ticket: {
    id: string; ticket_number: string; title: string
    requester_id: string
    requester: { email: string; full_name: string } | null | unknown
    assignee: { email: string; full_name: string } | null | unknown
  },
  target: { id: string; email: string; full_name: string },
  type: EscalationType,
  isLoopDetected: boolean,
) {
  const req = ticket.requester as { email: string; full_name: string } | null

  // NR-07: Escalation alert to Manager/Super Admin
  await supabase.from('notifications').insert({
    notification_type: 'ticket_escalated_mgr',
    recipient_id: target.id,
    recipient_email: target.email,
    ticket_id: ticket.id,
    subject: `[Escalation] ${ticket.ticket_number} requires immediate attention`,
    body_html: `
      <p>Hi ${target.full_name},</p>
      <p>Ticket <strong>${ticket.ticket_number}</strong> ("${ticket.title}") has been escalated to you.</p>
      <p>Reason: ${getEscalationReason(type, null)}</p>
      <p>Please review and act immediately.</p>
    `,
  })

  // NR-08: Escalation notice to Requester
  if (req) {
    await supabase.from('notifications').insert({
      notification_type: 'ticket_escalated_req',
      recipient_id: ticket.requester_id,
      recipient_email: req.email,
      ticket_id: ticket.id,
      subject: `[${ticket.ticket_number}] Your ticket has been escalated`,
      body_html: `
        <p>Hi ${req.full_name},</p>
        <p>Your ticket <strong>${ticket.ticket_number}</strong> has been escalated to a senior team member for urgent attention.</p>
        <p>We apologise for the delay and will update you shortly.</p>
      `,
    })
  }

  // NR-15: Loop detection alert to all Super Admins
  if (isLoopDetected) {
    const { data: superAdmins } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('role', 'super_admin')
      .eq('is_active', true)

    for (const admin of superAdmins ?? []) {
      await supabase.from('notifications').insert({
        notification_type: 'escalation_loop',
        recipient_id: admin.id,
        recipient_email: admin.email,
        ticket_id: ticket.id,
        subject: `[CRITICAL] Escalation loop detected — ${ticket.ticket_number}`,
        body_html: `
          <p>Hi ${admin.full_name},</p>
          <p>Ticket <strong>${ticket.ticket_number}</strong> has been escalated ${ESCALATION_LOOP_CAP} times without resolution.</p>
          <p>This ticket requires immediate Super Admin intervention.</p>
        `,
      })
    }
  }
}
