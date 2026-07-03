import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/features/tickets/components/StatusBadge'
import { Users, UserCheck, UserX, Clock } from 'lucide-react'

export const metadata = { title: 'Team' }

export default async function ManagerTeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('department_id')
    .eq('auth_id', user.id)
    .single()

  // All dept_users in the same department
  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, full_name, email, is_ooo, is_active, ooo_end_date')
    .eq('role', 'dept_user')
    .eq('department_id', profile?.department_id ?? '')
    .order('full_name')

  // Open tickets per team member
  const { data: openTickets } = await supabase
    .from('tickets')
    .select('id, assignee_id, status, priority, ticket_number, sla_res_deadline')
    .eq('department_id', profile?.department_id ?? '')
    .not('status', 'in', '("resolved","closed")')

  const ticketsByMember = new Map<string, typeof openTickets>()
  for (const t of openTickets ?? []) {
    if (!t.assignee_id) continue
    if (!ticketsByMember.has(t.assignee_id)) ticketsByMember.set(t.assignee_id, [])
    ticketsByMember.get(t.assignee_id)!.push(t)
  }

  const now = new Date()

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Department workload overview — {teamMembers?.length ?? 0} active team members.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Team Members', value: teamMembers?.length ?? 0, icon: Users, color: 'text-[#1E40AF]', bg: 'bg-[#EFF6FF]' },
          { label: 'Available', value: (teamMembers ?? []).filter((m) => !m.is_ooo && m.is_active).length, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Out of Office', value: (teamMembers ?? []).filter((m) => m.is_ooo).length, icon: UserX, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Team member cards */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Users className="h-4 w-4 text-[#1E40AF]" />
          <h2 className="font-semibold text-slate-900">Workload by Member</h2>
          <span className="text-xs text-slate-400 ml-auto">Sorted by open ticket count</span>
        </div>

        {!teamMembers?.length ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No department users found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {(teamMembers ?? [])
              .sort((a, b) => (ticketsByMember.get(b.id)?.length ?? 0) - (ticketsByMember.get(a.id)?.length ?? 0))
              .map((member) => {
                const tickets = ticketsByMember.get(member.id) ?? []
                const overdue = tickets.filter((t) => t.sla_res_deadline && new Date(t.sla_res_deadline) < now)
                const escalated = tickets.filter((t) => t.status === 'escalated')
                const initials = member.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

                return (
                  <div key={member.id} className="px-5 py-4">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="h-9 w-9 rounded-full bg-[#1E40AF] flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-semibold">{initials}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900 truncate max-w-[200px]">{member.full_name}</p>
                          {member.is_ooo && (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] shrink-0">
                              OOO{member.ooo_end_date ? ` until ${member.ooo_end_date}` : ''}
                            </Badge>
                          )}
                          {!member.is_active && (
                            <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px] shrink-0">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{member.email}</p>

                        {/* Ticket mini-list */}
                        {tickets.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {tickets.slice(0, 6).map((t) => (
                              <div key={t.id} className="flex items-center gap-1">
                                <span className="text-[10px] font-mono text-slate-400">{t.ticket_number}</span>
                                <StatusBadge status={t.status} />
                              </div>
                            ))}
                            {tickets.length > 6 && (
                              <span className="text-[10px] text-slate-400">+{tickets.length - 6} more</span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 mt-1">No open tickets</p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="shrink-0 text-right space-y-1 min-w-[52px]">
                        <p className="text-lg font-bold text-slate-900">{tickets.length}</p>
                        <p className="text-[10px] text-slate-400">open</p>
                        {overdue.length > 0 && (
                          <p className="text-[10px] text-red-600 font-medium whitespace-nowrap">
                            {overdue.length} overdue
                          </p>
                        )}
                        {escalated.length > 0 && (
                          <p className="text-[10px] text-red-600 font-bold whitespace-nowrap">
                            {escalated.length} escalated
                          </p>
                        )}
                      </div>
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
