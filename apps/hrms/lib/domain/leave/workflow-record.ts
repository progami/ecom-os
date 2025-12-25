import type { WorkflowRecordDTO, WorkflowStageStatus } from '@/lib/contracts/workflow-record'
import { timelineFromAudit } from '@/lib/domain/workflow/timeline-from-audit'
import { toneForStatus } from '@/lib/domain/workflow/tone'
import { buildLeaveNextActions, type LeaveViewerContext, type LeaveWorkflowRecordInput } from './next-actions'

function formatLeaveType(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase()
}

function stageStatus(current: string, id: string): WorkflowStageStatus {
  if (current === id) return 'current'
  const order = ['requested', 'approval', 'decision']
  return order.indexOf(id) < order.indexOf(current) ? 'completed' : 'upcoming'
}

export async function leaveToWorkflowRecordDTO(
  leave: LeaveWorkflowRecordInput,
  viewer: LeaveViewerContext
): Promise<WorkflowRecordDTO> {
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

  const currentStageId = leave.status === 'PENDING' ? 'approval' : 'decision'

  const dueAt = leave.status === 'PENDING' ? leave.startDate.toISOString() : undefined
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
      currentStageLabel: currentStageId === 'approval' ? 'Approval' : 'Decision',
      stages: [
        { id: 'requested', label: 'Requested', status: stageStatus(currentStageId, 'requested') },
        { id: 'approval', label: 'Approval', status: stageStatus(currentStageId, 'approval') },
        { id: 'decision', label: 'Decision', status: stageStatus(currentStageId, 'decision') },
      ],
      statusBadge: { label: leave.status.replaceAll('_', ' '), tone: toneForStatus(leave.status) },
      sla: dueAt ? { dueAt, isOverdue, overdueLabel, tone: isOverdue ? 'danger' : 'none' } : { isOverdue: false, tone: 'none' },
    },
    actions: buildLeaveNextActions(leave, viewer),
    summary: [
      { label: 'Type', value: formatLeaveType(leave.leaveType) },
      { label: 'Dates', value: `${leave.startDate.toLocaleDateString('en-US')} → ${leave.endDate.toLocaleDateString('en-US')}` },
      { label: 'Total days', value: String(leave.totalDays) },
      { label: 'Status', value: leave.status.replaceAll('_', ' ') },
    ],
    timeline,
    access: { canView: true },
  }
}
