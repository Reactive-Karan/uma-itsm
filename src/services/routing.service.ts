import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, RequestType, SubType } from '@/types/database.types'

interface ResolvedRoute {
  assigneeId: string | null
  departmentId: string | null
}

/**
 * Resolves the assignee and department for a new ticket based on:
 * 1. Active routing rule for the region + type + sub-type
 * 2. OOO detection — falls back to backup assignee
 * 3. If no rule or no valid assignee: returns nulls (Super Admin assigns manually)
 */
export async function resolveRouting(
  supabase: SupabaseClient<Database>,
  regionId: string,
  requestType: RequestType,
  subType: SubType,
  requesterId: string,
): Promise<ResolvedRoute> {
  // Look up active routing rule
  const { data: rule } = await supabase
    .from('routing_rules')
    .select(`
      primary_assignee_id,
      backup_assignee_id,
      primary:users!routing_rules_primary_assignee_id_fkey(id, is_ooo, department_id),
      backup:users!routing_rules_backup_assignee_id_fkey(id, is_ooo, department_id)
    `)
    .eq('region_id', regionId)
    .eq('request_type', requestType)
    .eq('sub_type', subType)
    .eq('is_active', true)
    .maybeSingle()

  if (!rule) return { assigneeId: null, departmentId: null }

  // Determine the lookup type and get the primary user details
  const { data: primaryUser } = await supabase
    .from('users')
    .select('id, is_ooo, department_id')
    .eq('id', rule.primary_assignee_id)
    .single()

  if (!primaryUser) return { assigneeId: null, departmentId: null }

  // Primary is available and not the requester themselves
  if (!primaryUser.is_ooo && primaryUser.id !== requesterId) {
    return {
      assigneeId: primaryUser.id,
      departmentId: primaryUser.department_id,
    }
  }

  // Primary is OOO — try backup
  if (rule.backup_assignee_id) {
    const { data: backupUser } = await supabase
      .from('users')
      .select('id, is_ooo, department_id')
      .eq('id', rule.backup_assignee_id)
      .single()

    if (backupUser && !backupUser.is_ooo && backupUser.id !== requesterId) {
      return {
        assigneeId: backupUser.id,
        departmentId: backupUser.department_id,
      }
    }
  }

  // Both OOO or backup unavailable — unassigned, Super Admin intervenes
  return { assigneeId: null, departmentId: primaryUser.department_id }
}
