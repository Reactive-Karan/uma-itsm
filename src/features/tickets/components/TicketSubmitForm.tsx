'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import {
  Monitor, Database, HardDrive, Code2, BarChart2, AlertOctagon,
  Cpu, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles,
  Upload, X, FileText, AlertTriangle, Minus, ChevronRight,
} from 'lucide-react'
import type { RequestType, SubType, Priority } from '@/types/database.types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  request_type: RequestType | null
  sub_type: SubType | null
  title: string
  description: string
  priority: Priority
}

type Step = 1 | 2 | 3 | 4

// ─── Config ───────────────────────────────────────────────────────────────────

const REQUEST_TYPES = [
  {
    value: 'it_service' as RequestType,
    label: 'IT Service',
    description: 'Hardware, software, or system issues',
    Icon: Monitor,
  },
  {
    value: 'data_service' as RequestType,
    label: 'Data Service',
    description: 'Data analysis, discrepancies, or reporting issues',
    Icon: Database,
  },
]

const SUB_TYPES: Record<RequestType, { value: SubType; label: string; description: string; Icon: React.ComponentType<{className?: string}> }[]> = {
  it_service: [
    { value: 'hardware', label: 'Hardware', description: 'Physical devices: laptop, monitor, printer, etc.', Icon: HardDrive },
    { value: 'software', label: 'Software', description: 'Applications, OS, licences, or configurations', Icon: Code2 },
  ],
  data_service: [
    { value: 'analysis', label: 'Data Analysis', description: 'Request for data reports or insights', Icon: BarChart2 },
    { value: 'discrepancy', label: 'Data Discrepancy', description: 'Incorrect or inconsistent data in a system', Icon: AlertOctagon },
    { value: 'issues', label: 'Data Issues', description: 'Data access problems or pipeline failures', Icon: Cpu },
  ],
}

const PRIORITIES: { value: Priority; label: string; description: string; sla: string; Icon: React.ComponentType<{className?: string}>; color: string }[] = [
  { value: 'high',   label: 'High',   description: 'System down or critical business impact', sla: '8h resolution', Icon: AlertTriangle, color: 'border-red-200 bg-red-50 text-red-700' },
  { value: 'medium', label: 'Medium', description: 'Degraded function, workaround available',  sla: '24h resolution', Icon: Minus,         color: 'border-amber-200 bg-amber-50 text-amber-700' },
  { value: 'low',    label: 'Low',    description: 'Non-urgent issue or enhancement request', sla: '72h resolution', Icon: ArrowLeft,      color: 'border-slate-200 bg-slate-50 text-slate-600' },
]

const STEP_LABELS: Record<Step, string> = {
  1: 'Request Type', 2: 'Category', 3: 'Details', 4: 'Review',
}

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'application/zip',
]

// ─── Component ────────────────────────────────────────────────────────────────

