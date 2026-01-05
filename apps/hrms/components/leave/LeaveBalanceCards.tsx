'use client'

import { type LeaveBalance } from '@/lib/api-client'
import { CalendarDaysIcon } from '@/components/ui/Icons'
import { cn } from '@/lib/utils'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  PTO: 'PTO',
  ANNUAL: 'Annual',
  SICK: 'Sick',
  PERSONAL: 'Personal',
  MATERNITY: 'Maternity',
  PATERNITY: 'Paternity',
  PARENTAL: 'Parental',
  BEREAVEMENT_IMMEDIATE: 'Bereavement',
  BEREAVEMENT_EXTENDED: 'Bereavement (Ext)',
  BEREAVEMENT: 'Bereavement',
  JURY_DUTY: 'Jury Duty',
  COMP_TIME: 'Comp Time',
  UNPAID: 'Unpaid',
}

type LeaveBalanceCardsProps = {
  balances: LeaveBalance[]
}

export function LeaveBalanceCards({ balances }: LeaveBalanceCardsProps) {
  // Filter out UNPAID since it's unlimited and not a real "balance"
  const filteredBalances = balances.filter(b => b.leaveType !== 'UNPAID')

  if (!filteredBalances || filteredBalances.length === 0) {
    return (
      <div className="text-center py-8">
        <CalendarDaysIcon className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">No leave balance data available</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 stagger-children">
      {filteredBalances.map((balance) => {
        const label = LEAVE_TYPE_LABELS[balance.leaveType] || balance.leaveType.replace(/_/g, ' ')
        const isAsNeeded = balance.leaveType === 'JURY_DUTY'
        const available = balance.available
        const total = balance.allocated
        const availablePercent = total > 0 ? (available / total) * 100 : 0
        const isLow = total > 0 && available <= Math.ceil(total * 0.2) && available > 0
        const isEmpty = available === 0

        return (
          <div
            key={balance.leaveType}
            className="relative bg-card rounded-xl border border-border/60 p-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow)] hover:border-border transition-all duration-200"
          >
            {/* Label */}
            <p className="text-sm font-semibold text-foreground mb-3">
              {label}
            </p>

            {isAsNeeded ? (
              <div className="mb-4">
                <span className="text-sm font-medium text-[hsl(var(--accent))]">As needed</span>
                <p className="text-xs text-muted-foreground mt-1">No annual cap is enforced.</p>
              </div>
            ) : (
              <>
                {/* Available / Total */}
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className={cn(
                    'text-3xl font-bold tabular-nums tracking-tight',
                    isEmpty ? 'text-muted-foreground/50' : isLow ? 'text-amber-600' : 'text-foreground'
                  )}>
                    {available}
                  </span>
                  <span className="text-sm text-muted-foreground">/ {total}</span>
                </div>

                {/* Progress bar - shows remaining */}
                <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      isEmpty ? 'bg-muted' : isLow ? 'bg-amber-500' : 'bg-[hsl(var(--accent))]'
                    )}
                    style={{ width: `${availablePercent}%` }}
                  />
                </div>
              </>
            )}

            {/* Pending badge */}
            {balance.pending > 0 && (
              <div className="absolute top-3 right-3">
                <span className="text-xs text-amber-600 font-semibold px-2 py-0.5 bg-amber-50 rounded-full">
                  {balance.pending} pending
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
