'use client'

import { useState } from 'react'
import { LeavesApi, type DashboardPendingLeaveRequest } from '@/lib/api-client'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { CheckIcon, XIcon, CalendarDaysIcon } from '@/components/ui/Icons'

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

type PendingLeaveApprovalsProps = {
  requests: DashboardPendingLeaveRequest[]
  onUpdate: () => void
}

export function PendingLeaveApprovals({ requests, onUpdate }: PendingLeaveApprovalsProps) {
  const [processing, setProcessing] = useState<string | null>(null)

  if (!requests || requests.length === 0) {
    return null
  }

  const handleApprove = async (id: string) => {
    setProcessing(id)
    try {
      await LeavesApi.update(id, { status: 'APPROVED' })
      onUpdate()
    } catch (e) {
      console.error('Failed to approve leave', e)
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (id: string) => {
    setProcessing(id)
    try {
      await LeavesApi.update(id, { status: 'REJECTED' })
      onUpdate()
    } catch (e) {
      console.error('Failed to reject leave', e)
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <div
          key={request.id}
          className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl"
        >
          <Avatar
            src={request.employee.avatar}
            alt={`${request.employee.firstName} ${request.employee.lastName}`}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-900">
                {request.employee.firstName} {request.employee.lastName}
              </span>
              <span className="text-xs text-gray-500">
                {LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
              <span>{formatDateRange(request.startDate, request.endDate)}</span>
              <span className="text-gray-400">·</span>
              <span>{request.totalDays} day{request.totalDays !== 1 ? 's' : ''}</span>
            </div>
            {request.reason && (
              <p className="text-xs text-gray-500 mt-1 truncate">{request.reason}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleReject(request.id)}
              disabled={processing === request.id}
              className="text-gray-600 hover:text-red-600 hover:bg-red-50"
            >
              <XIcon className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => handleApprove(request.id)}
              disabled={processing === request.id}
            >
              <CheckIcon className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
