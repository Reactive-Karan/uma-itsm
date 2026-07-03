'use client'

import { Menu } from 'lucide-react'
import { UserProfileMenu } from '@/features/auth/components/UserProfileMenu'
import { NotificationInbox } from '@/features/notifications/components/NotificationInbox'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface GlobalNavProps {
  readonly onMenuClick: () => void
}

export function GlobalNav({ onMenuClick }: GlobalNavProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-slate-200 flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
      {/* Mobile hamburger — 44px touch target for PWA */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-10 w-10 text-slate-600 -ml-1"
        onClick={onMenuClick}
        aria-label="Toggle navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Logo — desktop: shown in sidebar, mobile: shown in nav */}
      <div className="flex items-center gap-2 md:hidden min-w-0">
        <div className="h-6 w-6 rounded bg-[#1E40AF] flex items-center justify-center shrink-0">
          <span className="text-white text-[10px] font-bold leading-none">U</span>
        </div>
        <span className="font-semibold text-slate-900 text-sm truncate">UMA ITSM</span>
      </div>

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      <NotificationInbox />

      <Separator orientation="vertical" className="h-5 mx-0.5 sm:mx-1" />

      <UserProfileMenu />
    </header>
  )
}
