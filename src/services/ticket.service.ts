import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database, RequestType, SubType, Priority, TicketStatus, Tables,
} from '@/types/database.types'
import { resolveRouting } from './routing.service'
import { calcAckDeadline } from '@/lib/ticket/sla'
import { tmplTicketReceived } from '@/lib/email/templates'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateTicketDto {
  title: string
  description: string
  request_type: RequestType
  sub_type: SubType
  priority: Priority
}

export type TicketRow = Tables<'tickets'>

export type TicketWithRequester = TicketRow & {
  requester: Pick<Tables<'users'>, 'id' | 'full_name' | 'email'>
  assignee: Pick<Tables<'users'>, 'id' | 'full_name'> | null
}

export interface TicketListFilters {
  status?: TicketStatus | 'all'
  priority?: Priority
  page?: number
  pageSize?: number
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Creates a new ticket, resolves routing, sets SLA deadline, and writes
 * the initial status history record.
 */
export async function createTicket(
  supabase: SupabaseClient<Database>,
  requesterId: string,
  regionId: string,
  dto: CreateTicketDto,
): Promise<{ ticket: TicketRow; error: string | null }> {
  // Resolve assignee via routing engine
  const { assigneeId, departmentId } = await resolveRouting(
    supabase,
    regionId,
    dto.request_type,
    dto.sub_type,
    requesterId,
  )

  const slaAckDeadline = calcAckDeadline()

  // Insert ticket
  const { data: ticket, error: insertError } = await supabase
    .from('tickets')
    .insert({
      requester_id: requesterId,
      assignee_id: assigneeId,
      region_id: regionId,
      department_id: departmentId,
      title: dto.title,
      description: dto.description,
      request_type: dto.request_type,
      sub_type: dto.sub_type,
      priority: dto.priority,
      status: 'new',
      sla_ack_deadline: slaAckDeadline.toISOString(),
    })
    .select()
    .single()

  if (insertError || !ticket) {
    return { ticket: null as unknown as TicketRow, error: insertError?.message ?? 'Insert failed' }
  }

  // Write initial status history (no from_status for first entry)
  await supabase.from('ticket_status_history').insert({
    ticket_id: ticket.id,
    from_status: null,
    to_status: 'new',
    changed_by: requesterId,
    reason: 'Ticket submitted',
  })

  // Queue confirmation notification (NR-01)
  const { data: requester } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', requesterId)
    .single()

  if (requester) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await supabase.from('notifications').insert({
      notification_type: 'ticket_received',
      recipient_id: requesterId,
      recipient_email: requester.email,
      ticket_id: ticket.id,
      subject: `[${ticket.ticket_number}] Your request has been received — UMA ITSM`,
      body_html: tmplTicketReceived({
        ticketNumber: ticket.ticket_number,
        title: ticket.title,
        requestType: ticket.request_type.replace('_', ' '),
        priority: ticket.priority,
        requesterName: requester.full_name,
        recipientName: requester.full_name,
        appUrl,
      }),
    })
  }

  return { ticket, error: null }
}

/**
 * Lists tickets visible to the current user (RLS-scoped by role).
 */
export async function listTickets(
  supabase: SupabaseClient<Database>,
  filters: TicketListFilters = {},
): Promise<{ tickets: TicketWithRequester[]; count: number }> {
  const { status = 'all', priority, page = 1, pageSize = 20 } = filters
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('tickets')
    .select(
      `*, requester:users!tickets_requester_id_fkey(id,full_name,email),
       assignee:users!tickets_assignee_id_fkey(id,full_name)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (priority) {
    query = query.eq('priority', priority)
  }

  const { data, count, error } = await query

  if (error) return { tickets: [], count: 0 }

  return {
    tickets: (data ?? []) as unknown as TicketWithRequester[],
    count: count ?? 0,
  }
}

/**
 * Fetches a single ticket by ID with requester and assignee details.
 */
export async function getTicketById(
  supabase: SupabaseClient<Database>,
  ticketId: string,
): Promise<TicketWithRequester | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select(
      `*, requester:users!tickets_requester_id_fkey(id,full_name,email),
       assignee:users!tickets_assignee_id_fkey(id,full_name)`,
    )
    .eq('id', ticketId)
    .single()

  if (error || !data) return null
  return data as unknown as TicketWithRequester
}

/**
 * Fetches the full activity timeline for a ticket:
 * status history entries + comments, merged and sorted chronologically.
 */
export async function getTicketTimeline(
  supabase: SupabaseClient<Database>,
  ticketId: string,
) {
  const [{ data: history }, { data: comments }] = await Promise.all([
    supabase
      .from('ticket_status_history')
      .select('*, actor:users(id,full_name,role)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true }),
    supabase
      .from('ticket_comments')
      .select('*, author:users(id,full_name,role)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true }),
  ])

  type StatusEntry = {
    type: 'status'
    id: string
    from_status: TicketStatus | null
    to_status: TicketStatus
    reason: string | null
    created_at: string
    actor: { id: string; full_name: string; role: string } | null
  }
  type CommentEntry = {
    type: 'comment'
    id: string
    body: string
    is_internal: boolean
    created_at: string
    author: { id: string; full_name: string; role: string } | null
  }

  const statusEntries: StatusEntry[] = (history ?? []).map((h) => ({
    type: 'status',
    id: h.id,
    from_status: h.from_status,
    to_status: h.to_status,
    reason: h.reason,
    created_at: h.created_at,
    actor: (h.actor as unknown) as StatusEntry['actor'],
  }))

  const commentEntries: CommentEntry[] = (comments ?? []).map((c) => ({
    type: 'comment',
    id: c.id,
    body: c.body,
    is_internal: c.is_internal,
    created_at: c.created_at,
    author: (c.author as unknown) as CommentEntry['author'],
  }))

  return [...statusEntries, ...commentEntries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}
