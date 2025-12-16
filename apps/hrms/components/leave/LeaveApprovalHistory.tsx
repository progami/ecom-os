'use client'

import { type DashboardLeaveApprovalHistory } from '@/lib/api-client'
import { Avatar } from '@/components/ui/Avatar'
import { CalendarDaysIcon, CheckIcon, XIcon } from '@/components/ui/Icons'

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

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

  if (startDate.toDateString() === endDate.toDateString()) {
    return startDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  }

  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
  }

  return `${startDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type LeaveApprovalHistoryProps = {
  history: DashboardLeaveApprovalHistory[]
}

export function LeaveApprovalHistory({ history }: LeaveApprovalHistoryProps) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center py-6">
        <CalendarDaysIcon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-500 text-sm">No approval history yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {history.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
        >
          <Avatar
            src={item.employee.avatar}
            alt={`${item.employee.firstName} ${item.employee.lastName}`}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">
                {item.employee.firstName} {item.employee.lastName}
              </span>
              <span className="text-xs text-slate-500">
                {LEAVE_TYPE_LABELS[item.leaveType] || item.leaveType}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{formatDateRange(item.startDate, item.endDate)}</span>
              <span className="text-slate-300">·</span>
              <span>{item.totalDays} day{item.totalDays !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {item.status === 'APPROVED' ? (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                <CheckIcon className="h-3 w-3" />
                Approved
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                <XIcon className="h-3 w-3" />
                Rejected
              </span>
            )}
            <span className="text-xs text-slate-400">
              {formatRelativeTime(item.reviewedAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
