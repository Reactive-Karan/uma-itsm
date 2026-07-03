import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listTickets } from '@/services/ticket.service'
import { TicketCard } from '@/features/tickets/components/TicketCard'
import { StatCard } from '@/components/dashboard/StatCard'
import { AcknowledgeButton } from '@/features/tickets/components/AcknowledgeButton'
import { slaCountdown } from '@/lib/ticket/sla'
import { cn } from '@/lib/utils'
import {
  Inbox, CheckCircle2, AlertTriangle,
  ChevronRight, Timer, Flame,
} from 'lucide-react'
import Link from 'next/link'
import type { TicketStatus } from '@/types/database.types'

export const metadata = { title: 'My Queue' }

const STATUS_TABS: { value: TicketStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Open' },
  { value: 'new', label: 'New' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending_requester', label: 'Pending' },
  { value: 'escalated', label: 'Escalated' },
]

interface PageProps {
  readonly searchParams: Promise<{ status?: string; page?: string }>
}

export default async function DeptUserDashboardPage({ searchParams }: PageProps) {
  const { status = 'all', page: pageStr = '1' } = await searchParams
  const page = Number.parseInt(pageStr, 10) || 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, department_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const firstName = profile.full_name?.split(' ')[0] ?? 'there'

  // Fetch assigned tickets for the current user
  const { tickets: allAssigned } = await listTickets(supabase, { status: 'all', pageSize: 500 })
  const myTickets = allAssigned.filter((t) => t.assignee_id === profile.id)

  // Stats
  const openCount = myTickets.filter((t) => !['resolved', 'closed'].includes(t.status)).length
  const newCount = myTickets.filter((t) => t.status === 'new').length
  const overdueCount = myTickets.filter((t) => {
    const deadline = t.sla_ack_deadline ?? t.sla_res_deadline
    if (!deadline) return false
    return new Date(deadline) < new Date() && !['resolved', 'closed'].includes(t.status)
  }).length
  const resolvedToday = myTickets.filter((t) => {
    if (t.status !== 'resolved' && t.status !== 'closed') return false
    const d = new Date(t.updated_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  // Filter for display
  const statusFilter = status === 'all'
    ? ['new', 'acknowledged', 'in_progress', 'pending_requester', 'escalated'] as TicketStatus[]
    : [status as TicketStatus]

  const filtered = myTickets
    .filter((t) => statusFilter.includes(t.status))
    .sort((a, b) => {
      const aDeadline = a.sla_ack_deadline ?? a.sla_res_deadline
      const bDeadline = b.sla_ack_deadline ?? b.sla_res_deadline
      if (!aDeadline && !bDeadline) return 0
      if (!aDeadline) return 1
      if (!bDeadline) return -1
      return new Date(aDeadline).getTime() - new Date(bDeadline).getTime()
    })

  const pageSize = 15
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  const escalated = myTickets.filter((t) => t.status === 'escalated')

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Queue</h1>
        <p className="text-slate-500 text-sm mt-0.5">Welcome back, {firstName}. Your active support assignments.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open"
          value={openCount}
          description="Needs attention"
          icon={Inbox}
          iconColor="text-[#1E40AF]"
          iconBg="bg-[#EFF6FF]"
        />
        <StatCard
          label="To Acknowledge"
          value={newCount}
          description={newCount > 0 ? 'Action required' : 'All clear'}
          icon={CheckCircle2}
          iconColor={newCount > 0 ? 'text-amber-600' : 'text-green-600'}
          iconBg={newCount > 0 ? 'bg-amber-50' : 'bg-green-50'}
        />
        <StatCard
          label="SLA Overdue"
          value={overdueCount}
          description={overdueCount > 0 ? 'Needs action' : 'All on track'}
          icon={AlertTriangle}
          iconColor={overdueCount > 0 ? 'text-red-600' : 'text-slate-400'}
          iconBg={overdueCount > 0 ? 'bg-red-50' : 'bg-slate-50'}
        />
        <StatCard
          label="Resolved Today"
          value={resolvedToday}
          description="This calendar day"
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main ticket queue */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-wrap gap-2">
            <h2 className="font-semibold text-slate-900">Active Tickets</h2>
            <div className="flex items-center gap-1 overflow-x-auto">
              {STATUS_TABS.map((tab) => (
                <Link
                  key={tab.value}
                  href={`/dept-user/dashboard?status=${tab.value}`}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                    status === tab.value
                      ? 'bg-[#1E40AF] text-white'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          {paged.length === 0 ? (
            <div className="py-12 text-center">
              <Inbox className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-slate-500 text-sm mt-3">Queue is clear</p>
            </div>
          ) : (
            <div>
              {paged.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  href={`/dept-user/tickets/${ticket.id}`}
                />
              ))}
            </div>
          )}

          {filtered.length > pageSize && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
              <span>{filtered.length} total</span>
              <div className="flex gap-2">
                {page > 1 && <Link href={`/dept-user/dashboard?status=${status}&page=${page - 1}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Previous</Link>}
                {page * pageSize < filtered.length && <Link href={`/dept-user/dashboard?status=${status}&page=${page + 1}`} className={cn(buttonVariants({ size: 'sm' }), 'bg-[#1E40AF] hover:bg-[#1e3a8a]')}>Next</Link>}
              </div>
            </div>
          )}
        </div>

        {/* Side panels */}
        <div className="space-y-4">
          {/* Escalated tray */}
          {escalated.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-red-100 bg-red-50 rounded-t-xl">
                <Flame className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-red-800">Escalated</h3>
                <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full border border-red-200">
                  {escalated.length}
                </span>
              </div>
              <div className="divide-y divide-red-100">
                {escalated.slice(0, 3).map((t) => (
                  <Link
                    key={t.id}
                    href={`/dept-user/tickets/${t.id}`}
                    className="block px-4 py-3 hover:bg-red-50 transition-colors"
                  >
                    <p className="text-xs font-mono text-red-400">{t.ticket_number}</p>
                    <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                  </Link>
                ))}
              </div>
              {escalated.length > 3 && (
                <div className="px-4 py-2 border-t border-red-100">
                  <Link href="/dept-user/dashboard?status=escalated" className="text-xs text-red-600 hover:underline flex items-center gap-0.5">
                    View all {escalated.length} <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* New tickets needing acknowledgment */}
          {newCount > 0 && (
            <div className="bg-white rounded-xl border border-amber-200">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-100 bg-amber-50 rounded-t-xl">
                <Timer className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-amber-800">Needs Acknowledgment</h3>
              </div>
              <div className="divide-y divide-amber-100">
                {myTickets.filter((t) => t.status === 'new').slice(0, 3).map((t) => {
                  const sla = t.sla_ack_deadline ? slaCountdown(new Date(t.sla_ack_deadline)) : null
                  let slaColor = 'text-slate-500'
                  if (sla?.isBreached) slaColor = 'text-red-600'
                  else if (sla?.isWarning) slaColor = 'text-amber-600'
                  return (
                    <div key={t.id} className="px-4 py-3">
                      <p className="text-xs font-mono text-slate-400">{t.ticket_number}</p>
                      <p className="text-sm font-medium text-slate-800 truncate mb-1.5">{t.title}</p>
                      {sla && (
                        <p className={cn('text-xs font-medium mb-2', slaColor)}>
                          {sla.label}
                        </p>
                      )}
                      <AcknowledgeButton ticketId={t.id} className="h-7 text-xs px-2.5" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Needed for Link in pagination
import { buttonVariants } from '@/components/ui/button'
