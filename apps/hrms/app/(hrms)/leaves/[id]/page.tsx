'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LeavesApi, DashboardApi, type LeaveRequest } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { ArrowLeftIcon, CheckIcon, XIcon, ClockIcon } from '@/components/ui/Icons'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  PTO: 'PTO (Paid Time Off)',
  PARENTAL: 'Parental Leave',
  BEREAVEMENT_IMMEDIATE: 'Bereavement',
  UNPAID: 'Unpaid Leave',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function LeaveDetailPage() {
  const params = useParams()
  const pathname = usePathname()
  const id = params.id as string

  const leaveIndexHref = pathname?.includes('/leaves/')
    ? `${pathname.split('/leaves/')[0]}/leave`
    : '/leave'

  const [leave, setLeave] = useState<LeaveRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [leaveData, dashboard] = await Promise.all([
        LeavesApi.get(id),
        DashboardApi.get(),
      ])
      setLeave(leaveData)
      setCurrentEmployeeId(dashboard.currentEmployee?.id ?? null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load leave request'
      setError(message)
      setLeave(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const handleAction = async (action: 'APPROVED' | 'REJECTED' | 'CANCELLED') => {
    setProcessing(true)
    setError(null)
    try {
      await LeavesApi.update(id, { status: action })
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update leave request'
      setError(message)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card padding="lg">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </Card>
      </div>
    )
  }

  if (!leave || !leave.employee) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card padding="lg">
          <p className="text-sm font-medium text-foreground">Leave request not found</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <div className="mt-4">
            <Button variant="secondary" href={leaveIndexHref}>Back to Leave</Button>
          </div>
        </Card>
      </div>
    )
  }

  const employee = leave.employee
  const isOwn = employee.id === currentEmployeeId
  const canApproveReject = !isOwn && leave.status === 'PENDING'
  const canCancel = isOwn && leave.status === 'PENDING'
  const employeeName = `${employee.firstName} ${employee.lastName}`

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href={leaveIndexHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Leave
      </Link>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main card */}
      <Card padding="lg">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar
              src={employee.avatar}
              alt={employeeName}
              size="lg"
            />
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {employeeName}
                {isOwn && <span className="ml-2 text-sm font-normal text-muted-foreground">(You)</span>}
              </h1>
              <p className="text-sm text-muted-foreground">
                {employee.employeeId}
              </p>
            </div>
          </div>
          {leave.status === 'PENDING' ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-warning-100 text-warning-800">
              <ClockIcon className="h-4 w-4" />
              Pending
            </span>
          ) : (
            <StatusBadge status={STATUS_LABELS[leave.status]} />
          )}
        </div>

        {/* Details */}
        <div className="py-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Leave Type</p>
              <p className="text-base text-foreground">
                {LEAVE_TYPE_LABELS[leave.leaveType] ?? leave.leaveType}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Total Days</p>
              <p className="text-base text-foreground">
                {leave.totalDays} business day{leave.totalDays !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Start Date</p>
              <p className="text-base text-foreground">{formatDate(leave.startDate)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">End Date</p>
              <p className="text-base text-foreground">{formatDate(leave.endDate)}</p>
            </div>
          </div>

          {leave.reason && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Reason</p>
              <p className="text-base text-foreground whitespace-pre-line">{leave.reason}</p>
            </div>
          )}
        </div>

        {/* Review info if reviewed */}
        {leave.status !== 'PENDING' && leave.reviewedBy && (
          <div className="py-6 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {leave.status === 'APPROVED' ? 'Approved' : leave.status === 'REJECTED' ? 'Rejected' : 'Reviewed'} by
            </p>
            <p className="text-base text-foreground">
              {leave.reviewedBy.firstName} {leave.reviewedBy.lastName}
              {leave.reviewedAt && (
                <span className="text-muted-foreground"> on {formatDate(leave.reviewedAt)}</span>
              )}
            </p>
            {leave.reviewNotes && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">
                {leave.reviewNotes}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {(canApproveReject || canCancel) && (
          <div className="pt-6 border-t border-border flex justify-end gap-3">
            {canCancel && (
              <Button
                variant="danger"
                onClick={() => handleAction('CANCELLED')}
                disabled={processing}
              >
                <XIcon className="h-4 w-4 mr-2" />
                Cancel Request
              </Button>
            )}
            {canApproveReject && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => handleAction('REJECTED')}
                  disabled={processing}
                >
                  <XIcon className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleAction('APPROVED')}
                  disabled={processing}
                >
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Request date */}
      {leave.createdAt && (
        <p className="text-sm text-muted-foreground text-center">
          Requested on {formatDate(leave.createdAt)}
        </p>
      )}
    </div>
  )
}

