import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/dashboard/StatCard'
import {
  BarChart2, TrendingUp, Clock, CheckCircle2,
  AlertTriangle, Users, Ticket, Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
export const metadata = { title: 'Reports' }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:               { label: 'New',               color: 'text-blue-700',   bg: 'bg-blue-50' },
  acknowledged:      { label: 'Acknowledged',      color: 'text-indigo-700', bg: 'bg-indigo-50' },
  in_progress:       { label: 'In Progress',       color: 'text-amber-700',  bg: 'bg-amber-50' },
  pending_requester: { label: 'Pending Requester', color: 'text-orange-700', bg: 'bg-orange-50' },
  escalated:         { label: 'Escalated',         color: 'text-red-700',    bg: 'bg-red-50' },
  resolved:          { label: 'Resolved',          color: 'text-green-700',  bg: 'bg-green-50' },
  closed:            { label: 'Closed',            color: 'text-slate-700',  bg: 'bg-slate-100' },
}

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-500' },
  high:     { label: 'High',     color: 'bg-orange-500' },
  medium:   { label: 'Medium',   color: 'bg-amber-400' },
  low:      { label: 'Low',      color: 'bg-blue-400' },
}

export default async function ManagerReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, department_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) redirect('/login')

  // All department tickets (last 90 days for full reporting range)
  const since90d = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const { data: allTickets } = await supabase
    .from('tickets')
    .select('id, status, priority, created_at, updated_at, sla_res_deadline, assignee_id, ticket_number')
    .eq('department_id', profile.department_id ?? '')
    .gte('created_at', since90d)
    .order('created_at', { ascending: false })

  const tickets = allTickets ?? []

  // 30-day subset
  const tickets30d = tickets.filter((t) => t.created_at >= since30d)

  // Core metrics
  const openTickets = tickets30d.filter((t) => !['resolved', 'closed'].includes(t.status))
  const resolvedTickets = tickets30d.filter((t) => ['resolved', 'closed'].includes(t.status))
  const escalatedTickets = tickets30d.filter((t) => t.status === 'escalated')

  const now = new Date()
  const overdueTickets = openTickets.filter((t) => {
    if (!t.sla_res_deadline) return false
    return new Date(t.sla_res_deadline) < now
  })

  // SLA compliance (resolved tickets that were resolved before deadline)
  const resolvedWithDeadline = resolvedTickets.filter((t) => t.sla_res_deadline)
  const resolvedOnTime = resolvedWithDeadline.filter(
    (t) => t.sla_res_deadline && new Date(t.updated_at) <= new Date(t.sla_res_deadline),
  )
  const slaRate = resolvedWithDeadline.length > 0
    ? Math.round((resolvedOnTime.length / resolvedWithDeadline.length) * 100)
    : null

  // Average MTTR (hours) for resolved tickets
  const mttrHours = resolvedTickets.length > 0
    ? Math.round(
        resolvedTickets.reduce((sum, t) => {
          const created = new Date(t.created_at).getTime()
          const resolved = new Date(t.updated_at).getTime()
          return sum + (resolved - created) / 3_600_000
        }, 0) / resolvedTickets.length,
      )
    : null

  // Ticket status breakdown
  const statusBreakdown = Object.entries(
    tickets30d.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])

  // Priority breakdown (open only)
  const priorityBreakdown = Object.entries(
    openTickets.reduce<Record<string, number>>((acc, t) => {
      acc[t.priority] = (acc[t.priority] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])

  // Weekly ticket volume (last 4 weeks)
  const weeklyVolume: { week: string; created: number; resolved: number }[] = []
  for (let w = 3; w >= 0; w--) {
    const weekStart = new Date(Date.now() - (w + 1) * 7 * 86_400_000)
    const weekEnd = new Date(Date.now() - w * 7 * 86_400_000)
    const label = `Wk ${4 - w}`
    weeklyVolume.push({
      week: label,
      created: tickets.filter((t) => {
        const d = new Date(t.created_at)
        return d >= weekStart && d < weekEnd
      }).length,
      resolved: tickets.filter((t) => {
        if (!['resolved', 'closed'].includes(t.status)) return false
        const d = new Date(t.updated_at)
        return d >= weekStart && d < weekEnd
      }).length,
    })
  }
  const maxWeekly = Math.max(...weeklyVolume.flatMap((w) => [w.created, w.resolved]), 1)

  // Team member workload (open tickets per assignee)
  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('role', 'dept_user')
    .eq('department_id', profile.department_id ?? '')
    .eq('is_active', true)

  const workloadMap = new Map<string, { name: string; open: number; resolved: number }>()
  for (const m of teamMembers ?? []) {
    workloadMap.set(m.id, { name: m.full_name, open: 0, resolved: 0 })
  }
  for (const t of tickets30d) {
    if (!t.assignee_id) continue
    const entry = workloadMap.get(t.assignee_id)
    if (!entry) continue
    if (['resolved', 'closed'].includes(t.status)) entry.resolved++
    else entry.open++
  }
  const workload = [...workloadMap.values()].sort((a, b) => b.open - a.open)
  const maxWorkload = Math.max(...workload.map((w) => w.open + w.resolved), 1)

  // Pre-compute StatCard props to avoid nested ternaries in JSX
  let slaValue = '—'
  let slaDescription = 'No resolved tickets'
  let slaIconColor = 'text-slate-400'
  let slaIconBg = 'bg-slate-50'
  if (slaRate !== null) {
    slaValue = `${slaRate}%`
    if (slaRate >= 90) {
      slaDescription = 'Excellent'
      slaIconColor = 'text-green-600'
      slaIconBg = 'bg-green-50'
    } else if (slaRate >= 75) {
      slaDescription = 'Acceptable'
      slaIconColor = 'text-amber-600'
      slaIconBg = 'bg-amber-50'
    } else {
      slaDescription = 'Needs improvement'
      slaIconColor = 'text-red-600'
      slaIconBg = 'bg-red-50'
    }
  }
  const mttrValue = mttrHours === null ? '—' : `${mttrHours}h`

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Department performance metrics — last 30 days.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-[#1E40AF] font-medium">
          <BarChart2 className="h-3.5 w-3.5" />
          30-day view
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open Tickets"
          value={openTickets.length}
          description="Requires attention"
          icon={Ticket}
          iconColor="text-[#1E40AF]"
          iconBg="bg-[#EFF6FF]"
        />
        <StatCard
          label="Resolved (30d)"
          value={resolvedTickets.length}
          description="Closed this period"
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          label="SLA Compliance"
          value={slaValue}
          description={slaDescription}
          icon={Target}
          iconColor={slaIconColor}
          iconBg={slaIconBg}
        />
        <StatCard
          label="Avg MTTR"
          value={mttrValue}
          description="Mean time to resolve"
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
      </div>

      {/* Alert bar */}
      {(overdueTickets.length > 0 || escalatedTickets.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdueTickets.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span><strong>{overdueTickets.length}</strong> tickets are past their SLA resolution deadline.</span>
            </div>
          )}
          {escalatedTickets.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-orange-200 bg-orange-50 text-sm text-orange-700">
              <TrendingUp className="h-4 w-4 shrink-0" />
              <span><strong>{escalatedTickets.length}</strong> escalated tickets require your review.</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly volume chart */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-[#1E40AF]" />
              Weekly Ticket Volume
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Created vs. resolved per week</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-end justify-around gap-4 h-36">
              {weeklyVolume.map((w) => (
                <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-1" style={{ height: '100px' }}>
                    <div
                      className="w-5 rounded-t bg-[#2563EB] transition-all"
                      style={{ height: `${Math.max(4, (w.created / maxWeekly) * 100)}px` }}
                      title={`Created: ${w.created}`}
                    />
                    <div
                      className="w-5 rounded-t bg-green-400 transition-all"
                      style={{ height: `${Math.max(4, (w.resolved / maxWeekly) * 100)}px` }}
                      title={`Resolved: ${w.resolved}`}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">{w.week}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <div className="h-2.5 w-2.5 rounded-sm bg-[#2563EB]" /> Created
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <div className="h-2.5 w-2.5 rounded-sm bg-green-400" /> Resolved
              </div>
            </div>
          </div>
        </div>

        {/* Status distribution */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Ticket className="h-4 w-4 text-[#1E40AF]" />
              Status Distribution
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">All tickets this period by status</p>
          </div>
          <div className="px-5 py-4 space-y-2.5">
            {statusBreakdown.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No tickets in this period.</p>
            )}
            {statusBreakdown.map(([status, count]) => {
              const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-slate-700', bg: 'bg-slate-100' }
              const pct = tickets30d.length > 0 ? Math.round((count / tickets30d.length) * 100) : 0
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full min-w-[110px]', cfg.bg, cfg.color)}>
                    {cfg.label}
                  </span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-[#2563EB] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-14 text-right">{count} ({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Priority breakdown */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#1E40AF]" />
              Open Tickets by Priority
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{openTickets.length} open tickets</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            {priorityBreakdown.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No open tickets.</p>
            )}
            {priorityBreakdown.map(([priority, count]) => {
              const cfg = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] ?? { label: priority, color: 'bg-slate-400' }
              const pct = openTickets.length > 0 ? Math.round((count / openTickets.length) * 100) : 0
              return (
                <div key={priority} className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 min-w-[80px]">
                    <div className={cn('h-2.5 w-2.5 rounded-full', cfg.color)} />
                    <span className="text-xs text-slate-600 font-medium">{cfg.label}</span>
                  </div>
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full transition-all', cfg.color)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-14 text-right">{count} ({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Team workload */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-[#1E40AF]" />
              Team Workload
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Open vs. resolved per team member this period</p>
          </div>
          <div className="divide-y divide-slate-100">
            {workload.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No team members found.</p>
            )}
            {workload.map((m) => {
              const total = m.open + m.resolved
              const openPct = total > 0 ? Math.round((m.open / maxWorkload) * 100) : 0
              const resPct = total > 0 ? Math.round((m.resolved / maxWorkload) * 100) : 0
              const initials = m.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
              return (
                <div key={m.name} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#1E40AF] flex items-center justify-center shrink-0">
                    <span className="text-white text-[11px] font-semibold">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                    <div className="flex items-center gap-1 mt-1" style={{ height: '6px' }}>
                      {openPct > 0 && (
                        <div className="bg-[#2563EB] h-1.5 rounded-full" style={{ width: `${openPct}%` }} />
                      )}
                      {resPct > 0 && (
                        <div className="bg-green-400 h-1.5 rounded-full" style={{ width: `${resPct}%` }} />
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-xs text-slate-500">
                    <span className="text-[#2563EB] font-semibold">{m.open}</span>
                    <span> open </span>
                    <span className="mx-1 text-slate-300">|</span>
                    <span> </span>
                    <span className="text-green-600 font-semibold">{m.resolved}</span>
                    <span> resolved</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
