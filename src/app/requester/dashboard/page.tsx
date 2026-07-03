import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listTickets } from '@/services/ticket.service'
import { TicketCard } from '@/features/tickets/components/TicketCard'
import { StatCard } from '@/components/dashboard/StatCard'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Ticket, CheckCircle2, Clock, PlusCircle, ChevronRight, ListFilter } from 'lucide-react'
import Link from 'next/link'
import type { TicketStatus } from '@/types/database.types'

export const metadata = { title: 'My Tickets' }

const STATUS_TABS: { value: TicketStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'new',       label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending_requester', label: 'Pending You' },
  { value: 'resolved',  label: 'Resolved' },
]

interface PageProps {
  readonly searchParams: Promise<{ status?: string; page?: string }>
}

export default async function RequesterDashboardPage({ searchParams }: PageProps) {
  const { status = 'all', page: pageStr = '1' } = await searchParams
  const page = Number.parseInt(pageStr, 10) || 1

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, region_id')
    .eq('auth_id', user.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  // Fetch tickets (RLS ensures only this user's tickets are returned)
  const [{ tickets, count }, { tickets: allTickets }] = await Promise.all([
    listTickets(supabase, { status: status as TicketStatus | 'all', page, pageSize: 15 }),
    listTickets(supabase, { status: 'all', pageSize: 500 }),
  ])

  // Compute summary stats
  const openCount = allTickets.filter((t) => !['resolved', 'closed'].includes(t.status)).length
  const resolvedThisMonth = allTickets.filter((t) => {
    if (t.status !== 'resolved' && t.status !== 'closed') return false
    const d = new Date(t.updated_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const pendingYou = allTickets.filter((t) => t.status === 'pending_requester').length

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
            Good morning, {firstName}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Here&apos;s a summary of your support requests.</p>
        </div>
        {/* Desktop: full label / Mobile: icon only */}
        <Link
          href="/requester/tickets/new"
          className={cn(buttonVariants(), 'bg-[#1E40AF] hover:bg-[#1e3a8a] gap-2 shrink-0 hidden sm:flex')}
        >
          <PlusCircle className="h-4 w-4" />
          Submit a Ticket
        </Link>
        <Link
          href="/requester/tickets/new"
          aria-label="Submit a ticket"
          className={cn(buttonVariants({ size: 'icon' }), 'bg-[#1E40AF] hover:bg-[#1e3a8a] shrink-0 sm:hidden h-10 w-10')}
        >
          <PlusCircle className="h-5 w-5" />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open Tickets"
          value={openCount}
          description="Awaiting resolution"
          icon={Ticket}
          iconColor="text-[#1E40AF]"
          iconBg="bg-[#EFF6FF]"
        />
        <StatCard
          label="Pending Your Input"
          value={pendingYou}
          description={pendingYou > 0 ? 'Action needed' : 'None waiting'}
          icon={Clock}
          iconColor={pendingYou > 0 ? 'text-amber-600' : 'text-slate-400'}
          iconBg={pendingYou > 0 ? 'bg-amber-50' : 'bg-slate-50'}
        />
        <StatCard
          label="Resolved This Month"
          value={resolvedThisMonth}
          description="Last 30 days"
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          label="Total Submitted"
          value={allTickets.length}
          description="All time"
          icon={ListFilter}
          iconColor="text-slate-500"
          iconBg="bg-slate-100"
        />
      </div>

      {/* Ticket list */}
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Header + filter tabs */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-4 flex-wrap">
          <h2 className="font-semibold text-slate-900">My Tickets</h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={`/requester/dashboard?status=${tab.value}`}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
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

        {/* Ticket list */}
        {tickets.length === 0 ? (
          <div className="py-12 text-center">
            <Ticket className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-slate-500 text-sm mt-3 font-medium">
              {status === 'all' ? 'No tickets yet' : `No ${status.replace('_', ' ')} tickets`}
            </p>
            {status === 'all' && (
              <>
                <p className="text-slate-400 text-xs mt-1">Submit your first support request to get started.</p>
                <Link
                  href="/requester/tickets/new"
                  className={cn(buttonVariants({ size: 'sm' }), 'mt-4 bg-[#1E40AF] hover:bg-[#1e3a8a]')}
                >
                  Submit a Ticket
                </Link>
              </>
            )}
          </div>
        ) : (
          <div>
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                href={`/requester/tickets/${ticket.id}`}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {count > 15 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, count)} of {count} tickets
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/requester/dashboard?status=${status}&page=${page - 1}`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  Previous
                </Link>
              )}
              {page * 15 < count && (
                <Link
                  href={`/requester/dashboard?status=${status}&page=${page + 1}`}
                  className={cn(buttonVariants({ size: 'sm' }), 'bg-[#1E40AF] hover:bg-[#1e3a8a]')}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
