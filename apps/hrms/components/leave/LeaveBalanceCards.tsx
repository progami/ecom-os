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

const LEAVE_TYPE_COLORS: Record<string, { bg: string; text: string; progress: string }> = {
  PTO: { bg: 'bg-cyan-50', text: 'text-cyan-700', progress: 'bg-cyan-500' },
  MATERNITY: { bg: 'bg-pink-50', text: 'text-pink-700', progress: 'bg-pink-500' },
  PATERNITY: { bg: 'bg-blue-50', text: 'text-blue-700', progress: 'bg-blue-500' },
  PARENTAL: { bg: 'bg-violet-50', text: 'text-violet-700', progress: 'bg-violet-500' },
  BEREAVEMENT_IMMEDIATE: { bg: 'bg-amber-50', text: 'text-amber-700', progress: 'bg-amber-500' },
  BEREAVEMENT_EXTENDED: { bg: 'bg-orange-50', text: 'text-orange-700', progress: 'bg-orange-500' },
  JURY_DUTY: { bg: 'bg-slate-50', text: 'text-slate-700', progress: 'bg-slate-500' },
  UNPAID: { bg: 'bg-slate-50', text: 'text-slate-600', progress: 'bg-slate-400' },
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
        <CalendarDaysIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-500 text-sm">No leave balance data available</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredBalances.map((balance) => {
        const colors = LEAVE_TYPE_COLORS[balance.leaveType] || LEAVE_TYPE_COLORS.UNPAID
        const label = LEAVE_TYPE_LABELS[balance.leaveType] || balance.leaveType.replace(/_/g, ' ')
        const available = balance.available
        const total = balance.allocated
        const usedPercent = total > 0 ? ((total - available) / total) * 100 : 0

        return (
          <div
            key={balance.leaveType}
            className={`${colors.bg} rounded-xl p-4 border border-slate-100`}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className={`text-sm font-medium ${colors.text}`}>{label}</h4>
              <span className={`text-xs ${colors.text} opacity-75`}>
                {balance.pending > 0 && `${balance.pending} pending`}
              </span>
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className={`text-2xl font-bold ${colors.text}`}>{available}</span>
              <span className="text-sm text-slate-500">/ {total} days</span>
            </div>
            <div className="h-2 bg-white rounded-full overflow-hidden">
              <div
                className={`h-full ${colors.progress} transition-all duration-300`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {balance.used} used
              {balance.pending > 0 && ` + ${balance.pending} pending`}
            </p>
          </div>
        )
      })}
    </div>
  )
}
