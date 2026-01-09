'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ApiError, LeavesApi, type LeaveRequest } from '@/lib/api-client'
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record'
import { executeAction } from '@/lib/actions/execute-action'
import { WorkflowRecordLayout } from '@/components/layouts/WorkflowRecordLayout'
import { Card } from '@/components/ui/card'
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS } from '@/lib/domain/leave/constants'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

type ApprovalStep = {
  level: number
  label: string
  status: 'pending' | 'approved' | 'current'
  approvedBy?: { firstName: string; lastName: string } | null
  approvedAt?: string | null
  notes?: string | null
}

function getApprovalSteps(leave: LeaveRequest): ApprovalStep[] {
  const steps: ApprovalStep[] = []

  const pendingStatuses = ['PENDING', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_SUPER_ADMIN']

  const managerApproved = Boolean(leave.managerApprovedById)
  const isAtManager = leave.status === 'PENDING' || leave.status === 'PENDING_MANAGER'
  steps.push({
    level: 1,
    label: 'Manager',
    status: managerApproved ? 'approved' : isAtManager ? 'current' : 'pending',
    approvedBy: leave.managerApprovedBy,
    approvedAt: leave.managerApprovedAt,
    notes: leave.managerNotes,
  })

  const hrApproved = Boolean(leave.hrApprovedById)
  const isAtHR = leave.status === 'PENDING_HR'
  steps.push({
    level: 2,
    label: 'HR',
    status: hrApproved ? 'approved' : isAtHR ? 'current' : 'pending',
    approvedBy: leave.hrApprovedBy,
    approvedAt: leave.hrApprovedAt,
    notes: leave.hrNotes,
  })

  const adminApproved = Boolean(leave.superAdminApprovedById)
  const isAtAdmin = leave.status === 'PENDING_SUPER_ADMIN'
  steps.push({
    level: 3,
    label: 'Final',
    status: adminApproved ? 'approved' : isAtAdmin ? 'current' : 'pending',
    approvedBy: leave.superAdminApprovedBy,
    approvedAt: leave.superAdminApprovedAt,
    notes: leave.superAdminNotes,
  })

  if (!pendingStatuses.includes(leave.status) && leave.status !== 'APPROVED') return steps
  return steps
}

function ApprovalChain({ steps }: { steps: ApprovalStep[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step, idx) => (
        <div key={step.level} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div
              className={
                step.status === 'approved'
                  ? 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-success-100 text-success-700'
                  : step.status === 'current'
                    ? 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-warning-100 text-warning-700'
                    : 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-muted text-muted-foreground'
              }
            >
              {step.level}
            </div>
            {idx < steps.length - 1 ? (
              <div
                className={step.status === 'approved' ? 'w-0.5 h-8 bg-success-200' : 'w-0.5 h-8 bg-border'}
              />
            ) : null}
          </div>

          <div className="flex-1 pb-3">
            <p className="text-sm font-medium text-foreground">{step.label}</p>
            {step.status === 'approved' && step.approvedBy ? (
              <p className="text-sm text-muted-foreground">
                {step.approvedBy.firstName} {step.approvedBy.lastName}
                {step.approvedAt ? ` • ${formatDate(step.approvedAt)}` : ''}
              </p>
            ) : step.status === 'current' ? (
              <p className="text-sm text-warning-600">Awaiting approval</p>
            ) : (
              <p className="text-sm text-muted-foreground">Pending</p>
            )}
            {step.notes ? (
              <p className="text-sm text-muted-foreground mt-1 italic">"{step.notes}"</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function LeaveWorkflowPage() {
  const params = useParams()
  const id = params.id as string

  const [dto, setDto] = useState<WorkflowRecordDTO | null>(null)
  const [leave, setLeave] = useState<LeaveRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string[] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorDetails(null)

    try {
      const [workflow, raw] = await Promise.all([
        LeavesApi.getWorkflowRecord(id),
        LeavesApi.get(id),
      ])
      setDto(workflow)
      setLeave(raw)
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.body?.details)) {
        setError(e.body?.error || 'Failed to load leave request')
        setErrorDetails(e.body.details.filter((d: unknown) => typeof d === 'string' && d.trim()))
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load leave request')
      }

      setDto(null)
      setLeave(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const onAction = useCallback(
    async (actionId: ActionId, input?: Parameters<typeof executeAction>[2]) => {
      setError(null)
      setErrorDetails(null)

      try {
        await executeAction(actionId, { type: 'LEAVE_REQUEST', id }, input)
        await load()
      } catch (e) {
        if (e instanceof ApiError && Array.isArray(e.body?.details)) {
          setError(e.body?.error || 'Validation failed')
          setErrorDetails(e.body.details.filter((d: unknown) => typeof d === 'string' && d.trim()))
          return
        }

        setError(e instanceof Error ? e.message : 'Failed to complete action')
      }
    },
    [id, load]
  )

  const approvalSteps = useMemo(() => (leave ? getApprovalSteps(leave) : []), [leave])
  const showApprovalChain = Boolean(
    leave &&
      (leave.status === 'APPROVED' ||
        ['PENDING', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_SUPER_ADMIN'].includes(leave.status))
  )

  if (loading) {
    return (
      <Card padding="lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </Card>
    )
  }

  if (!dto) {
    return (
      <Card padding="lg">
        <p className="text-sm font-medium text-foreground">Leave request</p>
        <p className="text-sm text-muted-foreground mt-1">{error ?? 'Not found'}</p>
      </Card>
    )
  }

  return (
      <WorkflowRecordLayout data={dto} onAction={onAction} backHref="/leave">
        {/* Inline feedback messages */}
        {error && (
          <div className="mb-6 flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            <span className="shrink-0">✕</span>
            <div>
              <span>{error}</span>
              {errorDetails && errorDetails.length > 0 && (
                <ul className="mt-1 list-disc list-inside text-xs">
                  {errorDetails.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}

        {leave ? (
          <div className="space-y-6">
            <Card padding="lg">
              <h3 className="text-sm font-semibold text-foreground mb-3">Leave details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Leave type</p>
                  <p className="text-sm text-foreground mt-0.5">
                    {LEAVE_TYPE_LABELS[leave.leaveType as keyof typeof LEAVE_TYPE_LABELS] ??
                      leave.leaveType.replaceAll('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total days</p>
                  <p className="text-sm text-foreground mt-0.5">{leave.totalDays}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Start date</p>
                  <p className="text-sm text-foreground mt-0.5">{formatDate(leave.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">End date</p>
                  <p className="text-sm text-foreground mt-0.5">{formatDate(leave.endDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <p className="text-sm text-foreground mt-0.5">
                    {LEAVE_STATUS_LABELS[leave.status as keyof typeof LEAVE_STATUS_LABELS] ??
                      leave.status.replaceAll('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Requested</p>
                  <p className="text-sm text-foreground mt-0.5">{formatDate(leave.createdAt)}</p>
                </div>
                {leave.reason ? (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-muted-foreground">Reason</p>
                    <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">{leave.reason}</p>
                  </div>
                ) : null}
              </div>
            </Card>

            {showApprovalChain ? (
              <Card padding="lg">
                <h3 className="text-sm font-semibold text-foreground mb-3">Approval chain</h3>
                <ApprovalChain steps={approvalSteps} />
              </Card>
            ) : null}

            {leave.status === 'REJECTED' && leave.reviewedBy ? (
              <Card padding="lg">
                <h3 className="text-sm font-semibold text-foreground mb-3">Rejection</h3>
                <p className="text-sm text-foreground">
                  {leave.reviewedBy.firstName} {leave.reviewedBy.lastName}
                  {leave.reviewedAt ? <span className="text-muted-foreground"> • {formatDate(leave.reviewedAt)}</span> : null}
                </p>
                {leave.reviewNotes ? (
                  <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                    {leave.reviewNotes}
                  </p>
                ) : null}
              </Card>
            ) : null}
          </div>
        ) : null}
      </WorkflowRecordLayout>
  )
}
