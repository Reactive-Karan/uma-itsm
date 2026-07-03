'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react'
import Link from 'next/link'

interface Region   { id: string; name: string; code: string }
interface DeptUser { id: string; full_name: string; email: string }

interface ExistingRule {
  id: string
  region_id: string
  request_type: string
  sub_type: string
  primary_assignee_id: string
  backup_assignee_id: string | null
  is_active: boolean
}

interface Props {
  readonly regions:    Region[]
  readonly deptUsers:  DeptUser[]
  readonly existing?:  ExistingRule
}

const REQUEST_TYPES = [
  { value: 'it_service',   label: 'IT Service',   description: 'Hardware & software issues' },
  { value: 'data_service', label: 'Data Service', description: 'Data, analysis & reports' },
]

const SUB_TYPES: Record<string, { value: string; label: string }[]> = {
  it_service:   [
    { value: 'hardware', label: 'Hardware' },
    { value: 'software', label: 'Software' },
  ],
  data_service: [
    { value: 'analysis',     label: 'Data Analysis' },
    { value: 'discrepancy',  label: 'Data Discrepancy' },
    { value: 'issues',       label: 'Data Issues' },
  ],
}

export function RuleForm({ regions, deptUsers, existing }: Props) {
  const router  = useRouter()
  const isEdit  = !!existing

  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<{ ok: boolean; message: string } | null>(null)

  const [form, setForm] = useState({
    region_id:           existing?.region_id           ?? '',
    request_type:        existing?.request_type        ?? 'it_service',
    sub_type:            existing?.sub_type            ?? '',
    primary_assignee_id: existing?.primary_assignee_id ?? '',
    backup_assignee_id:  existing?.backup_assignee_id  ?? '',
    is_active:           existing?.is_active           ?? true,
  })

  function set(field: string, value: string | boolean) {
    setForm((f) => {
      const next = { ...f, [field]: value }
      // Clear sub_type when request_type changes
      if (field === 'request_type') next.sub_type = ''
      return next
    })
    setResult(null)
  }

  const availableSubTypes = SUB_TYPES[form.request_type] ?? []

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const body = isEdit
      ? {
          primary_assignee_id: form.primary_assignee_id,
          backup_assignee_id:  form.backup_assignee_id || null,
          is_active:           form.is_active,
        }
      : {
          region_id:           form.region_id,
          request_type:        form.request_type,
          sub_type:            form.sub_type,
          primary_assignee_id: form.primary_assignee_id,
          backup_assignee_id:  form.backup_assignee_id || null,
        }

    const url    = isEdit && existing ? `/api/admin/routing/${existing.id}` : '/api/admin/routing'
    const method = isEdit ? 'PATCH' : 'POST'

    try {
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const json = await res.json()

      if (res.ok) {
        setResult({ ok: true, message: isEdit ? 'Rule updated successfully.' : 'Routing rule created successfully.' })
        setTimeout(() => router.push('/admin/routing'), 1600)
      } else {
        setResult({ ok: false, message: json?.error?.message ?? 'Operation failed. Please try again.' })
      }
    } catch {
      setResult({ ok: false, message: 'Network error. Please check your connection.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back */}
      <Link
        href="/admin/routing"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Routing Rules
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Routing Rule' : 'Add Routing Rule'}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {isEdit
            ? 'Update the assignees or active status of this rule.'
            : 'Define which team member receives tickets for a region, type, and sub-type.'}
        </p>
      </div>

      {result && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${
          result.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {result.ok
            ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
            : <AlertCircle  className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
          }
          <span>{result.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">

        {/* Region */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Region</p>
          <div className="space-y-1.5">
            <label htmlFor="region_id" className="text-sm font-medium text-slate-700">
              Apply this rule to <span className="text-red-500">*</span>
            </label>
            <select
              id="region_id"
              required={!isEdit}
              disabled={isEdit}
              value={form.region_id}
              onChange={(e) => set('region_id', e.target.value)}
              className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <option value="">— Select a region —</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name.split('—')[1]?.trim() ?? r.name}
                </option>
              ))}
            </select>
            {isEdit && (
              <p className="text-xs text-slate-400">Region cannot be changed after creation.</p>
            )}
          </div>
        </div>

        {/* Request type + Sub-type */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ticket Classification</p>

          {/* Request type */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Request Type <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {REQUEST_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  type="button"
                  disabled={isEdit}
                  onClick={() => set('request_type', rt.value)}
                  className={`text-left rounded-lg border p-3 transition-all disabled:cursor-not-allowed ${
                    form.request_type === rt.value
                      ? 'border-[#1E40AF] bg-[#EFF6FF] ring-1 ring-[#1E40AF]'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60'
                  }`}
                >
                  <p className={`text-sm font-semibold ${form.request_type === rt.value ? 'text-[#1E40AF]' : 'text-slate-900'}`}>
                    {rt.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{rt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Sub-type */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Sub-type <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {availableSubTypes.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  disabled={isEdit}
                  onClick={() => set('sub_type', st.value)}
                  className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-all disabled:cursor-not-allowed ${
                    form.sub_type === st.value
                      ? 'border-[#1E40AF] bg-[#EFF6FF] text-[#1E40AF]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-60'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
            {!form.sub_type && <p className="text-xs text-slate-400">Select a sub-type above.</p>}
          </div>
        </div>

        {/* Assignees */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assignees</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="primary_assignee" className="text-sm font-medium text-slate-700">
                Primary Assignee <span className="text-red-500">*</span>
              </label>
              <select
                id="primary_assignee"
                required
                value={form.primary_assignee_id}
                onChange={(e) => set('primary_assignee_id', e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
              >
                <option value="">— Select dept. user —</option>
                {deptUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">Must be an active Department User.</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="backup_assignee" className="text-sm font-medium text-slate-700">
                Backup Assignee
              </label>
              <select
                id="backup_assignee"
                value={form.backup_assignee_id}
                onChange={(e) => set('backup_assignee_id', e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
              >
                <option value="">— None (optional) —</option>
                {deptUsers
                  .filter((u) => u.id !== form.primary_assignee_id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-400">Used when primary is Out of Office.</p>
            </div>
          </div>
        </div>

        {/* Active toggle — edit only */}
        {isEdit && (
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Rule Active</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Inactive rules are ignored by the routing engine.
              </p>
            </div>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={`transition-colors ${form.is_active ? 'text-[#1E40AF]' : 'text-slate-300'}`}
              aria-label="Toggle active"
            >
              {form.is_active
                ? <ToggleRight className="h-8 w-8" />
                : <ToggleLeft  className="h-8 w-8" />
              }
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-4 flex items-center justify-end gap-3 bg-slate-50 rounded-b-xl">
          <Link
            href="/admin/routing"
            className="text-sm text-slate-600 hover:text-slate-900 px-4 py-2 rounded-md hover:bg-slate-100 transition-colors"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={loading || result?.ok === true || (!isEdit && !form.sub_type)}
            className="bg-[#1E40AF] hover:bg-[#1e3a8a] gap-2 min-w-[120px]"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading && (isEdit ? 'Saving…' : 'Creating…')}
            {!loading && result?.ok && <><CheckCircle2 className="h-4 w-4" /> Done</>}
            {!loading && !result?.ok && (isEdit ? 'Save Changes' : 'Create Rule')}
          </Button>
        </div>
      </form>
    </div>
  )
}
