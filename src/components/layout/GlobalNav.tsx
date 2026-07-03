'use client'

import { Menu, Bell } from 'lucide-react'
import { UserProfileMenu } from '@/features/auth/components/UserProfileMenu'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface GlobalNavProps {
  onMenuClick: () => void
}

export function GlobalNav({ onMenuClick }: GlobalNavProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-8 w-8 text-slate-600"
        onClick={onMenuClick}
        aria-label="Toggle navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Logo — desktop: shown in sidebar, mobile: shown in nav */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="h-6 w-6 rounded bg-[#1E40AF] flex items-center justify-center">
          <span className="text-white text-[10px] font-bold leading-none">U</span>
        </div>
        <span className="font-semibold text-slate-900 text-sm">UMA ITSM</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notification bell */}
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 text-slate-600"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {/* Unread dot — will be data-driven in Sprint 6 */}
        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
      </Button>

      <Separator orientation="vertical" className="h-5 mx-1" />

      <UserProfileMenu />
    </header>
  )
}
