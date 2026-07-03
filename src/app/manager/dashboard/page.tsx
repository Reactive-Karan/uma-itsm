import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/dashboard/StatCard'
import { StatusBadge } from '@/features/tickets/components/StatusBadge'
import { PriorityBadge } from '@/features/tickets/components/PriorityBadge'
import {
  LayoutDashboard,
  AlertTriangle,
  TrendingUp,
  Clock,
  ChevronRight,
  Flame,
  Users,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { slaCountdown } from '@/lib/ticket/sla'
import { buttonVariants } from '@/components/ui/button'

export const metadata = { title: 'Department Overview' }

export default async function ManagerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, department_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const firstName = profile.full_name?.split(' ')[0] ?? 'there'
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString()

  // All department tickets
  const { data: allTickets } = await supabase
    .from('tickets')
    .select('id, status, priority, created_at, updated_at, sla_res_deadline, sla_ack_deadline, assignee_id, ticket_number, title, last_escalated_at, escalation_count')
    .eq('department_id', profile.department_id ?? '')
    .order('created_at', { ascending: false })

  const tickets = allTickets ?? []
  const openTickets = tickets.filter((t) => !['resolved', 'closed'].includes(t.status))
  const escalatedTickets = openTickets.filter((t) => t.status === 'escalated')

  // SLA compliance (last 30 days resolved tickets)
  const resolved30d = tickets.filter((t) =>
    ['resolved', 'closed'].includes(t.status) && t.updated_at >= since30d,
  )
  const resolvedWithDeadline = resolved30d.filter((t) => t.sla_res_deadline)
  const resolvedOnTime = resolvedWithDeadline.filter(
    (t) => t.sla_res_deadline && new Date(t.updated_at) <= new Date(t.sla_res_deadline),
  )
  const slaRate = resolvedWithDeadline.length > 0
    ? Math.round((resolvedOnTime.length / resolvedWithDeadline.length) * 100)
    : null

  // Avg MTTR (last 30 days)
  const mttrHours = resolved30d.length > 0
    ? Math.round(
        resolved30d.reduce((sum, t) => {
          return sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 3_600_000
        }, 0) / resolved30d.length,
      )
    : null

  // Team members + workload
  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, full_name, is_ooo')
    .eq('role', 'dept_user')
    .eq('department_id', profile.department_id ?? '')
    .eq('is_active', true)
    .order('full_name')

  const workloadMap = new Map<string, { name: string; open: number; initials: string; isOoo: boolean }>()
  for (const m of teamMembers ?? []) {
    const initials = m.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    workloadMap.set(m.id, { name: m.full_name, open: 0, initials, isOoo: m.is_ooo })
  }
  for (const t of openTickets) {
    if (!t.assignee_id) continue
    const entry = workloadMap.get(t.assignee_id)
    if (entry) entry.open++
  }
  const workload = [...workloadMap.values()].sort((a, b) => b.open - a.open)

  // Top escalated tickets for the tray (most recent first)
  const topEscalated = escalatedTickets
    .sort((a, b) => new Date(a.last_escalated_at ?? a.created_at).getTime() - new Date(b.last_escalated_at ?? b.created_at).getTime())
    .slice(0, 4)

  // Pre-compute derived props (avoid nested ternaries in JSX)
  const slaValue = slaRate === null ? '—' : `${slaRate}%`
  const mttrValue = mttrHours === null ? '—' : `${mttrHours}h`
  let slaColor = 'text-slate-400'
  let slaBg = 'bg-slate-50'
  if (slaRate !== null) {
    if (slaRate >= 90) { slaColor = 'text-green-600'; slaBg = 'bg-green-50' }
    else if (slaRate >= 75) { slaColor = 'text-amber-600'; slaBg = 'bg-amber-50' }
    else { slaColor = 'text-red-600'; slaBg = 'bg-red-50' }
  }
  const escalatedDescription = escalatedTickets.length > 0 ? 'Requires action' : 'None active'
  const escalatedColor = escalatedTickets.length > 0 ? 'text-red-600' : 'text-slate-400'
  const escalatedBg = escalatedTickets.length > 0 ? 'bg-red-50' : 'bg-slate-50'

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Department Overview</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Hello, {firstName}. Monitor your team&apos;s service performance.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open Tickets"
          value={openTickets.length}
          description="Across all assignees"
          icon={LayoutDashboard}
          iconColor="text-[#1E40AF]"
          iconBg="bg-[#EFF6FF]"
        />
        <StatCard
          label="Escalated"
          value={escalatedTickets.length}
          description={escalatedDescription}
          icon={AlertTriangle}
          iconColor={escalatedColor}
          iconBg={escalatedBg}
        />
        <StatCard
          label="SLA Rate"
          value={slaValue}
          description="Last 30 days"
          icon={TrendingUp}
          iconColor={slaColor}
          iconBg={slaBg}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Escalation tray — real data */}
        <div className="bg-white rounded-xl border border-red-200">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-red-100 bg-red-50 rounded-t-xl">
            <Flame className="h-4 w-4 text-red-500 shrink-0" />
            <h2 className="font-semibold text-red-800 text-sm">Escalation Tray</h2>
            {escalatedTickets.length > 0 && (
              <span className="ml-auto text-[10px] font-bold text-red-700 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded-full">
                {escalatedTickets.length}
              </span>
            )}
          </div>

          {escalatedTickets.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-300 mx-auto" />
              <p className="text-sm text-slate-500 mt-2">No active escalations</p>
            </div>
          ) : (
            <div className="divide-y divide-red-50">
              {topEscalated.map((t) => {
                const resSla = t.sla_res_deadline ? slaCountdown(new Date(t.sla_res_deadline)) : null
                return (
                  <Link
                    key={t.id}
                    href={`/dept-user/tickets/${t.id}`}
                    className="block px-4 py-3 hover:bg-red-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[10px] text-red-400 shrink-0">{t.ticket_number}</span>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <p className="text-xs font-medium text-slate-800 mt-0.5 line-clamp-2">{t.title}</p>
                    {resSla && (
                      <p className={cn('text-[10px] font-medium mt-1', resSla.isBreached ? 'text-red-600' : 'text-amber-600')}>
                        {resSla.label}
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
          )}

          <div className="px-5 py-3 border-t border-red-100">
            <Link
              href="/manager/escalations"
              className="text-xs text-red-600 hover:underline font-medium flex items-center gap-0.5"
            >
              View all escalations <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Team workload — real data */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#1E40AF]" />
              <h2 className="font-semibold text-slate-900">Team Workload</h2>
            </div>
            <Link
              href="/manager/team"
              className="text-xs text-[#1E40AF] hover:underline font-medium flex items-center gap-0.5"
            >
              Full view <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {workload.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">No team members found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {workload.slice(0, 5).map((m) => (
                <div key={m.name} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#1E40AF] flex items-center justify-center shrink-0">
                    <span className="text-white text-[11px] font-semibold">{m.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-slate-800 truncate max-w-[160px]">{m.name}</p>
                      {m.isOoo && (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
                          OOO
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 bg-[#2563EB] rounded-full transition-all"
                        style={{ width: openTickets.length > 0 ? `${Math.min(100, (m.open / Math.max(...workload.map((w) => w.open), 1)) * 100)}%` : '0%' }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right min-w-[40px]">
                    <p className="text-base font-bold text-slate-900">{m.open}</p>
                    <p className="text-[10px] text-slate-400">open</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {workload.length > 5 && (
            <div className="px-5 py-2.5 border-t border-slate-100 text-center">
              <Link href="/manager/team" className="text-xs text-[#1E40AF] hover:underline">
                +{workload.length - 5} more members
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent open tickets */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Open Tickets</h2>
          <span className="text-xs text-slate-400">{openTickets.length} total open</span>
        </div>

        {openTickets.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-300 mx-auto" />
            <p className="text-sm text-slate-500 mt-2">All tickets resolved</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden">
            {openTickets.slice(0, 8).map((t) => {
              const resSla = t.sla_res_deadline ? slaCountdown(new Date(t.sla_res_deadline)) : null
              let slaLabelColor = 'text-slate-400'
              if (resSla?.isBreached) slaLabelColor = 'text-red-600'
              else if (resSla?.isWarning) slaLabelColor = 'text-amber-600'
              return (
                <Link
                  key={t.id}
                  href={`/dept-user/tickets/${t.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  <span className="font-mono text-[10px] text-slate-400 shrink-0 w-20">{t.ticket_number}</span>
                  <p className="flex-1 text-sm text-slate-800 truncate min-w-0">{t.title}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                    {resSla && (
                      <span className={cn('text-[10px] font-medium hidden sm:block', slaLabelColor)}>
                        {resSla.label}
                      </span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {openTickets.length > 8 && (
          <div className="border-t border-slate-100 px-5 py-3 text-center">
            <Link
              href="/manager/escalations"
              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'text-xs')}
            >
              View all {openTickets.length} open tickets
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
