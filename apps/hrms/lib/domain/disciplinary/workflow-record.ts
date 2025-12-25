import type { DisciplinaryAction } from '@ecom-os/prisma-hrms'
import type { WorkflowRecordDTO, WorkflowRecordAction, WorkflowStageStatus, WorkflowTone } from '@/lib/contracts/workflow-record'
import { timelineFromAudit } from '@/lib/domain/workflow/timeline-from-audit'
import { toneForStatus } from '@/lib/domain/workflow/tone'

type DisciplinaryWorkflowRecordInput = DisciplinaryAction & {
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
  canActAsManager: boolean
}

function stageStatus(order: string[], current: string, id: string): WorkflowStageStatus {
  if (current === id) return 'current'
  return order.indexOf(id) < order.indexOf(current) ? 'completed' : 'upcoming'
}

function addDaysIso(anchor: Date, days: number): string {
  const d = new Date(anchor)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function computeSla(action: DisciplinaryWorkflowRecordInput): WorkflowRecordDTO['workflow']['sla'] {
  const nowMs = Date.now()

  const maybe = (dueAt?: string): WorkflowRecordDTO['workflow']['sla'] => {
    if (!dueAt) return { isOverdue: false, tone: 'none' }
    const dueMs = Date.parse(dueAt)
    if (!Number.isFinite(dueMs)) return { isOverdue: false, tone: 'none' }
    const isOverdue = dueMs < nowMs
    const overdueLabel = isOverdue ? `Overdue by ${Math.max(1, Math.ceil((nowMs - dueMs) / 86_400_000))}d` : undefined
    return { dueAt, isOverdue, overdueLabel, tone: isOverdue ? 'danger' : 'none' }
  }

  switch (action.status) {
    case 'PENDING_HR_REVIEW':
      return maybe(addDaysIso(action.reportedDate, 3))
    case 'PENDING_SUPER_ADMIN':
      return maybe(addDaysIso(action.hrReviewedAt ?? action.reportedDate, 2))
    case 'PENDING_ACKNOWLEDGMENT':
      return maybe(addDaysIso(action.superAdminApprovedAt ?? action.hrReviewedAt ?? action.reportedDate, 5))
    case 'APPEAL_PENDING_HR':
      return maybe(addDaysIso(action.appealedAt ?? action.reportedDate, 3))
    case 'APPEAL_PENDING_SUPER_ADMIN':
      return maybe(addDaysIso(action.appealHrReviewedAt ?? action.appealedAt ?? action.reportedDate, 2))
    default:
      return { isOverdue: false, tone: 'none' }
  }
}

function severityTone(severity: string): WorkflowTone {
  switch (severity) {
    case 'CRITICAL':
      return 'danger'
    case 'MAJOR':
      return 'warning'
    case 'MODERATE':
      return 'warning'
    case 'MINOR':
    default:
      return 'neutral'
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING_HR_REVIEW: 'Pending HR review',
    PENDING_SUPER_ADMIN: 'Pending final approval',
    PENDING_ACKNOWLEDGMENT: 'Pending acknowledgement',
    ACTIVE: 'Active',
    APPEAL_PENDING_HR: 'Appeal pending HR',
    APPEAL_PENDING_SUPER_ADMIN: 'Appeal pending final decision',
    APPEALED: 'Appealed',
    CLOSED: 'Closed',
    DISMISSED: 'Dismissed',
    OPEN: 'Open',
    UNDER_INVESTIGATION: 'Under investigation',
    ACTION_TAKEN: 'Action taken',
  }
  return map[status] ?? status.replaceAll('_', ' ')
}

function buildActions(action: DisciplinaryWorkflowRecordInput, viewer: ViewerContext): WorkflowRecordDTO['actions'] {
  const actions: WorkflowRecordDTO['actions'] = { primary: null, secondary: [], more: [] }

  const isEmployee = viewer.employeeId === action.employeeId

  if (action.status === 'PENDING_HR_REVIEW') {
    if (viewer.isHR || viewer.isSuperAdmin) {
      actions.primary = {
        id: 'disciplinary.hrApprove',
        label: 'Approve (HR)',
        variant: 'primary',
        disabled: false,
      }
      actions.secondary = [
        { id: 'disciplinary.hrReject', label: 'Reject', variant: 'danger', disabled: false },
      ]
      return actions
    }

    actions.primary = {
      id: 'disciplinary.hrApprove',
      label: 'Waiting for HR review',
      variant: 'primary',
      disabled: true,
      disabledReason: 'HR must review before this record can proceed.',
    }
    return actions
  }

  if (action.status === 'PENDING_SUPER_ADMIN') {
    if (viewer.isSuperAdmin) {
      actions.primary = {
        id: 'disciplinary.adminApprove',
        label: 'Final approve',
        variant: 'primary',
        disabled: false,
      }
      actions.secondary = [
        { id: 'disciplinary.adminReject', label: 'Reject', variant: 'danger', disabled: false },
      ]
      return actions
    }

    actions.primary = {
      id: 'disciplinary.adminApprove',
      label: 'Waiting for final approval',
      variant: 'primary',
      disabled: true,
      disabledReason: 'Super Admin must approve before acknowledgement is available.',
    }
    return actions
  }

  if (action.status === 'PENDING_ACKNOWLEDGMENT') {
    const needsEmployeeAck = !action.employeeAcknowledged
    const needsManagerAck = !action.managerAcknowledged

    if (isEmployee && needsEmployeeAck) {
      actions.primary = {
        id: 'disciplinary.acknowledge',
        label: 'Acknowledge',
        variant: 'primary',
        disabled: false,
      }
      actions.secondary = [
        { id: 'disciplinary.appeal', label: 'Appeal', variant: 'secondary', disabled: false },
      ]
      return actions
    }

    if (viewer.canActAsManager && needsManagerAck) {
      actions.primary = {
        id: 'disciplinary.acknowledge',
        label: 'Acknowledge as manager',
        variant: 'primary',
        disabled: false,
      }
      return actions
    }

    const blockedBy = needsEmployeeAck ? 'employee' : needsManagerAck ? 'manager' : 'none'
    actions.primary = {
      id: 'disciplinary.acknowledge',
      label: 'Waiting for acknowledgement',
      variant: 'primary',
      disabled: true,
      disabledReason:
        blockedBy === 'employee'
          ? 'Waiting for the employee to acknowledge or appeal.'
          : blockedBy === 'manager'
            ? 'Waiting for the manager to acknowledge.'
            : 'No action required.',
    }
    return actions
  }

  if (action.status === 'APPEAL_PENDING_HR') {
    if (viewer.isHR || viewer.isSuperAdmin) {
      actions.primary = {
        id: 'disciplinary.appeal.hrForward',
        label: 'Review appeal (HR)',
        variant: 'primary',
        disabled: false,
      }
      return actions
    }

    actions.primary = {
      id: 'disciplinary.appeal.hrForward',
      label: 'Waiting for HR appeal review',
      variant: 'primary',
      disabled: true,
      disabledReason: 'HR must review the appeal before a final decision is made.',
    }
    return actions
  }

  if (action.status === 'APPEAL_PENDING_SUPER_ADMIN') {
    if (viewer.isSuperAdmin) {
      actions.primary = {
        id: 'disciplinary.appeal.adminDecide',
        label: 'Decide appeal (Super Admin)',
        variant: 'primary',
        disabled: false,
      }
      return actions
    }

    actions.primary = {
      id: 'disciplinary.appeal.adminDecide',
      label: 'Waiting for appeal decision',
      variant: 'primary',
      disabled: true,
      disabledReason: 'Super Admin must decide the appeal.',
    }
    return actions
  }

  return actions
}

function buildWorkflow(action: DisciplinaryWorkflowRecordInput): WorkflowRecordDTO['workflow'] {
  const isAppeal = ['APPEAL_PENDING_HR', 'APPEAL_PENDING_SUPER_ADMIN', 'APPEALED'].includes(action.status) || Boolean(action.appealedAt)

  if (isAppeal) {
    const order = ['appeal_submitted', 'appeal_hr', 'appeal_admin']
    const currentStageId =
      action.status === 'APPEAL_PENDING_SUPER_ADMIN'
        ? 'appeal_admin'
        : action.status === 'APPEAL_PENDING_HR' || action.status === 'APPEALED'
          ? 'appeal_hr'
          : 'appeal_submitted'

    return {
      currentStageId,
      currentStageLabel:
        currentStageId === 'appeal_hr'
          ? 'HR review'
          : currentStageId === 'appeal_admin'
            ? 'Final decision'
            : 'Appeal submitted',
      stages: [
        { id: 'appeal_submitted', label: 'Appeal submitted', status: stageStatus(order, currentStageId, 'appeal_submitted') },
        { id: 'appeal_hr', label: 'HR review', status: stageStatus(order, currentStageId, 'appeal_hr') },
        { id: 'appeal_admin', label: 'Final decision', status: stageStatus(order, currentStageId, 'appeal_admin') },
      ],
      statusBadge: { label: statusLabel(action.status), tone: toneForStatus(action.status) },
      severity: { label: action.severity.replaceAll('_', ' '), tone: severityTone(action.severity) },
      sla: computeSla(action),
    }
  }

  const order = ['raised', 'hr_review', 'admin', 'ack']
  const currentStageId =
    action.status === 'PENDING_SUPER_ADMIN'
      ? 'admin'
      : action.status === 'PENDING_ACKNOWLEDGMENT'
        ? 'ack'
        : action.status === 'PENDING_HR_REVIEW'
          ? 'hr_review'
          : 'raised'

  return {
    currentStageId,
    currentStageLabel:
      currentStageId === 'hr_review'
        ? 'HR review'
        : currentStageId === 'admin'
          ? 'Final approval'
          : currentStageId === 'ack'
            ? 'Acknowledgement'
            : 'Raised',
    stages: [
      { id: 'raised', label: 'Raised', status: stageStatus(order, currentStageId, 'raised') },
      { id: 'hr_review', label: 'HR review', status: stageStatus(order, currentStageId, 'hr_review') },
      { id: 'admin', label: 'Final approval', status: stageStatus(order, currentStageId, 'admin') },
      { id: 'ack', label: 'Acknowledgement', status: stageStatus(order, currentStageId, 'ack') },
    ],
    statusBadge: { label: statusLabel(action.status), tone: toneForStatus(action.status) },
    severity: { label: action.severity.replaceAll('_', ' '), tone: severityTone(action.severity) },
    sla: computeSla(action),
  }
}

export async function disciplinaryToWorkflowRecordDTO(action: DisciplinaryWorkflowRecordInput, viewer: ViewerContext & { canView: boolean }): Promise<WorkflowRecordDTO> {
  if (!viewer.canView) {
    return {
      identity: { title: 'Violation record', recordId: action.id, href: `/performance/disciplinary/${action.id}` },
      subject: { displayName: 'Restricted' },
      workflow: { currentStageId: 'raised', currentStageLabel: 'Raised', stages: [] },
      actions: { primary: null, secondary: [], more: [] },
      summary: [],
      timeline: [],
      access: { canView: false, noAccessReason: 'You do not have access to this record.' },
    }
  }

  const timeline = await timelineFromAudit({ entityType: 'DISCIPLINARY_ACTION', entityId: action.id })

  return {
    identity: {
      title: 'Violation record',
      recordId: action.id,
      href: `/performance/disciplinary/${action.id}`,
    },
    subject: {
      displayName: `${action.employee.firstName} ${action.employee.lastName}`.trim(),
      employeeId: action.employee.employeeId,
      subtitle: `${action.employee.position} • ${action.employee.department}`,
      avatarUrl: action.employee.avatar,
    },
    workflow: buildWorkflow(action),
    actions: buildActions(action, viewer),
    summary: [
      { label: 'Violation type', value: action.violationType.replaceAll('_', ' ') },
      { label: 'Reason', value: action.violationReason.replaceAll('_', ' ') },
      { label: 'Incident date', value: action.incidentDate.toLocaleDateString('en-US') },
      { label: 'Reported', value: action.reportedDate.toLocaleDateString('en-US') },
      { label: 'Action taken', value: action.actionTaken.replaceAll('_', ' ') },
      { label: 'Status', value: statusLabel(action.status) },
    ],
    timeline,
    access: { canView: true },
  }
}

