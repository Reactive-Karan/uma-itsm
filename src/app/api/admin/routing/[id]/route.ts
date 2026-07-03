import { z } from 'zod'
import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

const UpdateRuleSchema = z.object({
  primary_assignee_id: z.string().uuid().optional(),
  backup_assignee_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  const err = requireRole(user, ['super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  const { id } = await params
  let body: unknown
  try { body = await request.json() } catch { return ApiResponse.badRequest('Invalid JSON.') }

  const parsed = UpdateRuleSchema.safeParse(body)
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Validation failed.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('routing_rules')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return ApiResponse.notFound('Routing rule not found.')
  return ApiResponse.ok(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  const err = requireRole(user, ['super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  const { id } = await params
  const supabase = await createClient()

  // Soft delete — deactivate rather than physically delete
  const { error } = await supabase
    .from('routing_rules')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return ApiResponse.serverError()
  return ApiResponse.ok({ deactivated: true })
}
