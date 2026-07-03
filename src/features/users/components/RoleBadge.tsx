import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/user.types'
import { ROLE_LABELS } from '@/types/user.types'

interface RoleBadgeProps {
  role: UserRole
  className?: string
  size?: 'sm' | 'default'
}

const ROLE_STYLES: Record<UserRole, string> = {
  super_admin:
    'bg-[#1E40AF] text-white hover:bg-[#1E40AF] border-transparent',
  manager:
    'bg-[#0369a1] text-white hover:bg-[#0369a1] border-transparent',
  dept_user:
    'bg-[#0f766e] text-white hover:bg-[#0f766e] border-transparent',
  requester:
    'bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200',
}

export function RoleBadge({ role, className, size = 'default' }: RoleBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium tracking-wide',
        size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
        ROLE_STYLES[role],
        className,
      )}
    >
      {ROLE_LABELS[role]}
    </Badge>
  )
}
