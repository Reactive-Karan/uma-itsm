import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OooSettingsForm } from './OooSettingsForm'
import { ProfileCard } from '@/features/profile/ProfileCard'
import type { UserProfile } from '@/types/user.types'

export const metadata = { title: 'My Profile' }

export default async function DeptUserProfilePage() {
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

  // Fetch colleagues in same department for backup user selection
  const { data: colleagues } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('role', 'dept_user')
    .eq('department_id', profile.department_id ?? '')
    .eq('is_active', true)
    .neq('id', profile.id)
    .order('full_name')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Your account information and out-of-office settings.
        </p>
      </div>

      <ProfileCard
        profile={profile as UserProfile}
        regionName={region?.name}
        departmentName={department?.name}
      />

      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-3">Out-of-Office Settings</h2>
        <OooSettingsForm
          initialIsOoo={profile.is_ooo}
          initialOooStartDate={profile.ooo_start_date ?? ''}
          initialOooEndDate={profile.ooo_end_date ?? ''}
          initialBackupUserId={profile.ooo_backup_user_id ?? ''}
          colleagues={colleagues ?? []}
        />
      </div>
    </div>
  )
}
