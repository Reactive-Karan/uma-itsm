/**
 * Audit Service
 *
 * Writes immutable, append-only audit log entries for all critical platform events.
 * Every write uses the Supabase service role client to bypass RLS, ensuring audit
 * records are always created regardless of the actor's permissions.
 *
 * The audit_log table has RULE-based protection (no UPDATE or DELETE),
 * making the record tamper-proof at the database level.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { UserProfile } from '@/types/user.types'

export type AuditEntityType = 'ticket' | 'user' | 'routing_rule' | 'sla_config' | 'holiday'

export interface AuditEvent {
  eventType: string
  actor: Pick<UserProfile, 'id' | 'full_name' | 'role'> | null
  entityType: AuditEntityType
  entityId: string
  entityRef: string
  payload?: Record<string, unknown>
  ipAddress?: string | null
}

/**
 * Appends one immutable audit log entry.
 * Failures are logged but never re-thrown — audit errors must not break
 * the primary operation.
 */
export async function writeAuditLog(
  supabase: SupabaseClient<Database>,
  event: AuditEvent,
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      event_type: event.eventType,
      actor_id: event.actor?.id ?? null,
      actor_name: event.actor?.full_name ?? 'System',
      actor_role: event.actor?.role ?? 'system',
      entity_type: event.entityType,
      entity_id: event.entityId,
      entity_ref: event.entityRef,
      payload: (event.payload ?? {}) as import('@/types/database.types').Json,
      ip_address: event.ipAddress ?? null,
    })
  } catch (err) {
    // Audit failures are non-fatal — log and continue
    console.error('[AuditService] Failed to write audit log:', err)
  }
}

/**
 * Query audit log entries with optional filters.
 * Returns paginated results sorted by most recent first.
 */
export async function queryAuditLog(
  supabase: SupabaseClient<Database>,
  options: {
    eventType?: string
    actorId?: string
    entityType?: string
    entityId?: string
    fromDate?: string
    toDate?: string
    page?: number
    pageSize?: number
  } = {},
) {
  const { page = 1, pageSize = 50 } = options
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (options.eventType) query = query.eq('event_type', options.eventType)
  if (options.actorId)   query = query.eq('actor_id', options.actorId)
  if (options.entityType) query = query.eq('entity_type', options.entityType)
  if (options.entityId)   query = query.eq('entity_id', options.entityId)
  if (options.fromDate)   query = query.gte('created_at', options.fromDate)
  if (options.toDate)     query = query.lte('created_at', options.toDate)

  const { data, count, error } = await query
  if (error) return { entries: [], count: 0 }
  return { entries: data ?? [], count: count ?? 0 }
}

/** Fetch all audit log entries for CSV export (no pagination). */
export async function exportAuditLog(
  supabase: SupabaseClient<Database>,
  options: {
    fromDate?: string
    toDate?: string
    entityType?: string
  } = {},
) {
  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10000)

  if (options.fromDate)   query = query.gte('created_at', options.fromDate)
  if (options.toDate)     query = query.lte('created_at', options.toDate)
  if (options.entityType) query = query.eq('entity_type', options.entityType)

  const { data } = await query
  return data ?? []
}

/** Convert audit log rows to CSV string. */
export function auditLogToCsv(entries: Database['public']['Tables']['audit_log']['Row'][]): string {
  const headers = [
    'created_at', 'event_type', 'actor_name', 'actor_role',
    'entity_type', 'entity_ref', 'entity_id', 'ip_address',
  ]
  const rows = entries.map((e) => [
    e.created_at,
    e.event_type,
    `"${e.actor_name.replace(/"/g, '""')}"`,
    e.actor_role,
    e.entity_type,
    `"${e.entity_ref.replace(/"/g, '""')}"`,
    e.entity_id,
    e.ip_address ?? '',
  ])
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}
