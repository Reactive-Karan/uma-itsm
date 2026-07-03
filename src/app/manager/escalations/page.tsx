import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatusBadge } from '@/features/tickets/components/StatusBadge'
import { PriorityBadge } from '@/features/tickets/components/PriorityBadge'
import { slaCountdown, formatDateTime } from '@/lib/ticket/sla'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertTriangle, Flame, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Escalations' }

export default async function ManagerEscalationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('department_id, full_name')
    .eq('auth_id', user.id)
    .single()

  // All escalated tickets in manager's department
  const { data: escalated } = await supabase
    .from('tickets')
    .select(`
      id, ticket_number, title, status, priority,
      escalation_count, last_escalated_at, sla_res_deadline, created_at,
      requester:users!tickets_requester_id_fkey(full_name, email),
      assignee:users!tickets_assignee_id_fkey(id, full_name)
    `)
    .eq('status', 'escalated')
    .eq('department_id', profile?.department_id ?? '')
    .order('last_escalated_at', { ascending: true })

  // Historical escalation events for context
  const escalatedIds = (escalated ?? []).map((t) => t.id)
  const { data: escEvents } = escalatedIds.length > 0
    ? await supabase
        .from('escalation_events')
        .select('ticket_id, escalation_type, miss_duration_minutes, created_at')
        .in('ticket_id', escalatedIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  type EscEvent = { ticket_id: string; escalation_type: string; miss_duration_minutes: number | null; created_at: string }
  const eventsMap = new Map<string, EscEvent[]>()
  for (const ev of (escEvents ?? []) as EscEvent[]) {
    if (!eventsMap.has(ev.ticket_id)) eventsMap.set(ev.ticket_id, [])
    eventsMap.get(ev.ticket_id)!.push(ev)
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Escalations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {escalated?.length ?? 0} ticket{(escalated?.length ?? 0) !== 1 ? 's' : ''} requiring manager action in your department.
          </p>
        </div>
        {(escalated?.length ?? 0) === 0 && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
            <AlertTriangle className="h-3.5 w-3.5" />
            No active escalations
          </div>
        )}
      </div>

      {(escalated?.length ?? 0) === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-7 w-7 text-green-500" />
          </div>
          <p className="text-slate-700 font-semibold mt-4">All clear</p>
          <p className="text-slate-400 text-sm mt-1">No escalated tickets in your department.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(escalated ?? []).map((ticket) => {
                  const req = (ticket.requester as unknown) as { full_name: string; email: string } | null
                  const asg = (ticket.assignee as unknown) as { id: string; full_name: string } | null
            const resSla = ticket.sla_res_deadline ? slaCountdown(new Date(ticket.sla_res_deadline)) : null
            const events = eventsMap.get(ticket.id) ?? []
            const latestEvent = events[0]

            return (
              <div key={ticket.id} className="bg-white rounded-xl border border-red-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-5 py-4 bg-red-50 border-b border-red-100">
                  <div className="flex items-center gap-3">
                    <Flame className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-slate-500">{ticket.ticket_number}</span>
                        <StatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                        {ticket.escalation_count > 1 && (
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded-full">
                            Escalated ×{ticket.escalation_count}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">{ticket.title}</p>
                    </div>
                  </div>
                  <Link
                    href={`/dept-user/tickets/${ticket.id}`}
                    className={cn(buttonVariants({ size: 'sm' }), 'bg-[#1E40AF] hover:bg-[#1e3a8a] gap-1.5 flex-shrink-0')}
                  >
                    Review <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {/* Details */}
                <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Requester</p>
                    <p className="text-slate-700">{req?.full_name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Assignee</p>
                    <p className="text-slate-700">{asg?.full_name ?? 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Escalated At</p>
                    <p className="text-slate-700">{ticket.last_escalated_at ? formatDateTime(ticket.last_escalated_at) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Resolution SLA</p>
                    {resSla ? (
                      <p className={cn('font-semibold', resSla.isBreached ? 'text-red-600' : resSla.isWarning ? 'text-amber-600' : 'text-slate-700')}>
                        {resSla.label}
                      </p>
                    ) : <p className="text-slate-400">—</p>}
                  </div>
                </div>

                {/* Escalation reason */}
                {latestEvent && (
                  <div className="px-5 pb-4">
                    <p className="text-xs text-red-600 font-medium">
                      Reason: {latestEvent.escalation_type.replace(/_/g, ' ')}
                      {latestEvent.miss_duration_minutes ? ` · ${latestEvent.miss_duration_minutes} min overdue` : ''}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
