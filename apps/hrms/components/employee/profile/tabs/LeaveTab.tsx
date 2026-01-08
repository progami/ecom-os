'use client'

import Link from 'next/link'
import type { LeaveBalance, LeaveRequest } from '@/lib/api-client'
import { CalendarDaysIcon, ChevronRightIcon } from '@/components/ui/Icons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LeaveBalanceCard } from '../LeaveBalanceCard'
import { formatDateRange, getLeaveStatusConfig, getLeaveTypeLabel } from '../utils'

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
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Leave Balances</h2>
          {isSelf ? (
            <Button href="/leave?request=true" size="sm">
              Request Leave
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : leaveBalances.filter((b) => b.leaveType !== 'UNPAID').length === 0 ? (
          <Card padding="lg">
            <div className="text-center py-4">
              <CalendarDaysIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No leave balances configured</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupedBalances.core.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {groupedBalances.core.map((balance) => (
                  <LeaveBalanceCard key={balance.leaveType} balance={balance} />
                ))}
              </div>
            ) : null}

            {groupedBalances.parental.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {groupedBalances.parental.map((balance) => (
                  <LeaveBalanceCard key={balance.leaveType} balance={balance} compact />
                ))}
              </div>
            ) : null}

            {groupedBalances.bereavement.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {groupedBalances.bereavement.map((balance) => (
                  <LeaveBalanceCard key={balance.leaveType} balance={balance} compact />
                ))}
              </div>
            ) : null}

            {groupedBalances.other.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {groupedBalances.other.map((balance) => (
                  <LeaveBalanceCard key={balance.leaveType} balance={balance} compact />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Request History</h2>
          {leaveRequests.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {leaveRequests.length} request{leaveRequests.length !== 1 ? 's' : ''}
            </span>
          ) : null}
        </div>

        {loading ? (
          <Card padding="lg">
            <div className="animate-pulse space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          </Card>
        ) : leaveRequests.length === 0 ? (
          <Card padding="lg">
            <div className="text-center py-4">
              <CalendarDaysIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No leave requests yet</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {leaveRequests.map((request) => {
              const statusConfig = getLeaveStatusConfig(request.status)
              return (
                <Link key={request.id} href={`/leaves/${request.id}`} className="block group">
                  <div className="rounded-lg border border-border bg-card p-4 hover:border-input hover:bg-muted/30 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{getLeaveTypeLabel(request.leaveType)}</span>
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
                          <span>{formatDateRange(request.startDate, request.endDate)}</span>
                          <span>•</span>
                          <span>
                            {request.totalDays} day{request.totalDays !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {request.reason ? (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">"{request.reason}"</p>
                        ) : null}
                      </div>
                      <ChevronRightIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

