'use client'

import { type LeaveBalance } from '@/lib/api-client'
import { CalendarDaysIcon } from '@/components/ui/Icons'

const LEAVE_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  PTO: { label: 'PTO', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: '🏖️' },
  ANNUAL: { label: 'Annual', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: '🌴' },
  SICK: { label: 'Sick', color: 'text-red-600', bgColor: 'bg-red-50', icon: '🏥' },
  PERSONAL: { label: 'Personal', color: 'text-purple-600', bgColor: 'bg-purple-50', icon: '🙋' },
  MATERNITY: { label: 'Maternity', color: 'text-pink-600', bgColor: 'bg-pink-50', icon: '👶' },
  PATERNITY: { label: 'Paternity', color: 'text-cyan-600', bgColor: 'bg-cyan-50', icon: '👨‍👧' },
  PARENTAL: { label: 'Parental', color: 'text-violet-600', bgColor: 'bg-violet-50', icon: '👪' },
  BEREAVEMENT_IMMEDIATE: { label: 'Bereavement', color: 'text-slate-600', bgColor: 'bg-slate-50', icon: '🕊️' },
  BEREAVEMENT_EXTENDED: { label: 'Bereavement (Ext)', color: 'text-slate-600', bgColor: 'bg-slate-50', icon: '🕊️' },
  BEREAVEMENT: { label: 'Bereavement', color: 'text-slate-600', bgColor: 'bg-slate-50', icon: '🕊️' },
  JURY_DUTY: { label: 'Jury Duty', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: '⚖️' },
  COMP_TIME: { label: 'Comp Time', color: 'text-teal-600', bgColor: 'bg-teal-50', icon: '⏰' },
  UNPAID: { label: 'Unpaid', color: 'text-gray-600', bgColor: 'bg-gray-50', icon: '📋' },
}

const DEFAULT_CONFIG = { label: 'Leave', color: 'text-gray-600', bgColor: 'bg-gray-50', icon: '📅' }

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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {filteredBalances.map((balance) => {
        const config = LEAVE_TYPE_CONFIG[balance.leaveType] || DEFAULT_CONFIG
        const available = balance.available
        const total = balance.allocated
        const usedPercent = total > 0 ? ((total - available) / total) * 100 : 0
        const isLow = total > 0 && available <= Math.ceil(total * 0.2) && available > 0
        const isEmpty = available === 0

        return (
          <div
            key={balance.leaveType}
            className={`relative rounded-xl p-4 border transition-all hover:shadow-md ${
              isEmpty
                ? 'bg-gray-50 border-gray-200'
                : isLow
                  ? 'bg-amber-50/50 border-amber-200'
                  : `${config.bgColor} border-transparent`
            }`}
          >
            {/* Icon */}
            <div className="text-xl mb-2">{config.icon}</div>

            {/* Label */}
            <h4 className="text-xs font-medium text-gray-600 mb-1 truncate">
              {config.label}
            </h4>

            {/* Available / Total */}
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${isEmpty ? 'text-gray-400' : config.color}`}>
                {available}
              </span>
              <span className="text-xs text-gray-400">/ {total}</span>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-1 bg-white/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isEmpty ? 'bg-gray-300' : isLow ? 'bg-amber-400' : 'bg-current opacity-40'
                }`}
                style={{ width: `${Math.min(usedPercent, 100)}%` }}
              />
            </div>

            {/* Status indicator */}
            {balance.pending > 0 && (
              <div className="absolute top-2 right-2">
                <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 text-[10px] font-semibold bg-amber-400 text-amber-900 rounded-full">
                  {balance.pending}
                </span>
              </div>
            )}

            {isLow && !isEmpty && (
              <p className="text-[10px] text-amber-600 font-medium mt-1">Running low</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
