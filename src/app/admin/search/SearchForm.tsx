'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export function SearchForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = inputRef.current?.value?.trim()
    if (!q) return
    router.push(`/admin/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          defaultValue={sp.get('q') ?? ''}
          placeholder="Search by title, description, or ticket number (e.g. TKT-0042)…"
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF] bg-white"
        />
      </div>
      <button type="submit" className={cn(buttonVariants({ size: 'sm' }), 'bg-[#1E40AF] hover:bg-[#1e3a8a] gap-1.5')}>
        <Search className="h-3.5 w-3.5" /> Search
      </button>
    </form>
  )
}
