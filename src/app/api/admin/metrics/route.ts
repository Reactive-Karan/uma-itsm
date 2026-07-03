import { getSessionUser, requireRole, ApiResponse } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/metrics
 *
 * Cross-entity platform metrics for the Super Admin dashboard.
 * Returns aggregate counts by status, region, priority, and SLA compliance.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return ApiResponse.unauthorized()
  const err = requireRole(user, ['super_admin'])
  if (err) return ApiResponse.forbidden(err.message)

  const supabase = await createClient()
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOf7Days  = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const startOf30Days = new Date(now.getTime() - 30 * 86_400_000).toISOString()

  const [
    { data: statusCounts },
    { data: priorityCounts },
    { data: regionBreakdown },
    { data: recentTickets },
    { data: slaData },
    { data: notifQueue },
    { data: escalationCounts },
  ] = await Promise.all([
    // Status distribution
    supabase.from('tickets').select('status').not('status', 'is', null),

    // Priority distribution (open only)
    supabase.from('tickets').select('priority')
      .not('status', 'in', '("resolved","closed")'),

    // Per-region breakdown
    supabase.from('tickets')
      .select('region_id, status, regions!inner(code, name)')
      .gte('created_at', startOf30Days),

    // Recent activity (last 7 days)
    supabase.from('tickets').select('id, created_at, status')
      .gte('created_at', startOf7Days),

    // SLA breached tickets (open, past deadline)
    supabase.from('tickets')
      .select('id, sla_ack_deadline, sla_res_deadline, status')
      .not('status', 'in', '("resolved","closed","pending_requester")')
      .not('sla_ack_deadline', 'is', null),

    // Notification queue status
    supabase.from('notifications')
      .select('status')
      .gte('created_at', startOf7Days),

    // Escalations this week
    supabase.from('tickets')
      .select('id, escalation_count')
      .gt('escalation_count', 0)
      .gte('created_at', startOf7Days),
  ])

  // Status counts
  const byStatus: Record<string, number> = {}
  for (const t of statusCounts ?? []) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1
  }

  // Priority counts (open only)
  const byPriority: Record<string, number> = {}
  for (const t of priorityCounts ?? []) {
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1
  }

  // SLA compliance: percentage of open tickets NOT yet breached
  const openSlaTickets = slaData ?? []
  const breachedCount = openSlaTickets.filter((t) => {
    const d = t.sla_ack_deadline ?? t.sla_res_deadline
    return d && new Date(d) < now
  }).length
  const slaCompliancePercent = openSlaTickets.length > 0
    ? Math.round(((openSlaTickets.length - breachedCount) / openSlaTickets.length) * 100)
    : 100

  // Region breakdown map
  type RegionRow = { region_id: string; status: string; regions: { code: string; name: string } }
  const regionMap: Record<string, { code: string; name: string; total: number; open: number; escalated: number }> = {}
  for (const t of (regionBreakdown as unknown as RegionRow[]) ?? []) {
    const code = t.regions?.code ?? 'XX'
    if (!regionMap[code]) {
      regionMap[code] = { code, name: t.regions?.name ?? '', total: 0, open: 0, escalated: 0 }
    }
    regionMap[code].total++
    if (!['resolved', 'closed'].includes(t.status)) regionMap[code].open++
    if (t.status === 'escalated') regionMap[code].escalated++
  }

  // Notification queue health
  const notifByStatus: Record<string, number> = {}
  for (const n of notifQueue ?? []) {
    notifByStatus[n.status] = (notifByStatus[n.status] ?? 0) + 1
  }

  const totalTickets = statusCounts?.length ?? 0
  const openCount = Object.entries(byStatus)
    .filter(([s]) => !['resolved', 'closed'].includes(s))
    .reduce((sum, [, v]) => sum + v, 0)
  const escalatedCount = byStatus['escalated'] ?? 0
  const resolvedToday = (statusCounts ?? []).filter(
    (t) => t.status === 'resolved' || t.status === 'closed',
  ).length

  return ApiResponse.ok({
    summary: {
      totalTickets,
      openCount,
      escalatedCount,
      resolvedThisMonth: resolvedToday,
      slaCompliancePercent,
      breachedCount,
      newThisWeek: recentTickets?.length ?? 0,
    },
    byStatus,
    byPriority,
    regions: Object.values(regionMap).sort((a, b) => b.total - a.total),
    notifications: {
      pending: notifByStatus['pending'] ?? 0,
      sent:    notifByStatus['sent']    ?? 0,
      failed:  notifByStatus['failed']  ?? 0,
    },
    escalations: escalationCounts?.length ?? 0,
  })
}
