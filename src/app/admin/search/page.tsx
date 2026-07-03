import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TicketCard } from '@/features/tickets/components/TicketCard'
import { SearchForm } from './SearchForm'
import { Search } from 'lucide-react'
import type { TicketWithRequester } from '@/services/ticket.service'

export const metadata = { title: 'Ticket Search' }

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function AdminSearchPage({ searchParams }: PageProps) {
  const { q = '', page: pageStr = '1' } = await searchParams
  const page = parseInt(pageStr, 10) || 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let tickets: TicketWithRequester[] = []
  let count = 0
  let note: string | undefined

  if (q.length >= 2) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/admin/search?q=${encodeURIComponent(q)}&page=${page}`,
      { headers: { Cookie: '' }, cache: 'no-store' },
    )
    if (res.ok) {
      const json = await res.json()
      tickets = json.data?.tickets ?? []
      count   = json.data?.count ?? 0
      note    = json.data?.note
    }
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ticket Search</h1>
        <p className="text-sm text-slate-500 mt-0.5">Full-text search across all tickets, all regions.</p>
      </div>

      <SearchForm />

      {note && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">{note}</p>
      )}

      {q.length >= 2 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[#1E40AF]" />
              <h2 className="font-semibold text-slate-900">
                Results for &ldquo;{q}&rdquo;
              </h2>
            </div>
            <span className="text-xs text-slate-500">{count} ticket{count !== 1 ? 's' : ''} found</span>
          </div>

          {tickets.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-slate-500 text-sm mt-3">No tickets found for &ldquo;{q}&rdquo;</p>
              <p className="text-slate-400 text-xs mt-1">Try a different search term or ticket number.</p>
            </div>
          ) : (
            tickets.map((t) => (
              <TicketCard key={t.id} ticket={t} href={`/requester/tickets/${t.id}`} />
            ))
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
          <Search className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-slate-500 text-sm mt-3">Enter at least 2 characters to search</p>
          <p className="text-slate-400 text-xs mt-1">Searches across ticket title, description, and ticket number</p>
        </div>
      )}
    </div>
  )
}
