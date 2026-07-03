import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/dashboard/StatCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Ticket,
  CheckCircle2,
  Clock,
  PlusCircle,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata = { title: 'My Tickets' }

export default async function RequesterDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, region_id')
    .eq('auth_id', user.id)
    .single()

  // Sprint 2+ will load real ticket data. Sprint 1 shows the skeleton layout.
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Good morning, {firstName}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Here&apos;s a summary of your IT and data service requests.
          </p>
        </div>
        <Link
          href="/requester/tickets/new"
          className={cn(buttonVariants(), 'bg-[#1E40AF] hover:bg-[#1e3a8a] gap-2 hidden sm:flex')}
        >
          <PlusCircle className="h-4 w-4" />
          Submit a Ticket
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open Tickets"
          value="—"
          description="Awaiting resolution"
          icon={Ticket}
          iconColor="text-[#1E40AF]"
          iconBg="bg-[#EFF6FF]"
          isLoading
        />
        <StatCard
          label="Resolved This Month"
          value="—"
          description="Last 30 days"
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          isLoading
        />
        <StatCard
          label="Avg Resolution Time"
          value="—"
          description="Business hours"
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          isLoading
        />
        <StatCard
          label="SLA Compliance"
          value="—"
          description="Your tickets"
          icon={CheckCircle2}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          isLoading
        />
      </div>

      {/* Recent tickets */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Recent Tickets</h2>
          <Link
            href="/requester/tickets"
            className="text-xs text-[#1E40AF] hover:underline font-medium flex items-center gap-0.5"
          >
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Ticket list skeleton — will be replaced with real data in Sprint 2 */}
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Empty state (shown once data loads with zero tickets) */}
        <div className="hidden px-5 py-12 text-center">
          <Ticket className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-slate-500 text-sm mt-3 font-medium">No tickets yet</p>
          <p className="text-slate-400 text-xs mt-1">
            Submit your first IT or data service request to get started.
          </p>
          <Link
            href="/requester/tickets/new"
            className={cn(buttonVariants({ size: 'sm' }), 'mt-4 bg-[#1E40AF] hover:bg-[#1e3a8a]')}
          >
            Submit a Ticket
          </Link>
        </div>
      </div>

      {/* Status guide */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Ticket Status Guide</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { status: 'New', className: 'status-new', desc: 'Awaiting pickup' },
            { status: 'Acknowledged', className: 'status-acknowledged', desc: 'Team confirmed' },
            { status: 'In Progress', className: 'status-in_progress', desc: 'Being worked on' },
            { status: 'Pending You', className: 'status-pending_requester', desc: 'Needs your input' },
            { status: 'Escalated', className: 'status-escalated', desc: 'Manager involved' },
            { status: 'Resolved', className: 'status-resolved', desc: 'Work completed' },
          ].map((item) => (
            <div key={item.status} className="text-center">
              <Badge variant="outline" className={`text-xs ${item.className} w-full justify-center`}>
                {item.status}
              </Badge>
              <p className="text-[10px] text-slate-400 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
