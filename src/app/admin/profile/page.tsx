import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileCard } from '@/features/profile/ProfileCard'
import type { UserProfile } from '@/types/user.types'

export const metadata = { title: 'My Profile' }

export default async function AdminProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: region } = profile.region_id
    ? await supabase.from('regions').select('name').eq('id', profile.region_id).single()
    : { data: null }

  const { data: department } = profile.department_id
    ? await supabase.from('departments').select('name').eq('id', profile.department_id).single()
    : { data: null }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your account information.</p>
      </div>
      <ProfileCard
        profile={profile as UserProfile}
        regionName={region?.name}
        departmentName={department?.name}
      />
    </div>
  )
}
