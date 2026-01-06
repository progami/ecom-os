import type { WorkflowRecordDTO, WorkflowStageStatus, WorkflowTone } from '@/lib/contracts/workflow-record'
import { timelineFromAudit } from '@/lib/domain/workflow/timeline-from-audit'
import { toneForStatus } from '@/lib/domain/workflow/tone'
import {
  buildPerformanceReviewNextActions,
  type PerformanceViewerContext,
  type PerformanceWorkflowRecordInput,
} from './next-actions'

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
      { id: 'admin', label: 'Admin', status: stageStatus(order, currentStageId, 'admin') },
      { id: 'ack', label: 'Ack', status: stageStatus(order, currentStageId, 'ack') },
    ],
    statusBadge: { label: statusLabel(review.status), tone: toneForStatus(review.status) },
    sla: dueAt ? { dueAt, isOverdue, overdueLabel, tone: isOverdue ? 'danger' : 'none' } : { isOverdue: false, tone: 'none' },
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

export async function performanceReviewToWorkflowRecordDTO(
  review: PerformanceWorkflowRecordInput,
  viewer: PerformanceViewerContext
): Promise<WorkflowRecordDTO> {
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
    actions: buildPerformanceReviewNextActions(review, viewer),
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
