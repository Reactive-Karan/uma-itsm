import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GitBranch, CheckCircle2, XCircle, ChevronRight, PlusCircle } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Routing Rules' }

const TYPE_LABELS: Record<string, string> = { it_service: 'IT Service', data_service: 'Data Service' }
const SUBTYPE_LABELS: Record<string, string> = {
  hardware: 'Hardware', software: 'Software',
  analysis: 'Analysis', discrepancy: 'Discrepancy', issues: 'Issues',
}

export default async function RoutingRulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rules } = await supabase
    .from('routing_rules')
    .select(`
      id, request_type, sub_type, is_active,
      region:regions(name, code),
      primary_user:users!routing_rules_primary_assignee_id_fkey(id, full_name, email),
      backup_user:users!routing_rules_backup_assignee_id_fkey(id, full_name)
    `)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: true })

  const active = rules?.filter((r) => r.is_active) ?? []
  const inactive = rules?.filter((r) => !r.is_active) ?? []

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Routing Rules</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Maps request type + sub-type + region to a named assignee.
          </p>
        </div>
        <Link
          href="/admin/routing/new"
          className={cn(buttonVariants(), 'bg-[#1E40AF] hover:bg-[#1e3a8a] gap-2')}
        >
          <PlusCircle className="h-4 w-4" /> Add Rule
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Rules', value: rules?.length ?? 0 },
          { label: 'Active', value: active.length },
          { label: 'Inactive', value: inactive.length },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Rules table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <GitBranch className="h-4 w-4 text-[#1E40AF]" />
          <h2 className="font-semibold text-slate-900">All Routing Rules</h2>
          <Badge variant="outline" className="ml-auto text-xs">
            {rules?.length ?? 0} total
          </Badge>
        </div>

        {!rules?.length ? (
          <div className="py-12 text-center">
            <GitBranch className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-slate-500 text-sm mt-3">No routing rules configured.</p>
            <p className="text-slate-400 text-xs mt-1">Add rules to enable automatic ticket assignment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Region', 'Type', 'Sub-type', 'Primary Assignee', 'Backup Assignee', 'Status', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => {
                  const region = rule.region as { name: string; code: string } | null
                  const primary = (rule.primary_user as unknown) as { full_name: string; email: string } | null
                  const backup = (rule.backup_user as unknown) as { full_name: string } | null
                  return (
                    <tr key={rule.id} className={cn('hover:bg-slate-50', !rule.is_active && 'opacity-50')}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center h-5 w-8 rounded text-[10px] font-bold bg-[#1E40AF] text-white">
                            {region?.code}
                          </span>
                          <span className="text-slate-700">{region?.name?.split('—')[1]?.trim()}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{TYPE_LABELS[rule.request_type]}</td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className="text-xs">{SUBTYPE_LABELS[rule.sub_type]}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{primary?.full_name ?? '—'}</p>
                        <p className="text-xs text-slate-400">{primary?.email}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">
                        {backup?.full_name ?? <span className="text-slate-300">None</span>}
                      </td>
                      <td className="px-5 py-3">
                        {rule.is_active ? (
                          <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-medium">
                            <XCircle className="h-3 w-3" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/routing/${rule.id}/edit`}
                          className="text-xs text-[#1E40AF] hover:underline flex items-center gap-0.5"
                        >
                          Edit <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="bg-[#EFF6FF] border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">How routing rules work</p>
        <ul className="space-y-0.5 text-xs text-blue-700 list-disc list-inside">
          <li>When a ticket is submitted, the engine matches region + request type + sub-type.</li>
          <li>If the primary assignee is Out of Office, the backup is used automatically.</li>
          <li>If no rule matches or all assignees are OOO, the ticket remains unassigned for Super Admin review.</li>
        </ul>
      </div>
    </div>
  )
}
