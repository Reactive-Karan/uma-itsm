'use client'

import { useState } from 'react'
import { UserX, UserCheck, Calendar, Users, Info, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Colleague {
  id: string
  full_name: string
  email: string
}

interface OooSettingsFormProps {
  readonly initialIsOoo: boolean
  readonly initialOooStartDate: string
  readonly initialOooEndDate: string
  readonly initialBackupUserId: string
  readonly colleagues: Colleague[]
}

export function OooSettingsForm({
  initialIsOoo,
  initialOooStartDate,
  initialOooEndDate,
  initialBackupUserId,
  colleagues,
}: OooSettingsFormProps) {
  const [isOoo, setIsOoo] = useState(initialIsOoo)
  const [startDate, setStartDate] = useState(initialOooStartDate)
  const [endDate, setEndDate] = useState(initialOooEndDate)
  const [backupUserId, setBackupUserId] = useState(initialBackupUserId)
  const [isSaving, setIsSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  async function handleSave() {
    setError('')

    if (isOoo && !backupUserId) {
      setError('Please select a backup user to handle your tickets while you are out of office.')
      return
    }

    if (isOoo && endDate && startDate && new Date(endDate) < new Date(startDate)) {
      setError('Return date must be after the start date.')
      return
    }

    setIsSaving(true)
    const res = await fetch('/api/user/ooo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_ooo: isOoo,
        ooo_start_date: isOoo ? (startDate || today) : null,
        ooo_end_date: isOoo ? (endDate || null) : null,
        ooo_backup_user_id: isOoo ? backupUserId : null,
      }),
    })
    setIsSaving(false)

    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error?.message ?? 'Failed to save settings. Please try again.')
      return
    }

    setSavedAt(new Date())
  }

  return (
    <div className="space-y-4">
      {/* OOO toggle card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 flex items-start gap-4">
          <div className={cn(
            'h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
            isOoo ? 'bg-amber-50' : 'bg-green-50',
          )}>
            {isOoo
              ? <UserX className="h-5 w-5 text-amber-600" />
              : <UserCheck className="h-5 w-5 text-green-600" />
            }
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Out of Office</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isOoo
                    ? 'You are currently marked as out of office. New tickets will be routed to your backup.'
                    : 'You are currently available. New tickets will be routed to you normally.'}
                </p>
              </div>
              {/* Toggle */}
              <button
                role="switch"
                aria-checked={isOoo}
                onClick={() => { setIsOoo((v) => !v); setSavedAt(null) }}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  isOoo ? 'bg-amber-500' : 'bg-slate-200',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform',
                    isOoo ? 'translate-x-5' : 'translate-x-0',
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded settings when OOO is ON */}
        {isOoo && (
          <div className="border-t border-slate-100 px-6 py-5 bg-amber-50/30 space-y-5">
            {/* Date range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ooo-start" className="block text-xs font-medium text-slate-700 mb-1.5">
                  <Calendar className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                  OOO Start Date
                </label>
                <input
                  id="ooo-start"
                  type="date"
                  min={today}
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setSavedAt(null) }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30 focus:border-[#1E40AF]"
                />
              </div>
              <div>
                <label htmlFor="ooo-end" className="block text-xs font-medium text-slate-700 mb-1.5">
                  <Calendar className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                  Expected Return Date
                </label>
                <input
                  id="ooo-end"
                  type="date"
                  min={startDate || today}
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setSavedAt(null) }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30 focus:border-[#1E40AF]"
                />
              </div>
            </div>

            {/* Backup user */}
            <div>
              <label htmlFor="backup-user" className="block text-xs font-medium text-slate-700 mb-1.5">
                <Users className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                Backup User <span className="text-red-500">*</span>
              </label>
              {colleagues.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-100 rounded-lg px-3 py-2">
                  No other department users available to assign as backup.
                </p>
              ) : (
                <select
                  id="backup-user"
                  value={backupUserId}
                  onChange={(e) => { setBackupUserId(e.target.value); setSavedAt(null) }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30 focus:border-[#1E40AF]"
                >
                  <option value="">— Select a backup user —</option>
                  {colleagues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.email})
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-start gap-1">
                <Info className="h-3 w-3 mt-px shrink-0" />
                New tickets routed to you will automatically be redirected to your backup while OOO is active.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error / Success feedback */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {savedAt && !error && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Settings saved at {savedAt.toLocaleTimeString()}.
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-lg bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1e3a8a] transition-colors disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
