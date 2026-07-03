import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/dashboard/StatCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Globe,
  AlertTriangle,
  TrendingDown,
  Ticket,
  ChevronRight,
  Activity,
} from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Platform Overview' }

const REGIONS = [
  { code: 'KE', name: 'Nairobi', color: 'bg-blue-500' },
  { code: 'NG', name: 'Lagos', color: 'bg-indigo-500' },
  { code: 'ZA', name: 'Johannesburg', color: 'bg-violet-500' },
  { code: 'GH', name: 'Accra', color: 'bg-cyan-500' },
  { code: 'TZ', name: 'Dar es Salaam', color: 'bg-teal-500' },
  { code: 'EG', name: 'Cairo', color: 'bg-emerald-500' },
  { code: 'MA', name: 'Casablanca', color: 'bg-amber-500' },
  { code: 'UG', name: 'Kampala', color: 'bg-orange-500' },
  { code: 'ZW', name: 'Harare', color: 'bg-rose-500' },
  { code: 'MU', name: 'Mauritius', color: 'bg-pink-500' },
]

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('auth_id', user.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Admin'

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Welcome, {firstName}. Cross-entity platform status across all 10 regions.
          </p>
        </div>
        <Link
          href="/admin/audit"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'hidden sm:flex gap-2')}
        >
          <Activity className="h-3.5 w-3.5" />
          Audit Log
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Tickets"
          value="—"
          description="All regions"
          icon={Ticket}
          iconColor="text-[#1E40AF]"
          iconBg="bg-[#EFF6FF]"
          isLoading
        />
        <StatCard
          label="Escalated"
          value="—"
          description="Requires attention"
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          isLoading
        />
        <StatCard
          label="SLA Breach Rate"
          value="—"
          description="Last 7 days"
          icon={TrendingDown}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          isLoading
        />
        <StatCard
          label="Regions Active"
          value="10"
          description="All entities online"
          icon={Globe}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          isLoading={false}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Regional breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Regional Breakdown</h2>
            <Link
              href="/admin/tickets"
              className="text-xs text-[#1E40AF] hover:underline font-medium flex items-center gap-0.5"
            >
              All tickets <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {REGIONS.map((region) => (
              <div key={region.code} className="px-5 py-3 flex items-center gap-4">
                <div
                  className={`h-7 w-7 rounded-md ${region.color} flex items-center justify-center flex-shrink-0`}
                >
                  <span className="text-white text-[10px] font-bold">{region.code}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{region.name}</p>
                </div>
                {/* Data loads in Sprint 2+ */}
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent audit activity */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">Recent Activity</h2>
            <Link
              href="/admin/audit"
              className="text-xs text-[#1E40AF] hover:underline font-medium flex items-center gap-0.5"
            >
              View log <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="px-5 py-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-6 w-6 rounded-full flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="px-5 pb-4 pt-2 border-t border-slate-100 space-y-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Quick Actions
            </p>
            {[
              { label: 'Manage Users', href: '/admin/users' },
              { label: 'Routing Rules', href: '/admin/routing' },
              { label: 'SLA Configuration', href: '/admin/sla' },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center justify-between py-1.5 text-sm text-slate-600 hover:text-[#1E40AF] group"
              >
                {action.label}
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#1E40AF]" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* System status */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-semibold text-slate-900 text-sm">System Status</h3>
          <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">
            All Systems Operational
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Platform', status: 'Online' },
            { label: 'Routing Engine', status: 'Online' },
            { label: 'SLA Engine', status: 'Online' },
            { label: 'Notifications', status: 'Online' },
          ].map((svc) => (
            <div key={svc.label} className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-700">{svc.label}</p>
                <p className="text-[10px] text-slate-400">{svc.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
