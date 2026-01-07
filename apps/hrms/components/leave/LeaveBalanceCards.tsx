'use client'

import { type LeaveBalance } from '@/lib/api-client'
import { CalendarDaysIcon } from '@/components/ui/Icons'

// Leave type configuration with semantic colors and icons
const LEAVE_TYPE_CONFIG: Record<string, {
  label: string
  color: string
  bgGradient: string
  icon: string
}> = {
  PTO: {
    label: 'PTO',
    color: 'hsl(176 100% 32%)', // Teal accent - freedom, vacation
    bgGradient: 'from-teal-50 to-cyan-50',
    icon: '🌴',
  },
  PARENTAL: {
    label: 'Parental',
    color: 'hsl(340 82% 52%)', // Warm rose - family, nurturing
    bgGradient: 'from-rose-50 to-pink-50',
    icon: '👶',
  },
  BEREAVEMENT_IMMEDIATE: {
    label: 'Bereavement',
    color: 'hsl(215 25% 45%)', // Muted slate - respectful, solemn
    bgGradient: 'from-slate-50 to-gray-100',
    icon: '🕊️',
  },
  BEREAVEMENT_EXTENDED: {
    label: 'Extended Bereavement',
    color: 'hsl(215 25% 45%)',
    bgGradient: 'from-slate-50 to-gray-100',
    icon: '🕊️',
  },
  JURY_DUTY: {
    label: 'Jury Duty',
    color: 'hsl(245 58% 51%)', // Deep indigo - civic, formal
    bgGradient: 'from-indigo-50 to-violet-50',
    icon: '⚖️',
  },
  UNPAID: {
    label: 'Unpaid',
    color: 'hsl(215 16% 46%)',
    bgGradient: 'from-gray-50 to-slate-50',
    icon: '📋',
  },
}

// Circular progress ring component
function CircularProgress({
  percentage,
  color,
  size = 80,
  strokeWidth = 6,
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
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/50"
      />
      {/* Progress ring */}
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
        className="transition-all duration-700 ease-out"
        style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
      />
    </svg>
  )
}

type LeaveBalanceCardsProps = {
  balances: LeaveBalance[]
}

export function LeaveBalanceCards({ balances }: LeaveBalanceCardsProps) {
  // Filter out UNPAID since it's unlimited
  const filteredBalances = balances.filter(b => b.leaveType !== 'UNPAID')

  if (!filteredBalances || filteredBalances.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
          <CalendarDaysIcon className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-sm font-medium">No leave balance data available</p>
        <p className="text-muted-foreground/70 text-xs mt-1">Leave balances will appear here once configured</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredBalances.map((balance, index) => {
        const config = LEAVE_TYPE_CONFIG[balance.leaveType] || {
          label: balance.leaveType.replace(/_/g, ' '),
          color: 'hsl(215 16% 46%)',
          bgGradient: 'from-gray-50 to-slate-50',
          icon: '📅',
        }

        const available = balance.available
        const total = balance.allocated
        const used = total - available
        const availablePercent = total > 0 ? (available / total) * 100 : 0
        const isLow = total > 0 && available <= Math.ceil(total * 0.2) && available > 0
        const isEmpty = available === 0

        return (
          <div
            key={balance.leaveType}
            className={`
              group relative overflow-hidden rounded-xl border border-border
              bg-gradient-to-br ${config.bgGradient}
              p-5 transition-all duration-300 ease-out
              hover:shadow-lg hover:shadow-black/5 hover:border-border/80 hover:-translate-y-0.5
            `}
            style={{
              animationDelay: `${index * 75}ms`,
            }}
          >
            {/* Header with icon and label */}
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-xl" role="img" aria-label={config.label}>
                {config.icon}
              </span>
              <span className="text-sm font-semibold text-foreground tracking-tight">
                {config.label}
              </span>
            </div>

            {/* Main content: Ring + Numbers */}
            <div className="flex items-center gap-4">
              {/* Circular progress */}
              <div className="relative flex-shrink-0">
                <CircularProgress
                  percentage={availablePercent}
                  color={isEmpty ? 'hsl(215 16% 70%)' : isLow ? 'hsl(38 92% 50%)' : config.color}
                  size={72}
                  strokeWidth={5}
                />
                {/* Center content */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`
                    text-lg font-bold tabular-nums
                    ${isEmpty ? 'text-muted-foreground/50' : isLow ? 'text-warning-600' : 'text-foreground'}
                  `}>
                    {available}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-1 min-w-0">
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Available</span>
                    <span className={`
                      text-sm font-semibold tabular-nums
                      ${isEmpty ? 'text-muted-foreground/50' : isLow ? 'text-warning-600' : 'text-foreground'}
                    `}>
                      {available} <span className="text-muted-foreground font-normal">days</span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Used</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {used} <span className="font-normal">/ {total}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending indicator */}
            {balance.pending > 0 && (
              <div className="absolute top-3 right-3">
                <span className="
                  inline-flex items-center gap-1
                  px-2 py-0.5 rounded-full
                  text-[10px] font-semibold uppercase tracking-wider
                  bg-warning-100 text-warning-700
                  animate-pulse
                ">
                  <span className="w-1 h-1 rounded-full bg-warning-500" />
                  {balance.pending} pending
                </span>
              </div>
            )}

            {/* Low balance warning */}
            {isLow && !isEmpty && (
              <div className="mt-3 pt-3 border-t border-warning-200/50">
                <p className="text-[10px] font-medium text-warning-600 uppercase tracking-wider">
                  ⚠️ Running low
                </p>
              </div>
            )}

            {/* Empty state message */}
            {isEmpty && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Balance exhausted
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
