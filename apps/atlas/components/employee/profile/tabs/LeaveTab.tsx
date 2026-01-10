'use client'

import Link from 'next/link'
import type { LeaveBalance, LeaveRequest } from '@/lib/api-client'
import { CalendarDaysIcon, ChevronRightIcon, ClockIcon, PlusIcon } from '@/components/ui/Icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDateRange, getLeaveStatusConfig, getLeaveTypeLabel } from '../utils'

function LeaveBalanceArc({ balance }: { balance: LeaveBalance }) {
  const available = balance.available
  const total = balance.allocated
  const used = total - available
  const percentage = total > 0 ? (available / total) * 100 : 0
  const isLow = total > 0 && available <= Math.ceil(total * 0.2) && available > 0
  const isEmpty = available === 0

  // SVG arc calculations
  const size = 80
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-brand-teal-500/30 transition-colors">
      {/* Circular Progress */}
      <div className="relative flex-shrink-0">
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              'transition-all duration-500',
              isEmpty ? 'text-muted-foreground/20' : isLow ? 'text-warning-500' : 'text-brand-teal-500'
            )}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'text-lg font-bold tabular-nums',
              isEmpty ? 'text-muted-foreground/50' : isLow ? 'text-warning-600' : 'text-foreground'
            )}
          >
            {available}
          </span>
          <span className="text-[10px] text-muted-foreground">left</span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-foreground truncate">{getLeaveTypeLabel(balance.leaveType)}</h4>
          {balance.pending > 0 ? (
            <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning-100 text-warning-700">
              {balance.pending} pending
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          <span>{used} used</span>
          <span className="text-muted-foreground/50">•</span>
          <span>{total} total</span>
        </div>
        {/* Mini progress bar */}
        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isEmpty ? 'bg-muted-foreground/20' : isLow ? 'bg-warning-500' : 'bg-brand-teal-500'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function CompactLeaveBalance({ balance }: { balance: LeaveBalance }) {
  const available = balance.available
  const total = balance.allocated
  const used = total - available
  const percentage = total > 0 ? (available / total) * 100 : 0
  const isLow = total > 0 && available <= Math.ceil(total * 0.2) && available > 0
  const isEmpty = available === 0

  return (
    <div className="p-3 rounded-lg border border-border bg-card hover:border-brand-navy-500/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground truncate">{getLeaveTypeLabel(balance.leaveType)}</span>
        {balance.pending > 0 ? (
          <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-warning-100 text-warning-700">
            {balance.pending}
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            'text-xl font-bold tabular-nums',
            isEmpty ? 'text-muted-foreground/50' : isLow ? 'text-warning-600' : 'text-foreground'
          )}
        >
          {available}
        </span>
        <span className="text-xs text-muted-foreground">/ {total}</span>
      </div>
      <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isEmpty ? 'bg-muted-foreground/20' : isLow ? 'bg-warning-500' : 'bg-brand-navy-500'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export function EmployeeLeaveTab({
  groupedBalances,
  leaveBalances,
  leaveRequests,
  loading,
  isSelf,
}: {
  groupedBalances: {
    core: LeaveBalance[]
    parental: LeaveBalance[]
    bereavement: LeaveBalance[]
    other: LeaveBalance[]
  }
  leaveBalances: LeaveBalance[]
  leaveRequests: LeaveRequest[]
  loading: boolean
  isSelf: boolean
}) {
  const hasBalances = leaveBalances.filter((b) => b.leaveType !== 'UNPAID').length > 0

  return (
    <div className="space-y-8">
      {/* Leave Balances Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Leave Balances</h2>
            <p className="text-sm text-muted-foreground">Your available time off for this year</p>
          </div>
          {isSelf ? (
            <Button href="/leave?request=true" size="sm" icon={<PlusIcon className="h-4 w-4" />}>
              Request Leave
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !hasBalances ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <CalendarDaysIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No leave balances configured</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Contact HR to set up your leave allocation</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Core balances - with arc display */}
            {groupedBalances.core.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedBalances.core.map((balance) => (
                  <LeaveBalanceArc key={balance.leaveType} balance={balance} />
                ))}
              </div>
            ) : null}

            {/* Other balance categories - compact display */}
            {groupedBalances.parental.length > 0 ||
            groupedBalances.bereavement.length > 0 ||
            groupedBalances.other.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Additional Leave Types
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[...groupedBalances.parental, ...groupedBalances.bereavement, ...groupedBalances.other].map(
                    (balance) => (
                      <CompactLeaveBalance key={balance.leaveType} balance={balance} />
                    )
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Request History Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Request History</h2>
            <p className="text-sm text-muted-foreground">
              {leaveRequests.length > 0
                ? `${leaveRequests.length} request${leaveRequests.length !== 1 ? 's' : ''} on file`
                : 'No requests yet'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : leaveRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <ClockIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No leave requests yet</p>
            {isSelf ? (
              <p className="text-xs text-muted-foreground/70 mt-1">
                Click "Request Leave" above to submit your first request
              </p>
            ) : null}
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-6 bottom-6 w-px bg-border" />

            <div className="space-y-3">
              {leaveRequests.map((request) => {
                const statusConfig = getLeaveStatusConfig(request.status)
                return (
                  <Link key={request.id} href={`/leaves/${request.id}`} className="block group relative">
                    <div className="flex gap-4 pl-10">
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          'absolute left-2 top-5 h-3 w-3 rounded-full border-2 bg-card z-10',
                          request.status === 'APPROVED'
                            ? 'border-brand-teal-500'
                            : request.status === 'PENDING'
                              ? 'border-warning-500'
                              : request.status === 'REJECTED'
                                ? 'border-danger-500'
                                : 'border-muted-foreground/50'
                        )}
                      />

                      {/* Card */}
                      <div className="flex-1 rounded-xl border border-border bg-card p-4 hover:border-brand-teal-500/30 hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">
                                {getLeaveTypeLabel(request.leaveType)}
                              </span>
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                                  statusConfig.badgeClass
                                )}
                              >
                                {statusConfig.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <CalendarDaysIcon className="h-3.5 w-3.5" />
                              <span>{formatDateRange(request.startDate, request.endDate)}</span>
                              <span className="text-muted-foreground/50">•</span>
                              <span className="font-medium">
                                {request.totalDays} day{request.totalDays !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {request.reason ? (
                              <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-1 italic bg-muted/50 px-2 py-1 rounded">
                                "{request.reason}"
                              </p>
                            ) : null}
                          </div>
                          <ChevronRightIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
