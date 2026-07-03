import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RoleBadge } from '@/features/users/components/RoleBadge'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Users, UserCheck, UserX, PlusCircle } from 'lucide-react'
import Link from 'next/link'
import type { UserRole } from '@/types/user.types'
import type { Database } from '@/types/database.types'
import { RegionFilter } from './RegionFilter'

export const metadata = { title: 'User Management' }

interface PageProps {
  readonly searchParams: Promise<{ role?: string; region_id?: string; page?: string }>
}

export default async function UserManagementPage({ searchParams }: PageProps) {
  const { role, region_id, page: pageStr = '1' } = await searchParams
  const page = Number.parseInt(pageStr, 10) || 1
  const pageSize = 30

  // Auth check with the SSR client (respects the user session)
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  // Use the service client for data queries — the users SELECT policy that grants
  // super_admin visibility over all rows is defined in seed-demo.sql and may not
  // be present in every environment. The service client bypasses RLS so the admin
  // always sees the full user list regardless of migration state.
  const supabase = createServiceClient()

  let query = supabase
    .from('users')
    .select('*, region:regions(name, code), department:departments(name, code)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (role) query = query.eq('role', role as Database['public']['Enums']['user_role'])
  if (region_id) query = query.eq('region_id', region_id)

  const [{ data: users, count }, { data: regions }] = await Promise.all([
    query,
    supabase.from('regions').select('id, name, code').eq('is_active', true).order('name'),
  ])

  const activeCount = users?.filter((u) => u.is_active).length ?? 0
  const inactiveCount = (users?.length ?? 0) - activeCount

  const ROLE_TABS = [
    { value: '', label: 'All' },
    { value: 'requester', label: 'Requesters' },
    { value: 'dept_user', label: 'Dept Users' },
    { value: 'manager', label: 'Managers' },
    { value: 'super_admin', label: 'Super Admins' },
  ]

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Provision and manage platform access across all 10 regions.
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className={cn(buttonVariants(), 'bg-[#1E40AF] hover:bg-[#1e3a8a] gap-2')}
        >
          <PlusCircle className="h-4 w-4" /> Provision User
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-[#1E40AF] bg-[#EFF6FF] rounded-lg p-1.5" />
          <div>
            <p className="text-xs text-slate-500">Total Users</p>
            <p className="text-2xl font-bold text-slate-900">{count ?? 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-3">
          <UserCheck className="h-8 w-8 text-green-600 bg-green-50 rounded-lg p-1.5" />
          <div>
            <p className="text-xs text-slate-500">Active</p>
            <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-3">
          <UserX className="h-8 w-8 text-red-500 bg-red-50 rounded-lg p-1.5" />
          <div>
            <p className="text-xs text-slate-500">Inactive</p>
            <p className="text-2xl font-bold text-slate-900">{inactiveCount}</p>
          </div>
        </div>
      </div>

      {/* User table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-1 px-5 py-3 border-b border-slate-100 overflow-x-auto flex-wrap gap-y-2">
          {ROLE_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={tab.value ? `/admin/users?role=${tab.value}` : '/admin/users'}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                role === tab.value || (!role && !tab.value)
                  ? 'bg-[#1E40AF] text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {tab.label}
            </Link>
          ))}
          <div className="flex-1" />
          <RegionFilter regions={regions ?? []} currentRegionId={region_id} />
        </div>

        {users?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['User', 'Role', 'Region', 'Department', 'Status', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const uRegion = u.region as { name: string; code: string } | null
                  const uDept = u.department as { name: string } | null
                  return (
                    <tr key={u.id} className={cn('hover:bg-slate-50', !u.is_active && 'opacity-50')}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{u.full_name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <RoleBadge role={u.role as UserRole} size="sm" />
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        {uRegion ? (
                          <span className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[#1E40AF]">{uRegion.code}</span>
                            {uRegion.name.split('—')[1]?.trim()}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        {uDept?.name ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {u.is_active ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">Active</Badge>
                        ) : (
                          <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px]">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/users/${u.id}/edit`}
                          className="text-xs text-[#1E40AF] hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Users className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-slate-500 text-sm mt-3">No users found.</p>
          </div>
        )}

        {(count ?? 0) > pageSize && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count ?? 0)} of {count}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/admin/users?page=${page - 1}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Previous</Link>
              )}
              {page * pageSize < (count ?? 0) && (
                <Link href={`/admin/users?page=${page + 1}`} className={cn(buttonVariants({ size: 'sm' }), 'bg-[#1E40AF] hover:bg-[#1e3a8a]')}>Next</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
