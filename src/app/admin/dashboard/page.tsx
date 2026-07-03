import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/dashboard/StatCard'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Globe, AlertTriangle, TrendingDown, Ticket,
  ChevronRight, Activity, CheckCircle2, Bell,
  ScrollText, Users, GitBranch,
} from 'lucide-react'
import Link from 'next/link'
import type { TicketStatus } from '@/types/database.types'

export const metadata = { title: 'Platform Overview' }

const REGIONS = [
  { code: 'KE', name: 'Nairobi',        color: 'bg-blue-500' },
  { code: 'NG', name: 'Lagos',          color: 'bg-indigo-500' },
  { code: 'ZA', name: 'Johannesburg',   color: 'bg-violet-500' },
  { code: 'GH', name: 'Accra',          color: 'bg-cyan-500' },
  { code: 'TZ', name: 'Dar es Salaam',  color: 'bg-teal-500' },
  { code: 'EG', name: 'Cairo',          color: 'bg-emerald-500' },
  { code: 'MA', name: 'Casablanca',     color: 'bg-amber-500' },
  { code: 'UG', name: 'Kampala',        color: 'bg-orange-500' },
  { code: 'ZW', name: 'Harare',         color: 'bg-rose-500' },
  { code: 'MU', name: 'Mauritius',      color: 'bg-pink-500' },
]

const STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'New', acknowledged: 'Acknowledged', in_progress: 'In Progress',
  pending_requester: 'Pending', escalated: 'Escalated',
  resolved: 'Resolved', closed: 'Closed',
}
const STATUS_COLOUR: Record<TicketStatus, string> = {
  new: 'bg-slate-100 text-slate-700', acknowledged: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-indigo-50 text-indigo-700', pending_requester: 'bg-amber-50 text-amber-700',
  escalated: 'bg-red-50 text-red-700', resolved: 'bg-green-50 text-green-700',
  closed: 'bg-slate-50 text-slate-500',
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('full_name').eq('auth_id', user.id).single()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Admin'

  const now = new Date()
  const start7d = new Date(now.getTime() - 7 * 86_400_000).toISOString()

  // Fetch all metrics in parallel
  const [
    { data: allTickets },
    { data: recentActivity },
    { data: notifPending },
    { data: regionData },
    { data: recentAudit },
  ] = await Promise.all([
    supabase.from('tickets').select('id, status, priority, escalation_count, region_id, sla_ack_deadline, sla_res_deadline, created_at'),
    supabase.from('tickets').select('id, ticket_number, status, created_at').gte('created_at', start7d).order('created_at', { ascending: false }).limit(5),
    supabase.from('notifications').select('id', { count: 'exact' }).eq('status', 'pending'),
    supabase.from('regions').select('id, code, name').eq('is_active', true),
    supabase.from('audit_log').select('id, event_type, actor_name, entity_ref, created_at').order('created_at', { ascending: false }).limit(8),
  ])

  const tickets = allTickets ?? []
  const open    = tickets.filter((t) => !['resolved', 'closed'].includes(t.status))
  const escalated = tickets.filter((t) => t.status === 'escalated')
  const breached  = open.filter((t) => {
    const d = t.sla_ack_deadline ?? t.sla_res_deadline
    return d && new Date(d) < now
  })
  const slaCompliance = open.length > 0
    ? Math.round(((open.length - breached.length) / open.length) * 100)
    : 100

  // Status distribution
  const byStatus: Partial<Record<TicketStatus, number>> = {}
  for (const t of tickets) {
    byStatus[t.status as TicketStatus] = (byStatus[t.status as TicketStatus] ?? 0) + 1
  }

  // Per-region open count
  type RegionRow = { id: string; code: string; name: string }
  const regionMap = new Map((regionData ?? []).map((r: RegionRow) => [r.id, r]))
  const regionTickets: Record<string, { code: string; name: string; open: number; escalated: number; total: number }> = {}
  for (const t of tickets) {
    const r = regionMap.get(t.region_id) as RegionRow | undefined
    if (!r) continue
    if (!regionTickets[r.code]) regionTickets[r.code] = { code: r.code, name: r.name, open: 0, escalated: 0, total: 0 }
    regionTickets[r.code].total++
    if (!['resolved', 'closed'].includes(t.status)) regionTickets[r.code].open++
    if (t.status === 'escalated') regionTickets[r.code].escalated++
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Welcome, {firstName}. Live cross-entity status across all 10 regions.
          </p>
        </div>
        <Link href="/admin/audit" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2 hidden sm:flex')}>
          <Activity className="h-3.5 w-3.5" /> Audit Log
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Tickets"   value={open.length}        description="All regions" icon={Ticket}       iconColor="text-[#1E40AF]"  iconBg="bg-[#EFF6FF]" />
        <StatCard label="Escalated"        value={escalated.length}   description="Needs attention" icon={AlertTriangle} iconColor={escalated.length > 0 ? 'text-red-600' : 'text-slate-400'}    iconBg={escalated.length > 0 ? 'bg-red-50' : 'bg-slate-50'} />
        <StatCard label="SLA Compliance"   value={`${slaCompliance}%`} description="Open tickets on track" icon={CheckCircle2} iconColor={slaCompliance < 80 ? 'text-amber-600' : 'text-green-600'} iconBg={slaCompliance < 80 ? 'bg-amber-50' : 'bg-green-50'} />
        <StatCard label="Regions Active"   value={10}                 description="All entities online"  icon={Globe}        iconColor="text-green-600"  iconBg="bg-green-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Regional breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Regional Breakdown</h2>
            <Link href="/admin/tickets" className="text-xs text-[#1E40AF] hover:underline flex items-center gap-0.5">
              All tickets <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {REGIONS.map((r) => {
              const data = regionTickets[r.code]
              return (
                <div key={r.code} className="px-5 py-3 flex items-center gap-4">
                  <div className={`h-7 w-7 rounded-md ${r.color} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-[10px] font-bold">{r.code}</span>
                  </div>
                  <p className="flex-1 text-sm font-medium text-slate-800">{r.name}</p>
                  {data ? (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500">{data.total} total</span>
                      <span className={cn('font-medium', data.open > 0 ? 'text-[#1E40AF]' : 'text-slate-400')}>{data.open} open</span>
                      {data.escalated > 0 && (
                        <span className="font-bold text-red-600">{data.escalated} escalated</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">No tickets</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Status distribution */}
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Status Distribution</h3>
            <div className="space-y-2">
              {(Object.entries(byStatus) as [TicketStatus, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([status, cnt]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLOUR[status])}>
                      {STATUS_LABEL[status]}
                    </span>
                    <span className="text-sm font-bold text-slate-700">{cnt}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Notifications + quick links */}
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">System Health</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Bell className="h-3.5 w-3.5 text-slate-400" />
                  Pending notifications
                </div>
                <span className={cn('text-sm font-bold', (notifPending?.length ?? 0) > 10 ? 'text-amber-600' : 'text-green-600')}>
                  {notifPending?.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <TrendingDown className="h-3.5 w-3.5 text-slate-400" />
                  SLA breached
                </div>
                <span className={cn('text-sm font-bold', breached.length > 0 ? 'text-red-600' : 'text-green-600')}>
                  {breached.length}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Quick Actions</p>
              {[
                { label: 'User Management', href: '/admin/users', icon: Users },
                { label: 'Routing Rules', href: '/admin/routing', icon: GitBranch },
                { label: 'SLA Configuration', href: '/admin/sla', icon: CheckCircle2 },
                { label: 'Audit Log', href: '/admin/audit', icon: ScrollText },
              ].map(({ label, href, icon: Icon }) => (
                <Link key={href} href={href} className="flex items-center justify-between py-1 text-sm text-slate-600 hover:text-[#1E40AF] group">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#1E40AF]" />
                    {label}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#1E40AF]" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent audit activity */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-[#1E40AF]" />
            <h2 className="font-semibold text-slate-900">Recent Audit Activity</h2>
          </div>
          <Link href="/admin/audit" className="text-xs text-[#1E40AF] hover:underline flex items-center gap-0.5">
            Full log <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {!recentAudit?.length ? (
          <div className="py-8 text-center text-sm text-slate-400">No audit entries yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentAudit.map((e) => (
              <div key={e.id} className="flex items-center gap-4 px-5 py-3">
                <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Activity className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{e.event_type}</p>
                  <p className="text-[10px] text-slate-400">
                    by {e.actor_name}
                    {e.entity_ref ? ` · ${e.entity_ref}` : ''}
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 flex-shrink-0">
                  {new Date(e.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
