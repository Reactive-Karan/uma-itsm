'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Region {
  id: string
  name: string
  code: string
}

interface Department {
  id: string
  name: string
  code: string
}

interface Props {
  readonly regions: Region[]
  readonly departments: Department[]
}

const ROLE_OPTIONS = [
  { value: 'requester',   label: 'Requester',       description: 'Can raise and track their own tickets' },
  { value: 'dept_user',   label: 'Department User',  description: 'Responds to tickets assigned to their team' },
  { value: 'manager',     label: 'Manager',          description: 'Oversees team workload and SLA compliance' },
  { value: 'super_admin', label: 'Super Admin',      description: 'Full platform access and user management' },
]

export function ProvisionUserForm({ regions, departments }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [form, setForm] = useState({
    email:         '',
    full_name:     '',
    role:          'requester',
    region_id:     '',
    department_id: '',
  })

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setResult(null)
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:         form.email.trim().toLowerCase(),
          full_name:     form.full_name.trim(),
          role:          form.role,
          region_id:     form.region_id     || null,
          department_id: form.department_id || null,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        setResult({ ok: true, message: `User ${form.full_name} provisioned successfully.` })
        setTimeout(() => router.push('/admin/users'), 1800)
      } else {
        setResult({ ok: false, message: json?.error?.message ?? 'Provisioning failed. Please try again.' })
      }
    } catch {
      setResult({ ok: false, message: 'Network error. Please check your connection and try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/users"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Provision User</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Create an ITSM profile for a UMA Group employee. The user must have signed in
          with Google at least once before they can be provisioned.
        </p>
      </div>

      {/* Result Banner */}
      {result && (
        <div
          className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${
            result.ok
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {result.ok
            ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
            : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
          }
          <span>{result.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">

        {/* Identity */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Identity</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="full_name" className="text-sm font-medium text-slate-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                placeholder="Jane Doe"
                value={form.full_name}
                onChange={(e) => set('full_name', e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Google Workspace Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="jane.doe@uma.group"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Role */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Platform Role <span className="text-red-500">*</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('role', opt.value)}
                className={`text-left rounded-lg border p-3.5 transition-all ${
                  form.role === opt.value
                    ? 'border-[#1E40AF] bg-[#EFF6FF] ring-1 ring-[#1E40AF]'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <p className={`text-sm font-semibold ${form.role === opt.value ? 'text-[#1E40AF]' : 'text-slate-900'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Region & Department */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assignment</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="region_id" className="text-sm font-medium text-slate-700">Region</label>
              <select
                id="region_id"
                value={form.region_id}
                onChange={(e) => set('region_id', e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent"
              >
                <option value="">— Not assigned —</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name.split('—')[1]?.trim() ?? r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="department_id" className="text-sm font-medium text-slate-700">Department</label>
              <select
                id="department_id"
                value={form.department_id}
                onChange={(e) => set('department_id', e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent"
              >
                <option value="">— Not assigned —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Region and department can be updated later. Super Admins do not require a region or department.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex items-center justify-end gap-3 bg-slate-50 rounded-b-xl">
          <Link
            href="/admin/users"
            className="text-sm text-slate-600 hover:text-slate-900 px-4 py-2 rounded-md hover:bg-slate-100 transition-colors"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={loading || result?.ok === true}
            className="bg-[#1E40AF] hover:bg-[#1e3a8a] gap-2 min-w-[140px]"
          >
            {loading && <><Loader2 className="h-4 w-4 animate-spin" /> Provisioning…</>}
            {!loading && result?.ok && <><CheckCircle2 className="h-4 w-4" /> Done</>}
            {!loading && !result?.ok && 'Provision User'}
          </Button>
        </div>
      </form>
    </div>
  )
}
