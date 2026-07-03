'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSessionStore } from '@/stores/session.store'
import { RoleBadge } from '@/features/users/components/RoleBadge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { LogOut, Settings, User } from 'lucide-react'

export function UserProfileMenu() {
  const router = useRouter()
  const profile = useSessionStore((s) => s.profile)

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
          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
          'hover:bg-slate-100 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]',
        )}
      >
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-[#1E40AF] text-white text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="hidden md:block font-medium text-slate-800 max-w-[140px] truncate">
          {profile.full_name}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="pb-1">
          <p className="font-semibold text-slate-900 truncate">{profile.full_name}</p>
          <p className="text-xs text-slate-500 font-normal truncate">{profile.email}</p>
          <div className="mt-1.5">
            <RoleBadge role={profile.role} size="sm" />
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="cursor-pointer gap-2 text-slate-700">
          <User className="h-4 w-4 text-slate-400" />
          My Profile
        </DropdownMenuItem>

        <DropdownMenuItem className="cursor-pointer gap-2 text-slate-700">
          <Settings className="h-4 w-4 text-slate-400" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
