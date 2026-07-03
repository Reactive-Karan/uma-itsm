import { cn } from '@/lib/utils'
import { AlertTriangle, Minus, ArrowDown } from 'lucide-react'
import type { Priority } from '@/types/database.types'

interface PriorityBadgeProps {
  priority: Priority
  showIcon?: boolean
  className?: string
}

const PRIORITY_CONFIG: Record<Priority, { label: string; classes: string; Icon: React.ComponentType<{ className?: string }> }> = {
  high:   { label: 'High',   classes: 'text-red-600 bg-red-50 border-red-200',     Icon: AlertTriangle },
  medium: { label: 'Medium', classes: 'text-amber-600 bg-amber-50 border-amber-200', Icon: Minus },
  low:    { label: 'Low',    classes: 'text-slate-500 bg-slate-50 border-slate-200', Icon: ArrowDown },
}

export function PriorityBadge({ priority, showIcon = true, className }: PriorityBadgeProps) {
  const { label, classes, Icon } = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        classes,
        className,
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  )
}