export function TicketSubmitForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>({
    request_type: null, sub_type: null,
    title: '', description: '', priority: 'medium',
  })
  const [files, setFiles] = useState<File[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // AI states
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [enhancedDescription, setEnhancedDescription] = useState<string | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<{
    request_type?: string; sub_type?: string; priority?: string
    confidence?: { request_type: number; sub_type: number; priority: number }
  } | null>(null)
  const [isClassifying, setIsClassifying] = useState(false)

  // ─── Step navigation ──────────────────────────────────────────────────────

  const canAdvance = useCallback((): boolean => {
    if (step === 1) return form.request_type !== null
    if (step === 2) return form.sub_type !== null
    if (step === 3) return form.title.length >= 10 && form.description.length >= 20
    return true
  }, [step, form])

  const next = () => {
    if (step < 4 && canAdvance()) setStep((s) => (s + 1) as Step)
  }
  const back = () => {
    if (step > 1) setStep((s) => (s - 1) as Step)
  }

  // Reset sub_type when type changes
  const setRequestType = (type: RequestType) => {
    setForm((f) => ({ ...f, request_type: type, sub_type: null }))
    setAiSuggestion(null)
  }

  // ─── AI — Suggest category ────────────────────────────────────────────────

  const handleSuggestCategory = async () => {
    if (!form.title || !form.description) return
    setIsClassifying(true)
    try {
      const res = await fetch('/api/ai/suggest-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, description: form.description }),
      })
      const { data } = await res.json()
      if (data?.suggestion) setAiSuggestion(data.suggestion)
    } catch { /* silent fail */ } finally {
      setIsClassifying(false)
    }
  }

  // ─── AI — Enhance description ─────────────────────────────────────────────

  const handleEnhance = async () => {
    if (!form.description || form.description.length < 20) return
    setIsEnhancing(true)
    setEnhancedDescription(null)
    try {
      const res = await fetch('/api/ai/enhance-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          request_type: form.request_type,
          sub_type: form.sub_type,
        }),
      })
      const { data } = await res.json()
      if (data?.enhanced) setEnhancedDescription(data.enhanced)
    } catch { /* silent fail */ } finally {
      setIsEnhancing(false)
    }
  }

  const acceptEnhancement = () => {
    if (enhancedDescription) {
      setForm((f) => ({ ...f, description: enhancedDescription }))
      setEnhancedDescription(null)
    }
  }

  // ─── File handling ────────────────────────────────────────────────────────

  const handleFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    const errors: string[] = []
    const valid: File[] = []

    for (const file of arr) {
      if (files.length + valid.length >= MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} attachments allowed.`)
        break
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`"${file.name}" exceeds the 10 MB limit.`)
        continue
      }
      if (!ALLOWED_MIME.includes(file.type)) {
        errors.push(`"${file.name}" is not a supported file type.`)
        continue
      }
      valid.push(file)
    }

    setFileErrors(errors)
    setFiles((prev) => [...prev, ...valid])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.request_type || !form.sub_type) return
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          request_type: form.request_type,
          sub_type: form.sub_type,
          priority: form.priority,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setSubmitError(json.error?.message ?? 'Submission failed. Please try again.')
        return
      }

      const ticketId = json.data?.id
      if (ticketId) {
        router.push(`/requester/tickets/${ticketId}?submitted=true`)
      } else {
        router.push('/requester/dashboard')
      }
    } catch {
      setSubmitError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
            <div
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 border-2',
                s < step
                  ? 'bg-[#1E40AF] border-[#1E40AF] text-white'
                  : s === step
                  ? 'border-[#1E40AF] text-[#1E40AF] bg-white'
                  : 'border-slate-200 text-slate-400 bg-white',
              )}
            >
              {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            <span className={cn('text-xs font-medium hidden sm:block', s === step ? 'text-slate-900' : 'text-slate-400')}>
              {STEP_LABELS[s]}
            </span>
            {s < 4 && <div className={cn('flex-1 h-px mx-1', s < step ? 'bg-[#1E40AF]' : 'bg-slate-200')} />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Request Type ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">What type of support do you need?</h2>
            <p className="text-sm text-slate-500 mt-0.5">Select the category that best describes your request.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REQUEST_TYPES.map(({ value, label, description, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRequestType(value)}
                className={cn(
                  'flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all',
                  form.request_type === value
                    ? 'border-[#1E40AF] bg-[#EFF6FF]'
                    : 'border-slate-200 hover:border-slate-300 bg-white',
                )}
              >
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0',
                  form.request_type === value ? 'bg-[#1E40AF]' : 'bg-slate-100')}>
                  <Icon className={cn('h-5 w-5', form.request_type === value ? 'text-white' : 'text-slate-500')} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Sub-type ── */}
      {step === 2 && form.request_type && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">What specifically needs attention?</h2>
            <p className="text-sm text-slate-500 mt-0.5">This ensures your request reaches the right specialist.</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {SUB_TYPES[form.request_type].map(({ value, label, description, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, sub_type: value }))}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all',
                  form.sub_type === value
                    ? 'border-[#1E40AF] bg-[#EFF6FF]'
                    : 'border-slate-200 hover:border-slate-300 bg-white',
                )}
              >
                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0',
                  form.sub_type === value ? 'bg-[#1E40AF]' : 'bg-slate-100')}>
                  <Icon className={cn('h-4.5 w-4.5', form.sub_type === value ? 'text-white' : 'text-slate-500')} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{label}</p>
                  <p className="text-sm text-slate-500">{description}</p>
                </div>
                {form.sub_type === value && <CheckCircle2 className="h-5 w-5 text-[#1E40AF] flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Details ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Describe your request</h2>
            <p className="text-sm text-slate-500 mt-0.5">Clear descriptions get resolved faster.</p>
          </div>

          {/* AI suggestion banner */}
          {aiSuggestion && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Sparkles className="h-4 w-4 text-[#1E40AF] flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-blue-700">
                <span className="font-semibold">AI Suggestion: </span>
                {aiSuggestion.request_type && <span>Type: {aiSuggestion.request_type?.replace('_', ' ')} · </span>}
                {aiSuggestion.sub_type && <span>Category: {aiSuggestion.sub_type} · </span>}
                {aiSuggestion.priority && <span>Priority: {aiSuggestion.priority}</span>}
              </div>
              <button onClick={() => setAiSuggestion(null)} className="text-blue-400 hover:text-blue-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Brief summary of the issue or request"
              maxLength={150}
              className={cn(
                'w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
                'focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent',
                'border-slate-300',
              )}
            />
            <div className="flex justify-between mt-1">
              {form.title.length > 0 && form.title.length < 10 && (
                <p className="text-xs text-red-500">At least 10 characters required</p>
              )}
              <p className="text-xs text-slate-400 ml-auto">{form.title.length}/150</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Description <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleEnhance}
                disabled={isEnhancing || form.description.length < 20}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-colors',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  'text-[#1E40AF] bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-blue-200',
                )}
              >
                {isEnhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {isEnhancing ? 'Enhancing…' : 'Enhance with AI'}
              </button>
            </div>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the issue in detail. Include what happened, when it started, what you have already tried, and the business impact."
              rows={6}
              maxLength={2000}
              className={cn(
                'w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 resize-none',
                'focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-transparent',
                'border-slate-300',
              )}
            />
            <div className="flex justify-between mt-1">
              {form.description.length > 0 && form.description.length < 20 && (
                <p className="text-xs text-red-500">At least 20 characters required</p>
              )}
              <p className="text-xs text-slate-400 ml-auto">{form.description.length}/2000</p>
            </div>

            {/* Enhancement preview */}
            {enhancedDescription && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Enhanced Version
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={acceptEnhancement}
                      className="text-xs font-medium text-green-700 hover:underline"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => setEnhancedDescription(null)}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{enhancedDescription}</p>
              </div>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Priority <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITIES.map(({ value, label, description, sla, Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: value }))}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-center transition-all',
                    form.priority === value ? `border-current ${color}` : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                >
                  <Icon className={cn('h-4 w-4', form.priority === value ? '' : 'text-slate-400')} />
                  <span className={cn('text-sm font-semibold', form.priority !== value && 'text-slate-700')}>{label}</span>
                  <span className={cn('text-[10px] leading-tight', form.priority !== value && 'text-slate-400')}>{sla}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Attachments <span className="text-slate-400 font-normal">(optional, max {MAX_FILES} files, 10 MB each)</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
              className={cn(
                'border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer',
                'hover:border-[#1E40AF] hover:bg-[#EFF6FF] transition-colors',
              )}
            >
              <Upload className="h-6 w-6 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Drop files here or <span className="text-[#1E40AF] font-medium">browse</span></p>
              <p className="text-xs text-slate-400 mt-0.5">PDF, images, Word, Excel, ZIP supported</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_MIME.join(',')}
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />

            {fileErrors.map((err, i) => (
              <p key={i} className="text-xs text-red-500 mt-1">{err}</p>
            ))}

            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((file, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg">
                    <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Step 4: Review ── */}
      {step === 4 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Review your request</h2>
            <p className="text-sm text-slate-500 mt-0.5">Confirm the details before submitting.</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {[
              { label: 'Type', value: form.request_type?.replace('_', ' ') ?? '—' },
              { label: 'Category', value: form.sub_type ?? '—' },
              { label: 'Priority', value: form.priority },
              { label: 'Title', value: form.title },
              { label: 'Description', value: form.description, multiline: true },
              { label: 'Attachments', value: files.length > 0 ? `${files.length} file(s)` : 'None' },
            ].map(({ label, value, multiline }) => (
              <div key={label} className={cn('px-5 py-3', multiline ? 'flex flex-col gap-1' : 'flex items-start justify-between gap-4')}>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0">{label}</span>
                {multiline ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{value}</p>
                ) : (
                  <span className="text-sm text-slate-900 font-medium capitalize">{value}</span>
                )}
              </div>
            ))}
          </div>

          {submitError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {submitError}
            </div>
          )}
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-200">
        <button
          onClick={back}
          disabled={step === 1}
          className={cn(buttonVariants({ variant: 'outline' }), 'gap-2', step === 1 && 'invisible')}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {step < 4 ? (
          <button
            onClick={next}
            disabled={!canAdvance()}
            className={cn(
              buttonVariants(),
              'gap-2 bg-[#1E40AF] hover:bg-[#1e3a8a]',
              !canAdvance() && 'opacity-50 cursor-not-allowed',
            )}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(buttonVariants(), 'gap-2 bg-[#1E40AF] hover:bg-[#1e3a8a] min-w-[120px]')}
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Submit Ticket</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
