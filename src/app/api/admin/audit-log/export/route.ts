import { NextResponse } from 'next/server'
import { getSessionUser, requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { exportAuditLog, auditLogToCsv } from '@/services/audit.service'

/**
 * GET /api/admin/audit-log/export
 * Downloads audit log as a CSV file.
 * Super Admin only. Supports date range and entity_type filters.
 */
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const err = requireRole(user, ['super_admin'])
  if (err) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const supabase = await createClient()

  const entries = await exportAuditLog(supabase, {
    fromDate:   searchParams.get('from') ?? undefined,
    toDate:     searchParams.get('to') ?? undefined,
    entityType: searchParams.get('entity_type') ?? undefined,
  })

  const csv = auditLogToCsv(entries)
  const filename = `uma-itsm-audit-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
