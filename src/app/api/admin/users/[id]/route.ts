import { z } from 'zod'
import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/services/audit.service'

const UpdateUserSchema = z.object({
  role: z.enum(['requester', 'dept_user', 'manager', 'super_admin']).optional(),
  region_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
  full_name: z.string().min(2).max(100).optional(),
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

  // Super Admin cannot deactivate themselves
  if (id === user.id) {
    return ApiResponse.badRequest('You cannot modify your own account via the admin panel.')
  }

  let body: unknown
  try { body = await request.json() } catch { return ApiResponse.badRequest('Invalid JSON.') }

  const parsed = UpdateUserSchema.safeParse(body)
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Validation failed.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return ApiResponse.notFound('User not found.')

  // Write audit log
  const eventType = parsed.data.is_active === false ? 'user.deactivated'
    : parsed.data.role ? 'user.role_changed'
    : 'user.updated'
  await writeAuditLog(supabase, {
    eventType,
    actor: user,
    entityType: 'user',
    entityId: id,
    entityRef: data.email,
    payload: parsed.data as Record<string, unknown>,
  })

  // If user was deactivated, notify their manager (NR-16)
  if (parsed.data.is_active === false && data.department_id) {
    const { data: manager } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('role', 'manager')
      .eq('department_id', data.department_id)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (manager) {
      await supabase.from('notifications').insert({
        notification_type: 'user_deactivated',
        recipient_id: manager.id,
        recipient_email: manager.email,
        ticket_id: null,
        subject: `User account deactivated — ${data.full_name}`,
        body_html: `<p>Hi ${manager.full_name},</p><p>${data.full_name} (${data.email}) has been deactivated. Any open tickets assigned to them should be reassigned.</p>`,
      })
    }
  }

  return ApiResponse.ok(data)
}
