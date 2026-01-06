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
  PENDING_MANAGER: 'Pending Manager',
  PENDING_HR: 'Pending HR',
  PENDING_SUPER_ADMIN: 'Pending Final Approval',
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

type ApprovalStep = {
  level: number
  label: string
  status: 'pending' | 'approved' | 'current' | 'skipped'
  approvedBy?: { firstName: string; lastName: string } | null
  approvedAt?: string | null
  notes?: string | null
}

function getApprovalSteps(leave: LeaveRequest): ApprovalStep[] {
  const steps: ApprovalStep[] = []

  // Manager approval (Level 1)
  const managerApproved = !!leave.managerApprovedById
  const isAtManager = leave.status === 'PENDING_MANAGER'
  steps.push({
    level: 1,
    label: 'Manager',
    status: managerApproved ? 'approved' : isAtManager ? 'current' : 'pending',
    approvedBy: leave.managerApprovedBy,
    approvedAt: leave.managerApprovedAt,
    notes: leave.managerNotes,
  })

  // HR approval (Level 2)
  const hrApproved = !!leave.hrApprovedById
  const isAtHR = leave.status === 'PENDING_HR'
  steps.push({
    level: 2,
    label: 'HR',
    status: hrApproved ? 'approved' : isAtHR ? 'current' : 'pending',
    approvedBy: leave.hrApprovedBy,
    approvedAt: leave.hrApprovedAt,
    notes: leave.hrNotes,
  })

  // Super Admin approval (Level 3)
  const superAdminApproved = !!leave.superAdminApprovedById
  const isAtSuperAdmin = leave.status === 'PENDING_SUPER_ADMIN'
  steps.push({
    level: 3,
    label: 'Final Approval',
    status: superAdminApproved ? 'approved' : isAtSuperAdmin ? 'current' : 'pending',
    approvedBy: leave.superAdminApprovedBy,
    approvedAt: leave.superAdminApprovedAt,
    notes: leave.superAdminNotes,
  })

  return steps
}

function ApprovalChain({ steps }: { steps: ApprovalStep[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step, idx) => (
        <div key={step.level} className="flex items-start gap-3">
          {/* Step indicator */}
          <div className="flex flex-col items-center">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${step.status === 'approved'
                  ? 'bg-success-100 text-success-700'
                  : step.status === 'current'
                    ? 'bg-warning-100 text-warning-700'
                    : 'bg-muted text-muted-foreground'
                }
              `}
            >
              {step.status === 'approved' ? (
                <CheckIcon className="w-4 h-4" />
              ) : (
                step.level
              )}
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-0.5 h-8 ${step.status === 'approved' ? 'bg-success-200' : 'bg-border'}`} />
            )}
          </div>

          {/* Step content */}
          <div className="flex-1 pb-3">
            <p className="text-sm font-medium text-foreground">{step.label}</p>
            {step.status === 'approved' && step.approvedBy && (
              <p className="text-sm text-muted-foreground">
                Approved by {step.approvedBy.firstName} {step.approvedBy.lastName}
                {step.approvedAt && ` on ${formatDate(step.approvedAt)}`}
              </p>
            )}
            {step.status === 'current' && (
              <p className="text-sm text-warning-600">Awaiting approval</p>
            )}
            {step.status === 'pending' && (
              <p className="text-sm text-muted-foreground">Pending</p>
            )}
            {step.notes && (
              <p className="text-sm text-muted-foreground mt-1 italic">"{step.notes}"</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
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

  const handleCancel = async () => {
    setProcessing(true)
    setError(null)
    try {
      await LeavesApi.update(id, { status: 'CANCELLED' })
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to cancel leave request'
      setError(message)
    } finally {
      setProcessing(false)
    }
  }

  const handleManagerApprove = async (approved: boolean) => {
    setProcessing(true)
    setError(null)
    try {
      await LeavesApi.managerApprove(id, { approved })
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to process approval'
      setError(message)
    } finally {
      setProcessing(false)
    }
  }

  const handleHRApprove = async (approved: boolean) => {
    setProcessing(true)
    setError(null)
    try {
      await LeavesApi.hrApprove(id, { approved })
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to process approval'
      setError(message)
    } finally {
      setProcessing(false)
    }
  }

  const handleSuperAdminApprove = async (approved: boolean) => {
    setProcessing(true)
    setError(null)
    try {
      await LeavesApi.superAdminApprove(id, { approved })
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to process approval'
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
  const employeeName = `${employee.firstName} ${employee.lastName}`
  const permissions = leave.permissions
  const isPending = ['PENDING', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_SUPER_ADMIN'].includes(leave.status)
  const isRejected = leave.status === 'REJECTED'
  const approvalSteps = getApprovalSteps(leave)

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
          {isPending ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-warning-100 text-warning-800">
              <ClockIcon className="h-4 w-4" />
              {STATUS_LABELS[leave.status]}
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

        {/* Approval Chain */}
        {(isPending || leave.status === 'APPROVED') && (
          <div className="py-6 border-t border-border">
            <p className="text-sm font-medium text-foreground mb-4">Approval Chain</p>
            <ApprovalChain steps={approvalSteps} />
          </div>
        )}

        {/* Rejection info */}
        {isRejected && leave.reviewedBy && (
          <div className="py-6 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground mb-2">Rejected by</p>
            <p className="text-base text-foreground">
              {leave.reviewedBy.firstName} {leave.reviewedBy.lastName}
              {leave.reviewedAt && (
                <span className="text-muted-foreground"> on {formatDate(leave.reviewedAt)}</span>
              )}
            </p>
            {leave.reviewNotes && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">
                Reason: {leave.reviewNotes}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {permissions && (
          <div className="pt-6 border-t border-border space-y-4">
            {/* Manager approval actions */}
            {permissions.canManagerApprove && (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Manager Approval</p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleManagerApprove(false)}
                    disabled={processing}
                    size="sm"
                  >
                    <XIcon className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleManagerApprove(true)}
                    disabled={processing}
                    size="sm"
                  >
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            )}

            {/* HR approval actions */}
            {permissions.canHRApprove && (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">HR Approval</p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleHRApprove(false)}
                    disabled={processing}
                    size="sm"
                  >
                    <XIcon className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleHRApprove(true)}
                    disabled={processing}
                    size="sm"
                  >
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            )}

            {/* Super Admin approval actions */}
            {permissions.canSuperAdminApprove && (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Final Approval</p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleSuperAdminApprove(false)}
                    disabled={processing}
                    size="sm"
                  >
                    <XIcon className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleSuperAdminApprove(true)}
                    disabled={processing}
                    size="sm"
                  >
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            )}

            {/* Cancel action for owner */}
            {permissions.canCancel && (
              <div className="flex justify-end">
                <Button
                  variant="danger"
                  onClick={handleCancel}
                  disabled={processing}
                >
                  <XIcon className="h-4 w-4 mr-2" />
                  Cancel Request
                </Button>
              </div>
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
