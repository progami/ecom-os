'use client'

import { type LeaveBalance } from '@/lib/api-client'
import { CalendarDaysIcon } from '@/components/ui/Icons'

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
        <CalendarDaysIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No leave balance data available</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
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
            className="relative bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
          >
            {/* Label */}
            <p className="text-sm font-medium text-gray-900 mb-3">
              {label}
            </p>

            {isAsNeeded ? (
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-900">As needed</span>
                <p className="text-xs text-gray-500 mt-1">No annual cap is enforced.</p>
              </div>
            ) : (
              <>
                {/* Available / Total */}
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className={`text-3xl font-semibold tabular-nums ${
                    isEmpty ? 'text-gray-300' : isLow ? 'text-amber-600' : 'text-gray-900'
                  }`}>
                    {available}
                  </span>
                  <span className="text-sm text-gray-400">/ {total}</span>
                </div>

                {/* Progress bar - shows remaining */}
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isEmpty ? 'bg-gray-200' : isLow ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${availablePercent}%` }}
                  />
                </div>
              </>
            )}

            {/* Pending badge */}
            {balance.pending > 0 && (
              <div className="absolute top-3 right-3">
                <span className="text-xs text-amber-600 font-medium">
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
