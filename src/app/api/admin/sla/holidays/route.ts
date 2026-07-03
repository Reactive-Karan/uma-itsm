import { z } from 'zod'
import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

const CreateHolidaySchema = z.object({
  region_id: z.string().uuid(),
  holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  label: z.string().min(2).max(100),
})

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  const err = requireRole(user, ['super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  let body: unknown
  try { body = await request.json() } catch { return ApiResponse.badRequest('Invalid JSON.') }

  const parsed = CreateHolidaySchema.safeParse(body)
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Validation failed.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('holidays')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return ApiResponse.badRequest('A holiday already exists for this region on that date.')
    return ApiResponse.serverError()
  }
  return ApiResponse.created(data)
}

export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  const err = requireRole(user, ['super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return ApiResponse.badRequest('Holiday ID is required.')

  const supabase = await createClient()
  const { error } = await supabase.from('holidays').delete().eq('id', id)
  if (error) return ApiResponse.serverError()
  return ApiResponse.ok({ deleted: true })
}
