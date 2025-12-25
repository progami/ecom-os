import type { PerformanceReview } from '@ecom-os/prisma-hrms'
import type { WorkflowRecordDTO, WorkflowStageStatus, WorkflowTone } from '@/lib/contracts/workflow-record'
import { timelineFromAudit } from '@/lib/domain/workflow/timeline-from-audit'
import { toneForStatus } from '@/lib/domain/workflow/tone'

type PerformanceWorkflowRecordInput = PerformanceReview & {
  employee: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    department: string
    position: string
    avatar: string | null
    reportsToId: string | null
  }
  assignedReviewer?: {
    id: string
    firstName: string
    lastName: string
    position: string | null
  } | null
}

type ViewerContext = {
  employeeId: string
  isHR: boolean
  isSuperAdmin: boolean
  canView: boolean
}

function stageStatus(order: string[], current: string, id: string): WorkflowStageStatus {
  if (current === id) return 'current'
  return order.indexOf(id) < order.indexOf(current) ? 'completed' : 'upcoming'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    NOT_STARTED: 'Not started',
    IN_PROGRESS: 'In progress',
    DRAFT: 'Draft',
    PENDING_HR_REVIEW: 'Pending HR review',
    PENDING_SUPER_ADMIN: 'Pending final approval',
    PENDING_ACKNOWLEDGMENT: 'Pending acknowledgement',
    ACKNOWLEDGED: 'Acknowledged',
    COMPLETED: 'Completed',
  }
  return map[status] ?? status.replaceAll('_', ' ')
}

function buildWorkflow(review: PerformanceWorkflowRecordInput): WorkflowRecordDTO['workflow'] {
  const order = ['start', 'submit', 'hr', 'admin', 'ack']
  const currentStageId = (() => {
    switch (review.status) {
      case 'NOT_STARTED':
        return 'start'
      case 'IN_PROGRESS':
      case 'DRAFT':
        return 'submit'
      case 'PENDING_HR_REVIEW':
        return 'hr'
      case 'PENDING_SUPER_ADMIN':
        return 'admin'
      case 'PENDING_ACKNOWLEDGMENT':
        return 'ack'
      case 'ACKNOWLEDGED':
      case 'COMPLETED':
        return 'ack'
      default:
        return 'start'
    }
  })()

  const dueAt = review.deadline ? review.deadline.toISOString() : undefined
  const dueMs = dueAt ? Date.parse(dueAt) : null
  const nowMs = Date.now()
  const isOverdue = Boolean(dueMs && dueMs < nowMs && ['PENDING_HR_REVIEW', 'PENDING_SUPER_ADMIN', 'PENDING_ACKNOWLEDGMENT', 'IN_PROGRESS', 'DRAFT'].includes(review.status))
  const overdueLabel = isOverdue ? `Overdue by ${Math.max(1, Math.ceil((nowMs - (dueMs ?? nowMs)) / 86_400_000))}d` : undefined

  return {
    currentStageId,
    currentStageLabel:
      currentStageId === 'start'
        ? 'Start'
        : currentStageId === 'submit'
          ? 'Manager submission'
          : currentStageId === 'hr'
            ? 'HR review'
            : currentStageId === 'admin'
              ? 'Final approval'
              : 'Acknowledgement',
    stages: [
      { id: 'start', label: 'Start', status: stageStatus(order, currentStageId, 'start') },
      { id: 'submit', label: 'Manager', status: stageStatus(order, currentStageId, 'submit') },
      { id: 'hr', label: 'HR', status: stageStatus(order, currentStageId, 'hr') },
      { id: 'admin', label: 'Final', status: stageStatus(order, currentStageId, 'admin') },
      { id: 'ack', label: 'Ack', status: stageStatus(order, currentStageId, 'ack') },
    ],
    statusBadge: { label: statusLabel(review.status), tone: toneForStatus(review.status) },
    sla: dueAt ? { dueAt, isOverdue, overdueLabel, tone: isOverdue ? 'danger' : 'none' } : { isOverdue: false, tone: 'none' },
  }
}

