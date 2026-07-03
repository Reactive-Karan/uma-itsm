'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session.store'
import { RoleBadge } from '@/features/users/components/RoleBadge'
import { NAV_ITEMS } from '@/config/navigation.config'
import type { UserRole } from '@/types/user.types'
import {
  LayoutDashboard,
  PlusCircle,
  Bell,
  Ticket,
  UserCheck,
  AlertTriangle,
  Users,
  BarChart2,
  GitBranch,
  Clock,
  ScrollText,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  PlusCircle,
  Bell,
  Ticket,
  UserCheck,
  AlertTriangle,
  Users,
  BarChart2,
  GitBranch,
  Clock,
  ScrollText,
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const profile = useSessionStore((s) => s.profile)

  if (!profile) return null

  const navItems = NAV_ITEMS[profile.role as UserRole] ?? []

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full w-64 bg-white border-r border-slate-200',
          'flex flex-col transition-transform duration-200',
          // Desktop: always visible (shift right to clear navbar height)
          'md:translate-x-0 md:top-0 md:pt-14',
          // Mobile: slide in/out
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:transition-none',
        )}
      >
        {/* Mobile: brand header with close button */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200 md:hidden">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-[#1E40AF] flex items-center justify-center">
              <span className="text-white text-xs font-bold">U</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">UMA ITSM</p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">Service Management</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop: brand header */}
        <div className="hidden md:flex items-center gap-2.5 px-4 py-4 border-b border-slate-100">
          <div className="h-8 w-8 rounded-md bg-[#1E40AF] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">U</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-none">UMA ITSM</p>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">Service Management</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
            Navigation
          </p>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = ICON_MAP[item.icon]
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[#EFF6FF] text-[#1E40AF]'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                    )}
                  >
                    {Icon && (
                      <Icon
                        className={cn(
                          'h-4 w-4 flex-shrink-0',
                          isActive ? 'text-[#1E40AF]' : 'text-slate-400',
                        )}
                      />
                    )}
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User info footer */}
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[#1E40AF] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-semibold">
                {profile.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate leading-none">
                {profile.full_name}
              </p>
              <div className="mt-1">
                <RoleBadge role={profile.role as UserRole} size="sm" />
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
