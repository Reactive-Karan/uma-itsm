import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/dashboard/StatCard'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LayoutDashboard,
  AlertTriangle,
  TrendingUp,
  Clock,
  ChevronRight,
  Flame,
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Department Overview' }

export default async function ManagerDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, department_id')
    .eq('auth_id', user.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Department Overview</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Hello, {firstName}. Monitor your team&apos;s service performance.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Dept Open Tickets"
          value="—"
          description="Across all assignees"
          icon={LayoutDashboard}
          iconColor="text-[#1E40AF]"
          iconBg="bg-[#EFF6FF]"
          isLoading
        />
        <StatCard
          label="Escalated"
          value="—"
          description="Requires your action"
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          isLoading
        />
        <StatCard
          label="SLA Compliance"
          value="—"
          description="Last 30 days"
          icon={TrendingUp}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          isLoading
        />
        <StatCard
          label="Avg MTTR"
          value="—"
          description="Mean time to resolve"
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          isLoading
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Escalation tray */}
        <div className="bg-white rounded-xl border border-red-200">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-red-100 bg-red-50 rounded-t-xl">
            <Flame className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold text-red-800 text-sm">Escalation Tray</h2>
            <Badge className="ml-auto bg-red-100 text-red-700 border-red-200 text-[10px]">
              Requires Action
            </Badge>
          </div>
          <div className="px-5 py-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-red-100 bg-red-50 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-3.5 w-32 bg-red-200" />
                  <Skeleton className="h-4 w-14 rounded-full bg-red-200" />
                </div>
                <Skeleton className="h-3 w-full bg-red-200" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16 rounded-full bg-red-200" />
                  <Skeleton className="h-3 w-20 bg-red-200" />
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-4">
            <Link
              href="/manager/escalations"
              className="text-xs text-red-600 hover:underline font-medium flex items-center gap-0.5"
            >
              View all escalations <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Team workload */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Team Workload</h2>
            <Link
              href="/manager/team"
              className="text-xs text-[#1E40AF] hover:underline font-medium flex items-center gap-0.5"
            >
              View team <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="text-right space-y-1">
                  <Skeleton className="h-4 w-8 ml-auto" />
                  <Skeleton className="h-2 w-24 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SLA compliance chart placeholder */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">SLA Compliance — Last 30 Days</h2>
          <p className="text-xs text-slate-400 mt-0.5">Advanced analytics available in Phase 2</p>
        </div>
        <div className="px-5 py-6">
          <div className="h-40 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center justify-center">
            <p className="text-slate-400 text-sm">Compliance chart — available from Sprint 10</p>
          </div>
        </div>
      </div>
    </div>
  )
}
