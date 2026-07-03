import { RoleBadge } from '@/features/users/components/RoleBadge'
import { Mail, MapPin, Building2, Calendar, ShieldCheck } from 'lucide-react'
import type { UserProfile } from '@/types/user.types'

interface ProfileCardProps {
  readonly profile: UserProfile
  readonly regionName?: string
  readonly departmentName?: string
}

export function ProfileCard({ profile, regionName, departmentName }: ProfileCardProps) {
  const initials = profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const joinedDate = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Banner */}
      <div className="h-20 bg-linear-to-r from-[#1E40AF] to-[#2563EB]" />

      {/* Avatar + name */}
      <div className="px-6 pb-6">
        {/* Avatar floats up over the banner — badge stays in the white zone */}
        <div className="-mt-9 mb-3">
          <div className="h-16 w-16 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center">
            <div className="h-full w-full rounded-xl bg-[#1E40AF] flex items-center justify-center">
              <span className="text-white text-xl font-bold">{initials}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h2 className="text-xl font-bold text-slate-900">{profile.full_name}</h2>
          <RoleBadge role={profile.role} size="sm" />
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 text-sm text-slate-600">
            <Mail className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="truncate">{profile.email}</span>
          </div>

          {regionName && (
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
              <span>{regionName}</span>
            </div>
          )}

          {departmentName && (
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
              <span>{departmentName}</span>
            </div>
          )}

          <div className="flex items-center gap-2.5 text-sm text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <span>Member since {joinedDate}</span>
          </div>

          <div className="flex items-center gap-2.5 text-sm">
            <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
            <span className={profile.is_active ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
              {profile.is_active ? 'Active account' : 'Inactive account'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
