'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Search, Download } from 'lucide-react'

const EVENT_TYPES: { value: string; label: string }[] = [
  { value: 'ticket.created',        label: 'Ticket Created' },
  { value: 'ticket.status_changed', label: 'Status Changed' },
  { value: 'ticket.escalated',      label: 'Escalated' },
  { value: 'ticket.resolved',       label: 'Resolved' },
  { value: 'ticket.closed',         label: 'Closed' },
  { value: 'ticket.reassigned',     label: 'Reassigned' },
  { value: 'ticket.comment_added',  label: 'Comment Added' },
  { value: 'ticket.acknowledged',   label: 'Acknowledged' },
  { value: 'user.created',          label: 'User Created' },
  { value: 'user.role_changed',     label: 'Role Changed' },
  { value: 'user.deactivated',      label: 'User Deactivated' },
  { value: 'routing_rule.created',  label: 'Routing Rule Created' },
  { value: 'routing_rule.updated',  label: 'Routing Rule Updated' },
  { value: 'sla_config.updated',    label: 'SLA Config Updated' },
  { value: 'holiday.added',         label: 'Holiday Added' },
]

const ENTITY_TYPES: { value: string; label: string }[] = [
  { value: 'ticket',       label: 'Ticket' },
  { value: 'user',         label: 'User' },
  { value: 'routing_rule', label: 'Routing Rule' },
  { value: 'sla_config',   label: 'SLA Config' },
]

export function AuditFilters() {
  const router = useRouter()
  const sp = useSearchParams()

  const [eventType, setEventType] = useState(sp.get('event_type') ?? '')
  const [entityType, setEntityType] = useState(sp.get('entity_type') ?? '')
  const [from, setFrom] = useState(sp.get('from') ?? '')
  const [to, setTo] = useState(sp.get('to') ?? '')

  function applyFilters() {
    const params = new URLSearchParams()
    if (eventType)  params.set('event_type',  eventType)
    if (entityType) params.set('entity_type', entityType)
    if (from)       params.set('from', from)
    if (to)         params.set('to',   to)
    router.push(`/admin/audit?${params.toString()}`)
  }

  function clearFilters() {
    setEventType(''); setEntityType(''); setFrom(''); setTo('')
    router.push('/admin/audit')
  }

  function buildExportUrl() {
    const params = new URLSearchParams()
    if (entityType) params.set('entity_type', entityType)
    if (from)       params.set('from', from)
    if (to)         params.set('to', to)
    return `/api/admin/audit-log/export?${params.toString()}`
  }

  const selectCls = 'text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1E40AF]'

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5 min-w-[180px]">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Event Type</label>
          <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={selectCls}>
            <option value="">All Events</option>
            {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Entity Type</label>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={selectCls}>
            <option value="">All Entities</option>
            {ENTITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} />
        </div>

        <div className="flex items-end gap-2 ml-auto">
          <button
            onClick={applyFilters}
            className={cn(buttonVariants({ size: 'sm' }), 'bg-[#1E40AF] hover:bg-[#1e3a8a] gap-1.5')}
          >
            <Search className="h-3.5 w-3.5" /> Filter
          </button>
          <button onClick={clearFilters} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Clear
          </button>
          <a
            href={buildExportUrl()}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5 text-[#1E40AF] border-[#1E40AF]')}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        </div>
      </div>
    </div>
  )
}
