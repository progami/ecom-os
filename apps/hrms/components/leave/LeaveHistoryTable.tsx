'use client'

import { type LeaveRequest } from '@/lib/api-client'
import { CalendarDaysIcon, XIcon } from '@/components/ui/Icons'
import { StatusBadge } from '@/components/ui/Badge'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Annual Leave',
  SICK: 'Sick Leave',
  PERSONAL: 'Personal Leave',
  UNPAID: 'Unpaid Leave',
  MATERNITY: 'Maternity Leave',
  PATERNITY: 'Paternity Leave',
  BEREAVEMENT: 'Bereavement',
  COMP_TIME: 'Comp Time',
}

function formatDate(dateString: string): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

type LeaveHistoryTableProps = {
  requests: LeaveRequest[]
  loading?: boolean
  onCancel?: (id: string) => void
}

export function LeaveHistoryTable({ requests, loading, onCancel }: LeaveHistoryTableProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-8">
        <CalendarDaysIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No leave requests</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <div
          key={request.id}
          className="p-4 bg-gray-50 rounded-lg border border-gray-100"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900">
                  {LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType.replace(/_/g, ' ')}
                </span>
                <StatusBadge status={request.status} />
              </div>
              <p className="text-sm text-gray-600">
                {formatDate(request.startDate)} — {formatDate(request.endDate)}
                <span className="text-gray-400 mx-2">·</span>
                {request.totalDays} day{request.totalDays !== 1 ? 's' : ''}
              </p>
              {request.reason && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{request.reason}</p>
              )}
              {request.reviewedBy && (
                <p className="text-xs text-gray-400 mt-1">
                  {request.status === 'APPROVED' ? 'Approved' : 'Reviewed'} by {request.reviewedBy.firstName} {request.reviewedBy.lastName}
                </p>
              )}
            </div>
            {request.status === 'PENDING' && onCancel && (
              <button
                onClick={() => onCancel(request.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Cancel request"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
