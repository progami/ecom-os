'use client'

import type { LeaveBalance } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { getLeaveTypeLabel } from './utils'

export function LeaveBalanceCard({ balance, compact }: { balance: LeaveBalance; compact?: boolean }) {
  const available = balance.available
  const total = balance.allocated
  const used = total - available
  const percentage = total > 0 ? (available / total) * 100 : 0
  const isLow = total > 0 && available <= Math.ceil(total * 0.2) && available > 0
  const isEmpty = available === 0

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4 transition-all hover:border-input',
        compact ? 'p-3' : 'p-4'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn('font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>
          {getLeaveTypeLabel(balance.leaveType)}
        </span>
        {balance.pending > 0 ? (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning-100 text-warning-700">
            {balance.pending} pending
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span
            className={cn(
              'font-bold tabular-nums',
              compact ? 'text-2xl' : 'text-3xl',
              isEmpty ? 'text-muted-foreground/50' : isLow ? 'text-warning-600' : 'text-foreground'
            )}
          >
            {available}
          </span>
          <span className={cn('text-muted-foreground ml-1', compact ? 'text-xs' : 'text-sm')}>/ {total} days</span>
        </div>
      </div>

      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isEmpty ? 'bg-muted-foreground/20' : isLow ? 'bg-warning' : 'bg-accent'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>Available</span>
        <span>{used} used</span>
      </div>
    </div>
  )
}

