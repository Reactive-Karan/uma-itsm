import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROLE_DASHBOARD_PATHS } from '@/types/user.types'
import type { UserRole } from '@/types/user.types'
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton'
import { DemoRoleLoginButtons } from '@/features/auth/components/DemoRoleLoginButtons'

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string; error?: string }>
}

export const metadata = {
  title: 'Sign In — UMA ITSM',
  description: 'Sign in to the UMA Group IT Service Management platform.',
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirectTo, error } = await searchParams

  // If already authenticated, redirect to appropriate dashboard
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single()

    if (profile) {
      redirect(redirectTo ?? ROLE_DASHBOARD_PATHS[profile.role as UserRole])
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1E40AF] flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-lg">U</span>
          </div>
          <div>
            <p className="font-bold text-lg leading-none">UMA ITSM</p>
            <p className="text-blue-200 text-xs leading-none mt-0.5">IT Service Management</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold leading-tight">
              Centralised IT Support
              <br />
              for UMA Group
            </h1>
            <p className="mt-4 text-blue-200 text-lg leading-relaxed">
              One platform. Ten regions. Full accountability.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Regional Entities', value: '10' },
              { label: 'Request Types', value: '5' },
              { label: 'SLA Tracking', value: 'Live' },
              { label: 'Audit Trail', value: '100%' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 rounded-xl p-4">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-blue-200 text-sm mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-blue-300 text-sm">
          © {new Date().getFullYear()} UMA Group. All rights reserved.
        </p>
      </div>

      {/* Right panel — sign in form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="h-8 w-8 rounded-md bg-[#1E40AF] flex items-center justify-center">
              <span className="text-white font-bold">U</span>
            </div>
            <p className="font-bold text-slate-900">UMA ITSM</p>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="text-slate-500 mt-1.5 text-sm">
            Sign in with your UMA Google Workspace account.
          </p>

          {/* Error message */}
          {error && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                {error === 'unauthorized'
                  ? 'Your account is not authorised to access this platform. Contact your administrator.'
                  : 'Sign in failed. Please try again.'}
              </p>
            </div>
          )}

          <div className="mt-8 space-y-4">
            <GoogleSignInButton redirectTo={redirectTo} />

            <p className="text-center text-xs text-slate-400">
              Only UMA Group Google Workspace accounts are permitted.
              <br />
              Contact IT if you need access.
            </p>

            <DemoRoleLoginButtons />
          </div>

          <div className="mt-10 pt-6 border-t border-slate-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { icon: '🔒', label: 'Secure SSO' },
                { icon: '📋', label: 'SLA Tracking' },
                { icon: '🌍', label: '10 Regions' },
              ].map((feature) => (
                <div key={feature.label}>
                  <p className="text-xl">{feature.icon}</p>
                  <p className="text-xs text-slate-500 mt-1">{feature.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
