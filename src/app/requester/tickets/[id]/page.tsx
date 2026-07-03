import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTicketById, getTicketTimeline } from '@/services/ticket.service'
import { StatusBadge } from '@/features/tickets/components/StatusBadge'
import { PriorityBadge } from '@/features/tickets/components/PriorityBadge'
import { ActivityTimeline } from '@/features/tickets/components/ActivityTimeline'
import { CommentComposer } from '@/features/tickets/components/CommentComposer'
import { formatDateTime, slaCountdown } from '@/lib/ticket/sla'
import { cn } from '@/lib/utils'
import { ChevronRight, User, MapPin, Tag, Clock, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Ticket Detail' }

const TYPE_LABELS: Record<string, string> = {
  it_service: 'IT Service', data_service: 'Data Service',
}
const SUBTYPE_LABELS: Record<string, string> = {
  hardware: 'Hardware', software: 'Software',
  analysis: 'Analysis', discrepancy: 'Discrepancy', issues: 'Issues',
}

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ submitted?: string }>
}

export default async function TicketDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { submitted } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [ticket, timeline] = await Promise.all([
    getTicketById(supabase, id),
    getTicketTimeline(supabase, id),
  ])

  if (!ticket) notFound()

  const { data: currentUser } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  const isStaff = ['dept_user', 'manager', 'super_admin'].includes(currentUser?.role ?? '')
  const ackSla = ticket.sla_ack_deadline
    ? slaCountdown(new Date(ticket.sla_ack_deadline))
    : null

  return (
    <div className="max-w-5xl">
      {/* Success banner */}
      {submitted === 'true' && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Ticket submitted successfully!</p>
            <p className="text-xs text-green-700">
              Reference: <strong>{ticket.ticket_number}</strong>. You will receive an email confirmation shortly.
            </p>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
        <Link href="/requester/dashboard" className="hover:text-[#1E40AF]">My Tickets</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono text-slate-700">{ticket.ticket_number}</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 sm:px-6 py-4 sm:py-5 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-sm text-slate-400">{ticket.ticket_number}</span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 leading-snug">{ticket.title}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {TYPE_LABELS[ticket.request_type]} — {SUBTYPE_LABELS[ticket.sub_type]}
            </p>
          </div>

          {/* SLA indicator */}
          {ackSla && ticket.status === 'new' && (
            <div
              className={cn(
                'flex-shrink-0 rounded-lg border px-3 py-2 text-right',
                ackSla.isBreached
                  ? 'bg-red-50 border-red-200'
                  : ackSla.isWarning
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-slate-50 border-slate-200',
              )}
            >
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Acknowledgment SLA</p>
              <p
                className={cn(
                  'text-sm font-bold mt-0.5',
                  ackSla.isBreached ? 'text-red-600' : ackSla.isWarning ? 'text-amber-600' : 'text-slate-700',
                )}
              >
                {ackSla.label}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <div className="bg-white rounded-xl border border-slate-200 px-4 sm:px-6 py-4 sm:py-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Description</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed break-words">
              {ticket.description}
            </p>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 px-4 sm:px-6 py-4 sm:py-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Activity Timeline</h2>
            <ActivityTimeline entries={timeline as Parameters<typeof ActivityTimeline>[0]['entries']} />
          </div>

          {/* Add comment */}
          {ticket.status !== 'closed' && (
            <div className="bg-white rounded-xl border border-slate-200 px-4 sm:px-6 py-4 sm:py-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                {isStaff ? 'Add Reply or Note' : 'Add Reply'}
              </h2>
              <CommentComposer ticketId={ticket.id} canAddInternal={isStaff} />
            </div>
          )}
        </div>

        {/* Meta panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Details</p>
              <dl className="space-y-3">
                <MetaRow icon={User} label="Requester" value={ticket.requester.full_name} />
                <MetaRow
                  icon={User}
                  label="Assignee"
                  value={ticket.assignee?.full_name ?? 'Unassigned'}
                  valueClass={!ticket.assignee ? 'text-amber-600 font-medium' : undefined}
                />
                <MetaRow icon={Tag} label="Type" value={`${TYPE_LABELS[ticket.request_type]} — ${SUBTYPE_LABELS[ticket.sub_type]}`} />
                <MetaRow icon={Clock} label="Submitted" value={formatDateTime(ticket.created_at)} />
                {ticket.sla_ack_deadline && (
                  <MetaRow icon={Clock} label="Ack Deadline" value={formatDateTime(ticket.sla_ack_deadline)} />
                )}
                {ticket.resolved_at && (
                  <MetaRow icon={CheckCircle2} label="Resolved At" value={formatDateTime(ticket.resolved_at)} />
                )}
              </dl>
            </div>
          </div>

          {/* Resolution note */}
          {ticket.resolution_note && (
            <div className="bg-green-50 rounded-xl border border-green-200 px-5 py-4">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Resolution Summary
              </p>
              <p className="text-sm text-green-800 leading-relaxed">{ticket.resolution_note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetaRow({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none">{label}</p>
        <p className={cn('text-sm text-slate-700 mt-0.5 leading-snug', valueClass)}>{value}</p>
      </div>
    </div>
  )
}
