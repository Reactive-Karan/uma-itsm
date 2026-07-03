import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  readonly label: string
  readonly value?: string | number
  readonly description?: string
  readonly icon: LucideIcon
  readonly iconColor?: string
  readonly iconBg?: string
  readonly trend?: { value: string; positive: boolean }
  readonly isLoading?: boolean
  readonly className?: string
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
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-slate-500 uppercase leading-tight">{label}</p>

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
              <p className="text-xs text-slate-500 mt-1 leading-tight">{description}</p>
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
