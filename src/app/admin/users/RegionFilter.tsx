'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface RegionFilterProps {
  regions: { id: string; code: string; name: string }[]
  currentRegionId?: string
}

export function RegionFilter({ regions, currentRegionId }: RegionFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('region_id', e.target.value)
    } else {
      params.delete('region_id')
    }
    params.delete('page') // reset to page 1 on filter change
    router.push(`/admin/users?${params.toString()}`)
  }

  return (
    <select
      value={currentRegionId ?? ''}
      onChange={handleChange}
      className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#1E40AF]"
    >
      <option value="">All Regions</option>
      {regions.map((r) => (
        <option key={r.id} value={r.id}>
          {r.code} — {r.name.split('—')[1]?.trim()}
        </option>
      ))}
    </select>
  )
}
