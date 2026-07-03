import { z } from 'zod'
import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

const CreateRuleSchema = z.object({
  region_id: z.string().uuid(),
  request_type: z.enum(['it_service', 'data_service']),
  sub_type: z.enum(['hardware', 'software', 'analysis', 'discrepancy', 'issues']),
  primary_assignee_id: z.string().uuid(),
  backup_assignee_id: z.string().uuid().nullable().optional(),
}).refine(
  (d) => {
    if (d.request_type === 'it_service') return ['hardware', 'software'].includes(d.sub_type)
    return ['analysis', 'discrepancy', 'issues'].includes(d.sub_type)
  },
  { message: 'Sub-type does not match the request type.' },
)

export async function GET() {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  const err = requireRole(user, ['super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('routing_rules')
    .select(`*, region:regions(id,name,code), primary_user:users!routing_rules_primary_assignee_id_fkey(id,full_name,email), backup_user:users!routing_rules_backup_assignee_id_fkey(id,full_name,email)`)
    .order('created_at', { ascending: false })

  if (error) return ApiResponse.serverError()
  return ApiResponse.ok(data)
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  const err = requireRole(user, ['super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  let body: unknown
  try { body = await request.json() } catch { return ApiResponse.badRequest('Invalid JSON.') }

  const parsed = CreateRuleSchema.safeParse(body)
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Validation failed.')

  const supabase = await createClient()

  // Verify primary assignee is a dept_user
  const { data: assignee } = await supabase
    .from('users')
    .select('id, role, department_id')
    .eq('id', parsed.data.primary_assignee_id)
    .eq('is_active', true)
    .single()

  if (!assignee || assignee.role !== 'dept_user') {
    return ApiResponse.badRequest('Primary assignee must be an active Department User.')
  }

  const { data: rule, error } = await supabase
    .from('routing_rules')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return ApiResponse.badRequest('A routing rule for this region, type, and sub-type already exists.')
    }
    return ApiResponse.serverError()
  }

  return ApiResponse.created(rule)
}
