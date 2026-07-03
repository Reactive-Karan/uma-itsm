import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listTickets } from '@/services/ticket.service'
import { TicketCard } from '@/features/tickets/components/TicketCard'
import { TicketFilters } from './TicketFilters'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Ticket, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { TicketStatus, Priority } from '@/types/database.types'

export const metadata = { title: 'All Tickets' }

interface PageProps {
  searchParams: Promise<{
    status?: string; priority?: string
    region_id?: string; request_type?: string; page?: string
  }>
}

export default async function AdminTicketsPage({ searchParams }: PageProps) {
  const { status, priority, region_id, request_type, page: pageStr = '1' } = await searchParams
  const page = parseInt(pageStr, 10) || 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ tickets, count }, { data: regions }] = await Promise.all([
    listTickets(supabase, {
      status: (status as TicketStatus | 'all') ?? 'all',
      priority: priority as Priority | undefined,
      page,
      pageSize: 25,
    }),
    supabase.from('regions').select('id, name, code').eq('is_active', true).order('name'),
  ])

  // Additional filter by region or request_type (not in listTickets, apply post-fetch for now)
  const filtered = tickets.filter((t) => {
    if (region_id && t.region_id !== region_id) return false
    if (request_type && t.request_type !== request_type) return false
    return true
  })

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Tickets</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cross-entity view — all {count?.toLocaleString()} tickets across all 10 regions.
          </p>
        </div>
      </div>

      <TicketFilters regions={regions ?? []} />

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-[#1E40AF]" />
            <h2 className="font-semibold text-slate-900">Tickets</h2>
          </div>
          <span className="text-xs text-slate-500">{count?.toLocaleString()} total</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Ticket className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-slate-400 text-sm mt-3">No tickets match the current filters.</p>
          </div>
        ) : (
          filtered.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              href={`/requester/tickets/${ticket.id}`}
            />
          ))
        )}

        {(count ?? 0) > 25 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>Page {page}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/admin/tickets?page=${page - 1}&${new URLSearchParams({ status: status ?? '', priority: priority ?? '', region_id: region_id ?? '' }).toString()}`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Previous</Link>
              )}
              {page * 25 < (count ?? 0) && (
                <Link href={`/admin/tickets?page=${page + 1}&${new URLSearchParams({ status: status ?? '', priority: priority ?? '', region_id: region_id ?? '' }).toString()}`}
                  className={cn(buttonVariants({ size: 'sm' }), 'bg-[#1E40AF] hover:bg-[#1e3a8a] gap-1')}>
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
