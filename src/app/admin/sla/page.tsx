import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Clock, Globe, CalendarX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'SLA Configuration' }

const WORKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default async function SlaConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: regions }, { data: allBizHours }, { data: upcomingHolidays }] = await Promise.all([
    supabase.from('regions').select('id, name, code, timezone').eq('is_active', true).order('name'),
    supabase.from('business_hours').select('*'),
    supabase
      .from('holidays')
      .select('*, region:regions(code)')
      .gte('holiday_date', new Date().toISOString().slice(0, 10))
      .order('holiday_date', { ascending: true })
      .limit(20),
  ])

  const bizHoursMap = Object.fromEntries((allBizHours ?? []).map((bh) => [bh.region_id, bh]))

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">SLA Configuration</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Business hours and public holidays per region. Used for SLA deadline calculation.
        </p>
      </div>

      {/* SLA windows reference */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-[#1E40AF]" />
          <h2 className="font-semibold text-slate-900 text-sm">SLA Windows (Business Hours)</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Acknowledgment', value: '4 business hours', priority: 'All priorities', color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { label: 'High Priority', value: '8 business hours', priority: 'Resolution', color: 'bg-red-50 border-red-200 text-red-700' },
            { label: 'Medium Priority', value: '24 business hours', priority: 'Resolution', color: 'bg-amber-50 border-amber-200 text-amber-700' },
            { label: 'Low Priority', value: '72 business hours', priority: 'Resolution', color: 'bg-slate-50 border-slate-200 text-slate-600' },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg border p-3 ${s.color}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{s.priority}</p>
              <p className="text-sm font-bold mt-0.5">{s.value}</p>
              <p className="text-xs mt-0.5 opacity-80">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Business hours per region */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Globe className="h-4 w-4 text-[#1E40AF]" />
          <h2 className="font-semibold text-slate-900">Business Hours by Region</h2>
          <Badge variant="outline" className="ml-auto text-xs">{regions?.length ?? 0} regions</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Region', 'Timezone', 'Working Days', 'Hours', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(regions ?? []).map((region) => {
                const bh = bizHoursMap[region.id]
                const workdays = bh
                  ? [bh.work_sun, bh.work_mon, bh.work_tue, bh.work_wed, bh.work_thu, bh.work_fri, bh.work_sat]
                    .map((w, i) => w ? WORKDAY_LABELS[i] : null)
                    .filter(Boolean)
                    .join(', ')
                  : 'Not configured'

                return (
                  <tr key={region.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center h-5 w-8 rounded text-[10px] font-bold bg-[#1E40AF] text-white">
                          {region.code}
                        </span>
                        <span className="text-slate-700 font-medium">{region.name.split('—')[1]?.trim()}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 font-mono">{region.timezone}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{workdays}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {bh ? `${bh.start_time} – ${bh.end_time}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <a href={`/admin/sla/${region.id}`} className="text-xs text-[#1E40AF] hover:underline">
                        Edit
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming holidays */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <CalendarX className="h-4 w-4 text-amber-500" />
          <h2 className="font-semibold text-slate-900">Upcoming Public Holidays</h2>
          <p className="text-xs text-slate-400 ml-auto">Next 12 months · SLA timers pause on these dates</p>
        </div>
        {!upcomingHolidays?.length ? (
          <div className="py-8 text-center text-sm text-slate-400">
            No holidays configured. Add holidays per region to exclude them from SLA calculations.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcomingHolidays.map((h) => {
              const region = h.region as { code: string } | null
              return (
                <div key={h.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-amber-700 uppercase">
                      {region?.code}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{h.label}</p>
                    <p className="text-xs text-slate-400">{h.holiday_date}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
