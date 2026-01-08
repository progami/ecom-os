import type { WorkflowRecordDTO, WorkflowStageStatus } from '@/lib/contracts/workflow-record'
import { timelineFromAudit } from '@/lib/domain/workflow/timeline-from-audit'
import { toneForStatus } from '@/lib/domain/workflow/tone'
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS } from '@/lib/domain/leave/constants'
import { buildLeaveNextActions, type LeaveViewerContext, type LeaveWorkflowRecordInput } from './next-actions'

function stageStatus(order: string[], current: string, id: string): WorkflowStageStatus {
  if (current === id) return 'current'
  return order.indexOf(id) < order.indexOf(current) ? 'completed' : 'upcoming'
}

function currentStageIdForStatus(status: string): string {
  switch (status) {
    case 'PENDING':
    case 'PENDING_MANAGER':
      return 'manager'
    case 'PENDING_HR':
      return 'hr'
    case 'PENDING_SUPER_ADMIN':
      return 'admin'
    case 'APPROVED':
    case 'REJECTED':
    case 'CANCELLED':
      return 'done'
    default:
      return 'requested'
  }
}

export async function leaveToWorkflowRecordDTO(
  leave: LeaveWorkflowRecordInput,
  viewer: LeaveViewerContext
): Promise<WorkflowRecordDTO> {
  const stageOrder = ['requested', 'manager', 'hr', 'admin', 'done']
  const canView = viewer.isHR || viewer.isSuperAdmin || leave.employeeId === viewer.employeeId || leave.employee.reportsToId === viewer.employeeId

  if (!canView) {
    return {
      identity: { title: 'Leave Request', recordId: leave.id, href: `/leaves/${leave.id}` },
      subject: { displayName: 'Restricted' },
      workflow: {
        currentStageId: 'requested',
        currentStageLabel: 'Requested',
        stages: [],
      },
      actions: { primary: null, secondary: [], more: [] },
      summary: [],
      timeline: [],
      access: { canView: false, noAccessReason: 'You do not have access to this leave request.' },
    }
  }

  const pendingStatuses = ['PENDING', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_SUPER_ADMIN']
  const currentStageId = currentStageIdForStatus(leave.status)

  const dueAt = pendingStatuses.includes(leave.status) ? leave.startDate.toISOString() : undefined
  const dueMs = dueAt ? Date.parse(dueAt) : null
  const nowMs = Date.now()
  const isOverdue = Boolean(dueMs && dueMs < nowMs)
  const overdueLabel = isOverdue ? `Overdue by ${Math.max(1, Math.ceil((nowMs - (dueMs ?? nowMs)) / 86_400_000))}d` : undefined

  const timeline = await timelineFromAudit({ entityType: 'LEAVE_REQUEST', entityId: leave.id })

  return {
    identity: {
      title: 'Leave Request',
      recordId: leave.id,
      href: `/leaves/${leave.id}`,
    },
    subject: {
      displayName: `${leave.employee.firstName} ${leave.employee.lastName}`.trim(),
      employeeId: leave.employee.employeeId,
      subtitle: `${leave.employee.position} • ${leave.employee.department}`,
      avatarUrl: leave.employee.avatar,
    },
    workflow: {
      currentStageId,
      currentStageLabel:
        currentStageId === 'manager'
          ? 'Manager approval'
          : currentStageId === 'hr'
            ? 'HR approval'
            : currentStageId === 'admin'
              ? 'Final approval'
              : currentStageId === 'done'
                ? 'Done'
                : 'Requested',
      stages: [
        { id: 'requested', label: 'Requested', status: stageStatus(stageOrder, currentStageId, 'requested') },
        { id: 'manager', label: 'Manager', status: stageStatus(stageOrder, currentStageId, 'manager') },
        { id: 'hr', label: 'HR', status: stageStatus(stageOrder, currentStageId, 'hr') },
        { id: 'admin', label: 'Admin', status: stageStatus(stageOrder, currentStageId, 'admin') },
        { id: 'done', label: 'Done', status: stageStatus(stageOrder, currentStageId, 'done') },
      ],
      statusBadge: {
        label: LEAVE_STATUS_LABELS[leave.status as keyof typeof LEAVE_STATUS_LABELS] ?? leave.status.replaceAll('_', ' '),
        tone: toneForStatus(leave.status),
      },
      sla: dueAt ? { dueAt, isOverdue, overdueLabel, tone: isOverdue ? 'danger' : 'none' } : { isOverdue: false, tone: 'none' },
    },
    actions: buildLeaveNextActions(leave, viewer),
    summary: [
      {
        label: 'Type',
        value:
          LEAVE_TYPE_LABELS[leave.leaveType as keyof typeof LEAVE_TYPE_LABELS] ?? leave.leaveType.replaceAll('_', ' '),
      },
      { label: 'Dates', value: `${leave.startDate.toLocaleDateString('en-US')} → ${leave.endDate.toLocaleDateString('en-US')}` },
      { label: 'Total days', value: String(leave.totalDays) },
      {
        label: 'Status',
        value: LEAVE_STATUS_LABELS[leave.status as keyof typeof LEAVE_STATUS_LABELS] ?? leave.status.replaceAll('_', ' '),
      },
    ],
    timeline,
    access: { canView: true },
  }
}
