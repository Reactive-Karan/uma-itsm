'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSessionStore } from '@/stores/session.store'
import { RoleBadge } from '@/features/users/components/RoleBadge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { LogOut, User } from 'lucide-react'
import type { UserRole } from '@/types/user.types'

const PROFILE_PATH_BY_ROLE: Record<UserRole, string> = {
  requester: '/requester/profile',
  dept_user: '/dept-user/profile',
  manager: '/manager/profile',
  super_admin: '/admin/profile',
}

export function UserProfileMenu() {
  const router = useRouter()
  const profile = useSessionStore((s) => s.profile)
  const profilePath = profile ? PROFILE_PATH_BY_ROLE[profile.role] : '/'

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!profile) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-2 rounded-lg px-2 text-sm',
          'h-10 md:h-auto md:py-1.5',   // 44px touch target on mobile
          'hover:bg-slate-100 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]',
        )}
      >
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-[#1E40AF] text-white text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="hidden md:block font-medium text-slate-800 max-w-[140px] truncate">
          {profile.full_name}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60 max-w-[calc(100vw-1rem)]">
        {/* Base UI requires GroupLabel to live inside a Group */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="pb-1">
            <p className="font-semibold text-slate-900 truncate">{profile.full_name}</p>
            <p className="text-xs text-slate-500 font-normal truncate">{profile.email}</p>
            <div className="mt-1.5">
              <RoleBadge role={profile.role} size="sm" />
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => router.push(profilePath)}
            className="cursor-pointer gap-2 text-slate-700"
          >
            <User className="h-4 w-4 text-slate-400" />
            My Profile
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
