import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { queryAuditLog } from '@/services/audit.service'
import { AuditFilters } from './AuditFilters'
import { formatDateTime } from '@/lib/ticket/sla'
import { ScrollText, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export const metadata = { title: 'Audit Log' }

const EVENT_COLOURS: Record<string, string> = {
  'ticket.created':       'bg-blue-50 text-blue-700 border-blue-200',
  'ticket.status_changed':'bg-indigo-50 text-indigo-700 border-indigo-200',
  'ticket.escalated':     'bg-red-50 text-red-700 border-red-200',
  'ticket.resolved':      'bg-green-50 text-green-700 border-green-200',
  'ticket.closed':        'bg-slate-50 text-slate-600 border-slate-200',
  'user.created':         'bg-violet-50 text-violet-700 border-violet-200',
  'user.role_changed':    'bg-amber-50 text-amber-700 border-amber-200',
  'user.deactivated':     'bg-red-50 text-red-700 border-red-200',
}
const DEFAULT_EVENT_COLOUR = 'bg-slate-50 text-slate-600 border-slate-200'

interface PageProps {
  searchParams: Promise<{
    event_type?: string; entity_type?: string
    from?: string; to?: string; page?: string
  }>
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  const {
    event_type, entity_type, from, to, page: pageStr = '1',
  } = await searchParams
  const page = parseInt(pageStr, 10) || 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { entries, count } = await queryAuditLog(supabase, {
    eventType:  event_type,
    entityType: entity_type,
    fromDate:   from,
    toDate:     to ? `${to}T23:59:59Z` : undefined,
    page,
    pageSize:   50,
  })

  const totalPages = Math.ceil((count ?? 0) / 50)

  return (
    <div className="max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Immutable record of all platform activity. {count?.toLocaleString()} entries.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
          <Shield className="h-3.5 w-3.5" />
          Append-only · Tamper-proof
        </div>
      </div>

      {/* Filters */}
      <AuditFilters />

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-[#1E40AF]" />
            <h2 className="font-semibold text-slate-900">Log Entries</h2>
          </div>
          <Badge variant="outline" className="text-xs">
            Page {page} of {totalPages || 1}
          </Badge>
        </div>

        {entries.length === 0 ? (
          <div className="py-12 text-center">
            <ScrollText className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-slate-400 text-sm mt-3">No audit log entries match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Timestamp', 'Event', 'Actor', 'Entity', 'Reference', 'IP'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500 font-mono whitespace-nowrap">
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        EVENT_COLOURS[entry.event_type] ?? DEFAULT_EVENT_COLOUR,
                      )}>
                        {entry.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800">{entry.actor_name}</p>
                      <p className="text-slate-400">{entry.actor_role}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 capitalize">{entry.entity_type}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-700 whitespace-nowrap">
                      {entry.entity_ref || entry.entity_id.slice(0, 8) + '…'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 font-mono">
                      {entry.ip_address ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, count ?? 0)} of {count?.toLocaleString()}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/audit?page=${page - 1}${event_type ? `&event_type=${event_type}` : ''}${entity_type ? `&entity_type=${entity_type}` : ''}`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/audit?page=${page + 1}${event_type ? `&event_type=${event_type}` : ''}${entity_type ? `&entity_type=${entity_type}` : ''}`}
                  className={cn(buttonVariants({ size: 'sm' }), 'bg-[#1E40AF] hover:bg-[#1e3a8a]')}
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
