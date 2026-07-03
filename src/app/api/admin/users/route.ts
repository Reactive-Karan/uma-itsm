import { z } from 'zod'
import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const CreateUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2).max(100),
  role: z.enum(['requester', 'dept_user', 'manager', 'super_admin']),
  region_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
})

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  const err = requireRole(user, ['super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')
  const region = searchParams.get('region_id')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const pageSize = 30

  const supabase = await createClient()
  let query = supabase
    .from('users')
    .select('*, region:regions(name, code), department:departments(name, code)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (role) query = query.eq('role', role as import('@/types/database.types').UserRole)
  if (region) query = query.eq('region_id', region)

  const { data, count, error } = await query
  if (error) return ApiResponse.serverError()
  return ApiResponse.ok({ users: data, count: count ?? 0, page })
}

/**
 * POST /api/admin/users
 * Provisions a new user profile. The user must already have a Supabase Auth account
 * (i.e. must have logged in at least once via Google SSO to create the auth.users record).
 * This endpoint links the auth account to an ITSM profile with a specific role.
 *
 * For new users who have never logged in, use Supabase Auth admin API to invite them.
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  const err = requireRole(user, ['super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  let body: unknown
  try { body = await request.json() } catch { return ApiResponse.badRequest('Invalid JSON.') }

  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Validation failed.')

  // Service client to look up auth.users by email
  const serviceSupabase = createServiceClient()

  const { data: authUsers } = await serviceSupabase.auth.admin.listUsers()
  const authUser = authUsers?.users?.find((u) => u.email === parsed.data.email)

  if (!authUser) {
    return ApiResponse.badRequest(
      `No Google account found for ${parsed.data.email}. The user must sign in with Google first before being provisioned.`,
    )
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .single()

  if (existing) {
    return ApiResponse.badRequest('A profile already exists for this user. Use PATCH to update it.')
  }

  const { data: newUser, error } = await serviceSupabase
    .from('users')
    .insert({
      auth_id: authUser.id,
      email: parsed.data.email,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      region_id: parsed.data.region_id ?? null,
      department_id: parsed.data.department_id ?? null,
    })
    .select()
    .single()

  if (error) return ApiResponse.serverError(error.message)
  return ApiResponse.created(newUser)
}
