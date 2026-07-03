import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTicketById, getTicketTimeline } from '@/services/ticket.service'
import { StatusBadge } from '@/features/tickets/components/StatusBadge'
import { PriorityBadge } from '@/features/tickets/components/PriorityBadge'
import { ActivityTimeline } from '@/features/tickets/components/ActivityTimeline'
import { CommentComposer } from '@/features/tickets/components/CommentComposer'
import { AcknowledgeButton } from '@/features/tickets/components/AcknowledgeButton'
import { StatusUpdatePanel } from '@/features/tickets/components/StatusUpdatePanel'
import { formatDateTime, slaCountdown } from '@/lib/ticket/sla'
import { cn } from '@/lib/utils'
import { ChevronRight, User, Clock, Tag, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Ticket Detail' }

const TYPE_LABELS: Record<string, string> = { it_service: 'IT Service', data_service: 'Data Service' }
const SUBTYPE_LABELS: Record<string, string> = {
  hardware: 'Hardware', software: 'Software',
  analysis: 'Analysis', discrepancy: 'Discrepancy', issues: 'Issues',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DeptUserTicketDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  const [ticket, timeline] = await Promise.all([
    getTicketById(supabase, id),
    getTicketTimeline(supabase, id),
  ])

  if (!ticket) notFound()

  const ackSla = ticket.sla_ack_deadline ? slaCountdown(new Date(ticket.sla_ack_deadline)) : null
  const resSla = ticket.sla_res_deadline ? slaCountdown(new Date(ticket.sla_res_deadline)) : null
  const isAssignedToMe = ticket.assignee_id === me?.id

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
        <Link href="/dept-user/dashboard" className="hover:text-[#1E40AF]">My Queue</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono text-slate-700">{ticket.ticket_number}</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-5 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-sm text-slate-400">{ticket.ticket_number}</span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {ticket.escalation_count > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Escalated ×{ticket.escalation_count}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 leading-snug">{ticket.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{TYPE_LABELS[ticket.request_type]} — {SUBTYPE_LABELS[ticket.sub_type]}</p>
          </div>

          {/* SLA indicators */}
          <div className="flex gap-2 flex-shrink-0">
            {ackSla && ticket.status === 'new' && (
              <div className={cn('rounded-lg border px-3 py-2 text-right', ackSla.isBreached ? 'bg-red-50 border-red-200' : ackSla.isWarning ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200')}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Ack SLA</p>
                <p className={cn('text-sm font-bold', ackSla.isBreached ? 'text-red-600' : ackSla.isWarning ? 'text-amber-600' : 'text-slate-700')}>{ackSla.label}</p>
              </div>
            )}
            {resSla && !['resolved', 'closed', 'pending_requester'].includes(ticket.status) && (
              <div className={cn('rounded-lg border px-3 py-2 text-right', resSla.isBreached ? 'bg-red-50 border-red-200' : resSla.isWarning ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200')}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Res SLA</p>
                <p className={cn('text-sm font-bold', resSla.isBreached ? 'text-red-600' : resSla.isWarning ? 'text-amber-600' : 'text-slate-700')}>{resSla.label}</p>
              </div>
            )}
          </div>
        </div>

        {/* Acknowledge CTA for new tickets */}
        {ticket.status === 'new' && isAssignedToMe && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-600 mb-2">This ticket requires acknowledgment. Acknowledging starts your resolution SLA clock and notifies the requester.</p>
            <AcknowledgeButton ticketId={ticket.id} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 px-6 py-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Description</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 px-6 py-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Activity Timeline</h2>
            <ActivityTimeline entries={timeline as Parameters<typeof ActivityTimeline>[0]['entries']} />
          </div>

          {!['resolved', 'closed'].includes(ticket.status) && (
            <div className="bg-white rounded-xl border border-slate-200 px-6 py-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Add Reply or Note</h2>
              <CommentComposer ticketId={ticket.id} canAddInternal />
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Status control */}
          {isAssignedToMe && !['resolved', 'closed', 'new'].includes(ticket.status) && (
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
              <StatusUpdatePanel ticketId={ticket.id} currentStatus={ticket.status} />
            </div>
          )}

          {/* Meta */}
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Details</p>
              <dl className="space-y-3">
                {[
                  { icon: User, label: 'Requester', value: ticket.requester.full_name },
                  { icon: User, label: 'Assignee', value: ticket.assignee?.full_name ?? 'Unassigned', valueClass: !ticket.assignee ? 'text-amber-600 font-medium' : undefined },
                  { icon: Tag, label: 'Type', value: `${TYPE_LABELS[ticket.request_type]} — ${SUBTYPE_LABELS[ticket.sub_type]}` },
                  { icon: Clock, label: 'Submitted', value: formatDateTime(ticket.created_at) },
                  ...(ticket.sla_ack_deadline ? [{ icon: Clock, label: 'Ack Deadline', value: formatDateTime(ticket.sla_ack_deadline) }] : []),
                  ...(ticket.sla_res_deadline ? [{ icon: Clock, label: 'Res Deadline', value: formatDateTime(ticket.sla_res_deadline) }] : []),
                ].map(({ icon: Icon, label, value, valueClass }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <Icon className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
                      <p className={cn('text-sm text-slate-700 mt-0.5', valueClass)}>{value}</p>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {ticket.resolution_note && (
            <div className="bg-green-50 rounded-xl border border-green-200 px-5 py-4">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Resolution</p>
              <p className="text-sm text-green-800 leading-relaxed">{ticket.resolution_note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
