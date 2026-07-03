'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, FlaskConical } from 'lucide-react'

/**
 * Demo role login buttons — FOR DEVELOPMENT / DEMONSTRATION ONLY.
 * These accounts must exist in Supabase Auth with email+password enabled.
 *
 * To create them, run in Supabase SQL editor:
 *   SELECT * FROM auth.users WHERE email LIKE 'demo.%@uma-itsm.demo';
 * Or create via Supabase Dashboard → Authentication → Users → Add user.
 *
 * All demo accounts share the password:  UmaDemo@2026!
 */
const DEMO_ACCOUNTS = [
  {
    role:     'requester',
    label:    'Requester',
    email:    'demo.requester@uma-itsm.demo',
    color:    'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200',
    dot:      'bg-emerald-400',
    redirect: '/requester/dashboard',
  },
  {
    role:     'dept_user',
    label:    'Department User',
    email:    'demo.deptuser@uma-itsm.demo',
    color:    'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200',
    dot:      'bg-sky-400',
    redirect: '/dept-user/dashboard',
  },
  {
    role:     'manager',
    label:    'Manager',
    email:    'demo.manager@uma-itsm.demo',
    color:    'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200',
    dot:      'bg-amber-400',
    redirect: '/manager/dashboard',
  },
  {
    role:     'super_admin',
    label:    'Super Admin',
    email:    'demo.admin@uma-itsm.demo',
    color:    'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200',
    dot:      'bg-violet-400',
    redirect: '/admin/dashboard',
  },
]

// Intentional hardcoded demo credential — not a production secret. NOSONAR
const DEMO_PASSWORD = 'UmaDemo@2026!'

export function DemoRoleLoginButtons() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDemoLogin(account: typeof DEMO_ACCOUNTS[0]) {
    setLoading(account.role)
    setError(null)
    const supabase = createClient()

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    account.email,
      password: DEMO_PASSWORD,
    })

    if (signInError) {
      setError(
        signInError.message.includes('Invalid login')
          ? `Demo account not set up yet. Create "${account.email}" in Supabase Auth first.`
          : signInError.message,
      )
      setLoading(null)
      return
    }

    router.push(account.redirect)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {/* Separator */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <FlaskConical className="h-3 w-3" />
            Development Only — Demo Accounts
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Role buttons */}
      <div className="grid grid-cols-2 gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.role}
            onClick={() => handleDemoLogin(account)}
            disabled={loading !== null}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${account.color}`}
          >
            {loading === account.role ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            ) : (
              <span className={`h-2 w-2 rounded-full shrink-0 ${account.dot}`} />
            )}
            <span className="truncate">{account.label}</span>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
        Demo accounts use email + password. Not visible in production.
      </p>
    </div>
  )
}
