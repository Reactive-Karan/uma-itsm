import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listTickets } from '@/services/ticket.service'
import { TicketCard } from '@/features/tickets/components/TicketCard'
import { StatCard } from '@/components/dashboard/StatCard'
import {
  Inbox, AlertTriangle, CheckCircle2, Clock, Filter,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { TicketStatus } from '@/types/database.types'

export const metadata = { title: 'Department Tickets' }

const STATUS_TABS: { value: TicketStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending_requester', label: 'Pending' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
]

interface PageProps {
  readonly searchParams: Promise<{ status?: string; page?: string }>
}

export default async function DeptUserTicketsPage({ searchParams }: PageProps) {
  const { status = 'all', page: pageStr = '1' } = await searchParams
  const page = Number.parseInt(pageStr, 10) || 1
  const pageSize = 20

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, department_id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) redirect('/login')

  // All dept tickets via service (RLS already scopes by dept)
  const { tickets: allDeptTickets } = await listTickets(supabase, { status: 'all', pageSize: 500 })
  const deptTickets = allDeptTickets.filter((t) => {
    const st = t as unknown as { department_id: string }
    return st.department_id === profile.department_id
  })

  // Stats
  const open = deptTickets.filter((t) => !['resolved', 'closed'].includes(t.status))
  const escalated = deptTickets.filter((t) => t.status === 'escalated')
  const now = new Date()
  const overdue = open.filter((t) => t.sla_ack_deadline && new Date(t.sla_ack_deadline) < now && t.status === 'new')
  const unassigned = open.filter((t) => !(t as unknown as { assignee_id: string | null }).assignee_id)

  // Filter for display
  const filtered = status === 'all'
    ? deptTickets
    : deptTickets.filter((t) => t.status === status)

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(filtered.length / pageSize)

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Department Tickets</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          All tickets submitted to your department.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open"
          value={open.length}
          description="Needs attention"
          icon={Inbox}
          iconColor="text-[#1E40AF]"
          iconBg="bg-[#EFF6FF]"
        />
        <StatCard
          label="Escalated"
          value={escalated.length}
          description={escalated.length > 0 ? 'Requires action' : 'None active'}
          icon={AlertTriangle}
          iconColor={escalated.length > 0 ? 'text-red-600' : 'text-slate-400'}
          iconBg={escalated.length > 0 ? 'bg-red-50' : 'bg-slate-50'}
        />
        <StatCard
          label="SLA Overdue"
          value={overdue.length}
          description={overdue.length > 0 ? 'Needs acknowledgment' : 'All on track'}
          icon={Clock}
          iconColor={overdue.length > 0 ? 'text-amber-600' : 'text-slate-400'}
          iconBg={overdue.length > 0 ? 'bg-amber-50' : 'bg-slate-50'}
        />
        <StatCard
          label="Unassigned"
          value={unassigned.length}
          description={unassigned.length > 0 ? 'No assignee' : 'All assigned'}
          icon={CheckCircle2}
          iconColor={unassigned.length > 0 ? 'text-orange-500' : 'text-green-600'}
          iconBg={unassigned.length > 0 ? 'bg-orange-50' : 'bg-green-50'}
        />
      </div>

      {/* Tickets table */}
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Header with filters */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 mr-2">
            <Filter className="h-4 w-4 text-slate-400" />
            Filter
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STATUS_TABS.map((tab) => {
              const count = tab.value === 'all'
                ? deptTickets.length
                : deptTickets.filter((t) => t.status === tab.value).length
              return (
                <Link
                  key={tab.value}
                  href={`/dept-user/tickets?status=${tab.value}&page=1`}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                    status === tab.value
                      ? 'bg-[#1E40AF] text-white'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={cn(
                      'text-[10px] px-1 rounded-full font-bold',
                      status === tab.value ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600',
                    )}>
                      {count}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Ticket list */}
        {paged.length === 0 ? (
          <div className="py-14 text-center">
            <Inbox className="h-10 w-10 text-slate-200 mx-auto" />
            <p className="text-slate-500 text-sm font-medium mt-3">
              No tickets found
            </p>
            <p className="text-slate-400 text-xs mt-1">
              {status === 'all' ? 'Your department has no tickets yet.' : 'Try selecting a different status filter.'}
            </p>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/dept-user/tickets?status=${status}&page=${page - 1}`}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/dept-user/tickets?status=${status}&page=${page + 1}`}
                  className="px-3 py-1.5 rounded-lg bg-[#1E40AF] text-white hover:bg-[#1e3a8a] font-medium"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
