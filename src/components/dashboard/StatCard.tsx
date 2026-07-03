import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value?: string | number
  description?: string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  trend?: { value: string; positive: boolean }
  isLoading?: boolean
  className?: string
}

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  iconColor = 'text-[#1E40AF]',
  iconBg = 'bg-[#EFF6FF]',
  trend,
  isLoading = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4',
        className,
      )}
    >
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>

        {isLoading ? (
          <>
            <Skeleton className="h-7 w-16 mt-1.5" />
            <Skeleton className="h-3.5 w-24 mt-1.5" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-slate-900 mt-0.5 leading-none">
              {value ?? '—'}
            </p>
            {description && (
              <p className="text-xs text-slate-500 mt-1 truncate">{description}</p>
            )}
            {trend && (
              <p
                className={cn(
                  'text-xs font-medium mt-1',
                  trend.positive ? 'text-green-600' : 'text-red-600',
                )}
              >
                {trend.positive ? '↑' : '↓'} {trend.value}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
