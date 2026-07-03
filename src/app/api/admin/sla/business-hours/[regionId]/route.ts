import { z } from 'zod'
import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

const UpdateHoursSchema = z.object({
  work_mon: z.boolean().optional(),
  work_tue: z.boolean().optional(),
  work_wed: z.boolean().optional(),
  work_thu: z.boolean().optional(),
  work_fri: z.boolean().optional(),
  work_sat: z.boolean().optional(),
  work_sun: z.boolean().optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ regionId: string }> },
) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()

  const { regionId } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('business_hours')
    .select('*, region:regions(name, code, timezone)')
    .eq('region_id', regionId)
    .single()

  if (!data) return ApiResponse.notFound('Business hours not found for this region.')
  return ApiResponse.ok(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ regionId: string }> },
) {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  const err = requireRole(user, ['super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  const { regionId } = await params
  let body: unknown
  try { body = await request.json() } catch { return ApiResponse.badRequest('Invalid JSON.') }

  const parsed = UpdateHoursSchema.safeParse(body)
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? 'Validation failed.')

  if (parsed.data.start_time && parsed.data.end_time) {
    if (parsed.data.start_time >= parsed.data.end_time) {
      return ApiResponse.badRequest('Start time must be before end time.')
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('business_hours')
    .upsert({ region_id: regionId, ...parsed.data }, { onConflict: 'region_id' })
    .select()
    .single()

  if (error) return ApiResponse.serverError()
  return ApiResponse.ok(data)
}
