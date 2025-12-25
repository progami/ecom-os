import type { LeaveRequest } from '@ecom-os/prisma-hrms'
import type { WorkflowRecordDTO, WorkflowRecordAction, WorkflowStageStatus } from '@/lib/contracts/workflow-record'
import { timelineFromAudit } from '@/lib/domain/workflow/timeline-from-audit'
import { toneForStatus } from '@/lib/domain/workflow/tone'

type LeaveWorkflowRecordInput = LeaveRequest & {
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
}

type ViewerContext = {
  employeeId: string
  isHR: boolean
  isSuperAdmin: boolean
}

function formatLeaveType(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase()
}

function stageStatus(current: string, id: string): WorkflowStageStatus {
  if (current === id) return 'current'
  const order = ['requested', 'approval', 'decision']
  return order.indexOf(id) < order.indexOf(current) ? 'completed' : 'upcoming'
}

function buildActions(leave: LeaveWorkflowRecordInput, viewer: ViewerContext): WorkflowRecordDTO['actions'] {
  const isOwner = leave.employeeId === viewer.employeeId
  const isManager = leave.employee.reportsToId === viewer.employeeId
  const isPending = leave.status === 'PENDING'

  const actions: WorkflowRecordDTO['actions'] = { primary: null, secondary: [], more: [] }

  if (!isPending) return actions

  if (isOwner) {
    actions.primary = {
      id: 'leave.cancel',
      label: 'Cancel request',
      variant: 'secondary',
      disabled: false,
    }
    return actions
  }

  if (viewer.isHR || viewer.isSuperAdmin || isManager) {
    actions.primary = { id: 'leave.approve', label: 'Approve', variant: 'primary', disabled: false }
    actions.secondary = [{ id: 'leave.reject', label: 'Reject', variant: 'danger', disabled: false }]
    return actions
  }

  actions.primary = {
    id: 'leave.approve',
    label: 'Waiting for approval',
    variant: 'primary',
    disabled: true,
    disabledReason: 'Only the requester, their manager, or HR can act on this request.',
  }

  return actions
}

export async function leaveToWorkflowRecordDTO(leave: LeaveWorkflowRecordInput, viewer: ViewerContext): Promise<WorkflowRecordDTO> {
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
    actions: buildActions(leave, viewer),
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

