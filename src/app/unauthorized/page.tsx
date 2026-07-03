import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Access Denied — UMA ITSM',
}

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center">
            <ShieldX className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
        <p className="text-slate-500 mt-3 text-sm leading-relaxed">
          You do not have permission to access this area of the UMA ITSM platform.
          <br />
          If you believe this is an error, contact your administrator.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className={cn(buttonVariants(), 'bg-[#1E40AF] hover:bg-[#1e3a8a]')}
          >
            Return to Sign In
          </Link>
          <Link
            href="mailto:itsm-support@uma.network"
            className={buttonVariants({ variant: 'outline' })}
          >
            Contact Support
          </Link>
        </div>

        <p className="text-xs text-slate-400 mt-8">
          UMA ITSM · Role-Based Access Control
        </p>
      </div>
    </div>
  )
}
