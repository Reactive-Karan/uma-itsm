import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TicketSubmitForm } from '@/features/tickets/components/TicketSubmitForm'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Submit a Ticket' }

export default async function NewTicketPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('region_id')
    .eq('auth_id', user.id)
    .single()

  // Warn if no region assigned — the API will reject ticket creation
  const hasRegion = !!profile?.region_id

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-6">
        <Link href="/requester/dashboard" className="hover:text-[#1E40AF]">My Tickets</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-900 font-medium">Submit a Ticket</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Submit a Support Request</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Describe your issue and we will route it to the right team automatically.
        </p>
      </div>

      {!hasRegion && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Account setup incomplete.</strong> Your account has not been assigned to a region.
          Contact your Super Admin to complete your profile before submitting tickets.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <TicketSubmitForm />
      </div>
    </div>
  )
}