function buildActions(review: PerformanceWorkflowRecordInput, viewer: ViewerContext): WorkflowRecordDTO['actions'] {
  const actions: WorkflowRecordDTO['actions'] = { primary: null, secondary: [], more: [] }
  if (!viewer.canView) return actions

  const isEmployee = viewer.employeeId === review.employeeId
  const isReviewer = Boolean(review.assignedReviewerId && viewer.employeeId === review.assignedReviewerId)

  switch (review.status) {
    case 'NOT_STARTED':
      if (isReviewer) {
        actions.primary = { id: 'review.start', label: 'Start review', variant: 'primary', disabled: false }
      } else {
        actions.primary = {
          id: 'review.start',
          label: 'Waiting for manager',
          variant: 'primary',
          disabled: true,
          disabledReason: 'Only the assigned reviewer can start this review.',
        }
      }
      return actions

    case 'IN_PROGRESS':
    case 'DRAFT':
      if (isReviewer) {
        actions.primary = { id: 'review.submit', label: 'Submit to HR', variant: 'primary', disabled: false }
      } else {
        actions.primary = {
          id: 'review.submit',
          label: 'Waiting for submission',
          variant: 'primary',
          disabled: true,
          disabledReason: 'Only the assigned reviewer can submit this review.',
        }
      }
      return actions

    case 'PENDING_HR_REVIEW':
      if (viewer.isHR || viewer.isSuperAdmin) {
        actions.primary = { id: 'review.hrApprove', label: 'Approve (HR)', variant: 'primary', disabled: false }
        actions.secondary = [{ id: 'review.hrReject', label: 'Reject', variant: 'danger', disabled: false }]
      } else {
        actions.primary = {
          id: 'review.hrApprove',
          label: 'Waiting for HR review',
          variant: 'primary',
          disabled: true,
          disabledReason: 'HR must review before final approval.',
        }
      }
      return actions

    case 'PENDING_SUPER_ADMIN':
      if (viewer.isSuperAdmin) {
        actions.primary = { id: 'review.adminApprove', label: 'Final approve', variant: 'primary', disabled: false }
        actions.secondary = [{ id: 'review.adminReject', label: 'Reject', variant: 'danger', disabled: false }]
      } else {
        actions.primary = {
          id: 'review.adminApprove',
          label: 'Waiting for final approval',
          variant: 'primary',
          disabled: true,
          disabledReason: 'Super Admin must approve before acknowledgement.',
        }
      }
      return actions

    case 'PENDING_ACKNOWLEDGMENT':
      if (isEmployee) {
        actions.primary = { id: 'review.acknowledge', label: 'Acknowledge', variant: 'primary', disabled: false }
      } else {
        actions.primary = {
          id: 'review.acknowledge',
          label: 'Waiting for acknowledgement',
          variant: 'primary',
          disabled: true,
          disabledReason: 'Only the employee can acknowledge this review.',
        }
      }
      return actions

    default:
      return actions
  }
}

function reviewTone(reviewType: string): WorkflowTone {
  switch (reviewType) {
    case 'PIP':
      return 'danger'
    case 'PROBATION':
      return 'warning'
    default:
      return 'neutral'
  }
}

export async function performanceReviewToWorkflowRecordDTO(review: PerformanceWorkflowRecordInput, viewer: ViewerContext): Promise<WorkflowRecordDTO> {
  if (!viewer.canView) {
    return {
      identity: { title: 'Performance review', recordId: review.id, href: `/performance/reviews/${review.id}` },
      subject: { displayName: 'Restricted' },
      workflow: { currentStageId: 'start', currentStageLabel: 'Start', stages: [] },
      actions: { primary: null, secondary: [], more: [] },
      summary: [],
      timeline: [],
      access: { canView: false, noAccessReason: 'You do not have access to this review.' },
    }
  }

  const reviewerName = review.assignedReviewer
    ? `${review.assignedReviewer.firstName} ${review.assignedReviewer.lastName}`.trim()
    : review.reviewerName

  const timeline = await timelineFromAudit({ entityType: 'PERFORMANCE_REVIEW', entityId: review.id })

  return {
    identity: {
      title: 'Performance review',
      recordId: review.id,
      href: `/performance/reviews/${review.id}`,
    },
    subject: {
      displayName: `${review.employee.firstName} ${review.employee.lastName}`.trim(),
      employeeId: review.employee.employeeId,
      subtitle: `${review.roleTitle || review.employee.position} • ${review.employee.department}`,
      avatarUrl: review.employee.avatar,
      statusChip: { label: review.reviewType.replaceAll('_', ' '), tone: reviewTone(review.reviewType) },
    },
    workflow: buildWorkflow(review),
    actions: buildActions(review, viewer),
    summary: [
      { label: 'Period', value: review.reviewPeriod },
      { label: 'Role', value: review.roleTitle },
      { label: 'Reviewer', value: reviewerName },
      { label: 'Overall rating', value: String(review.overallRating) },
    ],
    timeline,
    access: { canView: true },
  }
}

