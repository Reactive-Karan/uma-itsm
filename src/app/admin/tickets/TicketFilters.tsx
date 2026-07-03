'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Search } from 'lucide-react'

interface Props {
  regions: { id: string; code: string; name: string }[]
}

export function TicketFilters({ regions }: Props) {
  const router = useRouter()
  const sp = useSearchParams()

  const [status, setStatus]     = useState(sp.get('status') ?? '')
  const [priority, setPriority] = useState(sp.get('priority') ?? '')
  const [regionId, setRegionId] = useState(sp.get('region_id') ?? '')
  const [type, setType]         = useState(sp.get('request_type') ?? '')

  function apply() {
    const params = new URLSearchParams()
    if (status)   params.set('status', status)
    if (priority) params.set('priority', priority)
    if (regionId) params.set('region_id', regionId)
    if (type)     params.set('request_type', type)
    router.push(`/admin/tickets?${params.toString()}`)
  }

  function clear() {
    setStatus(''); setPriority(''); setRegionId(''); setType('')
    router.push('/admin/tickets')
  }

  const sel = 'text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1E40AF]'

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
            <option value="">All Statuses</option>
            {['new','acknowledged','in_progress','pending_requester','escalated','resolved','closed'].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={sel}>
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Region</label>
          <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className={sel}>
            <option value="">All Regions</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.name.split('—')[1]?.trim()}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={sel}>
            <option value="">All Types</option>
            <option value="it_service">IT Service</option>
            <option value="data_service">Data Service</option>
          </select>
        </div>
        <div className="flex items-end gap-2 ml-auto">
          <button onClick={apply} className={cn(buttonVariants({ size: 'sm' }), 'bg-[#1E40AF] hover:bg-[#1e3a8a] gap-1.5')}>
            <Search className="h-3.5 w-3.5" /> Filter
          </button>
          <button onClick={clear} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Clear</button>
        </div>
      </div>
    </div>
  )
}
