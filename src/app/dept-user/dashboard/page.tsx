import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/dashboard/StatCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Inbox,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Timer,
} from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'My Queue' }

export default async function DeptUserDashboardPage() {
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
        <h1 className="text-2xl font-bold text-slate-900">My Queue</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Welcome back, {firstName}. Here are your active support assignments.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open Assignments"
          value="—"
          description="Needs attention"
          icon={Inbox}
          iconColor="text-[#1E40AF]"
          iconBg="bg-[#EFF6FF]"
          isLoading
        />
        <StatCard
          label="Acknowledged"
          value="—"
          description="In progress"
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          isLoading
        />
        <StatCard
          label="Overdue"
          value="—"
          description="SLA breached"
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          isLoading
        />
        <StatCard
          label="Resolved Today"
          value="—"
          description="This calendar day"
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          isLoading
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket queue */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-900">Active Tickets</h2>
              <Badge variant="outline" className="text-[10px] text-slate-500">
                Sorted by SLA urgency
              </Badge>
            </div>
            <Link
              href="/dept-user/tickets"
              className="text-xs text-[#1E40AF] hover:underline font-medium flex items-center gap-0.5"
            >
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Queue skeleton */}
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                {/* SLA countdown placeholder */}
                <div className="flex-shrink-0 text-right">
                  <Skeleton className="h-4 w-16 mb-1" />
                  <Skeleton className="h-3 w-10 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SLA at-risk panel */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Timer className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-slate-900 text-sm">SLA at Risk</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-amber-100 bg-amber-50 space-y-1.5">
                <Skeleton className="h-3.5 w-full bg-amber-200" />
                <Skeleton className="h-3 w-3/4 bg-amber-200" />
                <Skeleton className="h-4 w-16 rounded-full bg-amber-200" />
              </div>
            ))}
          </div>
          <div className="px-5 pb-4">
            <p className="text-xs text-slate-400 text-center">
              Real-time SLA risk scoring available in Phase 2
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
