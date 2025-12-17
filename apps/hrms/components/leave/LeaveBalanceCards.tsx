'use client'

import { type LeaveBalance } from '@/lib/api-client'
import { CalendarDaysIcon } from '@/components/ui/Icons'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  PTO: 'PTO',
  MATERNITY: 'Maternity',
  PATERNITY: 'Paternity',
  PARENTAL: 'Parental',
  BEREAVEMENT_IMMEDIATE: 'Bereavement (Immediate)',
  BEREAVEMENT_EXTENDED: 'Bereavement (Extended)',
  JURY_DUTY: 'Jury Duty',
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredBalances.map((balance) => {
        const label = LEAVE_TYPE_LABELS[balance.leaveType] || balance.leaveType.replace(/_/g, ' ')
        const available = balance.available
        const total = balance.allocated
        const usedPercent = total > 0 ? ((total - available) / total) * 100 : 0

        return (
          <div
            key={balance.leaveType}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">{label}</h4>
              {balance.pending > 0 && (
                <span className="text-xs text-gray-500">{balance.pending} pending</span>
              )}
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-2xl font-bold text-blue-600">{available}</span>
              <span className="text-sm text-gray-500">/ {total} days</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {balance.used} used
              {balance.pending > 0 && ` · ${balance.pending} pending`}
            </p>
          </div>
        )
      })}
    </div>
  )
}
