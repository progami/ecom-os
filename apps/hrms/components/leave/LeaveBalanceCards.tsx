'use client'

import { type LeaveBalance } from '@/lib/api-client'
import {
  CalendarDaysIcon,
  CalendarIcon,
  UsersIcon,
  BuildingIcon,
  DocumentIcon,
} from '@/components/ui/Icons'

// Leave type configuration with semantic colors
const LEAVE_TYPE_CONFIG: Record<string, {
  label: string
  color: string
  bgClass: string
  Icon: React.ComponentType<{ className?: string }>
}> = {
  PTO: {
    label: 'PTO',
    color: 'hsl(var(--accent))',
    bgClass: 'bg-accent/5',
    Icon: CalendarDaysIcon,
  },
  PARENTAL: {
    label: 'Parental',
    color: 'hsl(340 82% 52%)',
    bgClass: 'bg-rose-50',
    Icon: UsersIcon,
  },
  BEREAVEMENT_IMMEDIATE: {
    label: 'Bereavement',
    color: 'hsl(var(--muted-foreground))',
    bgClass: 'bg-muted/50',
    Icon: CalendarIcon,
  },
  BEREAVEMENT_EXTENDED: {
    label: 'Extended Bereavement',
    color: 'hsl(var(--muted-foreground))',
    bgClass: 'bg-muted/50',
    Icon: CalendarIcon,
  },
  JURY_DUTY: {
    label: 'Jury Duty',
    color: 'hsl(245 58% 51%)',
    bgClass: 'bg-indigo-50',
    Icon: BuildingIcon,
  },
  UNPAID: {
    label: 'Unpaid',
    color: 'hsl(var(--muted-foreground))',
    bgClass: 'bg-muted/30',
    Icon: DocumentIcon,
  },
}

// Circular progress ring component
function CircularProgress({
  percentage,
  color,
  size = 64,
  strokeWidth = 5,
}: {
  percentage: number
  color: string
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-border"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-500 ease-out"
      />
    </svg>
  )
}

type LeaveBalanceCardsProps = {
  balances: LeaveBalance[]
}

export function LeaveBalanceCards({ balances }: LeaveBalanceCardsProps) {
  const filteredBalances = balances.filter(b => b.leaveType !== 'UNPAID')

  if (!filteredBalances || filteredBalances.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <CalendarDaysIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No leave balances</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Balances will appear once configured</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {filteredBalances.map((balance) => {
        const config = LEAVE_TYPE_CONFIG[balance.leaveType] || {
          label: balance.leaveType.replace(/_/g, ' '),
          color: 'hsl(var(--muted-foreground))',
          bgClass: 'bg-muted/30',
          Icon: CalendarIcon,
        }

        const available = balance.available
        const total = balance.allocated
        const used = total - available
        const availablePercent = total > 0 ? (available / total) * 100 : 0
        const isLow = total > 0 && available <= Math.ceil(total * 0.2) && available > 0
        const isEmpty = available === 0

        const IconComponent = config.Icon

        return (
          <div
            key={balance.leaveType}
            className={`
              relative rounded-xl border border-border ${config.bgClass}
              p-4 transition-all duration-200
              hover:border-input hover:shadow-sm
            `}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 border border-border/50">
                <IconComponent className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">
                {config.label}
              </span>
            </div>

            {/* Progress and stats */}
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <CircularProgress
                  percentage={availablePercent}
                  color={isEmpty ? 'hsl(var(--muted))' : isLow ? 'hsl(var(--warning))' : config.color}
                  size={56}
                  strokeWidth={4}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`
                    text-base font-semibold tabular-nums
                    ${isEmpty ? 'text-muted-foreground/50' : isLow ? 'text-warning-600' : 'text-foreground'}
                  `}>
                    {available}
                  </span>
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">Available</span>
                  <span className={`font-medium ${isEmpty ? 'text-muted-foreground/50' : isLow ? 'text-warning-600' : 'text-foreground'}`}>
                    {available} days
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">Used</span>
                  <span className="text-muted-foreground">{used} / {total}</span>
                </div>
              </div>
            </div>

            {/* Pending badge */}
            {balance.pending > 0 && (
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning-100 text-warning-700">
                  {balance.pending} pending
                </span>
              </div>
            )}

            {/* Status indicators */}
            {isLow && !isEmpty && (
              <div className="mt-3 pt-2 border-t border-border/50">
                <p className="text-[10px] font-medium text-warning-600">Running low</p>
              </div>
            )}
            {isEmpty && (
              <div className="mt-3 pt-2 border-t border-border/50">
                <p className="text-[10px] font-medium text-muted-foreground">No balance remaining</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
