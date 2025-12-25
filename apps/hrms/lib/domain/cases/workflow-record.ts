import type { Case } from '@ecom-os/prisma-hrms'
import type { WorkflowRecordDTO, WorkflowStageStatus, WorkflowTone } from '@/lib/contracts/workflow-record'
import { timelineFromAudit } from '@/lib/domain/workflow/timeline-from-audit'
import { toneForStatus } from '@/lib/domain/workflow/tone'

type CaseWorkflowRecordInput = Case & {
  subjectEmployee: { id: string; firstName: string; lastName: string; employeeId: string; avatar: string | null; department?: string | null; position?: string | null } | null
  assignedTo: { id: string; firstName: string; lastName: string; avatar: string | null } | null
}

type ViewerContext = {
  employeeId: string
  isHR: boolean
  isSuperAdmin: boolean
  canEdit: boolean
  canView: boolean
}

function stageStatus(order: string[], current: string, id: string): WorkflowStageStatus {
  if (current === id) return 'current'
  return order.indexOf(id) < order.indexOf(current) ? 'completed' : 'upcoming'
}

function severityTone(severity: string): WorkflowTone {
  switch (severity) {
    case 'CRITICAL':
      return 'danger'
    case 'HIGH':
      return 'warning'
    case 'MEDIUM':
      return 'info'
    case 'LOW':
    default:
      return 'neutral'
  }
}

function currentStageIdFromStatus(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'open'
    case 'IN_REVIEW':
    case 'ON_HOLD':
      return 'review'
    case 'RESOLVED':
      return 'resolved'
    case 'CLOSED':
    case 'DISMISSED':
      return 'closed'
    default:
      return 'open'
  }
}

export async function caseToWorkflowRecordDTO(c: CaseWorkflowRecordInput, viewer: ViewerContext): Promise<WorkflowRecordDTO> {
  if (!viewer.canView) {
    return {
      identity: { title: 'Case', recordId: c.id, href: `/cases/${c.id}` },
      subject: { displayName: 'Restricted' },
      workflow: { currentStageId: 'open', currentStageLabel: 'Open', stages: [] },
      actions: { primary: null, secondary: [], more: [] },
      summary: [],
      timeline: [],
      access: { canView: false, noAccessReason: 'You do not have access to this case.' },
    }
  }

  const currentStageId = currentStageIdFromStatus(c.status)
  const order = ['open', 'review', 'resolved', 'closed']

  const actions: WorkflowRecordDTO['actions'] = { primary: null, secondary: [], more: [] }
  if (viewer.canEdit) {
    actions.primary = { id: 'case.setStatus', label: 'Update status', variant: 'primary', disabled: false }
  } else {
    actions.primary = {
      id: 'case.setStatus',
      label: 'No action required',
      variant: 'primary',
      disabled: true,
      disabledReason: 'You do not have permission to update this case.',
    }
  }

  const timeline = await timelineFromAudit({ entityType: 'CASE', entityId: c.id })

  const subjectName = c.subjectEmployee ? `${c.subjectEmployee.firstName} ${c.subjectEmployee.lastName}`.trim() : 'No subject employee'

  return {
    identity: {
      title: `Case #${c.caseNumber} • ${c.title}`,
      recordId: c.id,
      href: `/cases/${c.id}`,
    },
    subject: {
      displayName: subjectName,
      employeeId: c.subjectEmployee?.employeeId,
      subtitle: c.subjectEmployee?.position && c.subjectEmployee?.department
        ? `${c.subjectEmployee.position} • ${c.subjectEmployee.department}`
        : undefined,
      avatarUrl: c.subjectEmployee?.avatar ?? null,
    },
    workflow: {
      currentStageId,
      currentStageLabel: currentStageId.charAt(0).toUpperCase() + currentStageId.slice(1),
      stages: [
        { id: 'open', label: 'Open', status: stageStatus(order, currentStageId, 'open') },
        { id: 'review', label: 'Review', status: stageStatus(order, currentStageId, 'review') },
        { id: 'resolved', label: 'Resolved', status: stageStatus(order, currentStageId, 'resolved') },
        { id: 'closed', label: 'Closed', status: stageStatus(order, currentStageId, 'closed') },
      ],
      statusBadge: { label: c.status.replaceAll('_', ' '), tone: toneForStatus(c.status) },
      severity: { label: c.severity, tone: severityTone(c.severity) },
      sla: { isOverdue: false, tone: 'none' },
    },
    actions,
    summary: [
      { label: 'Type', value: c.caseType.replaceAll('_', ' ') },
      { label: 'Severity', value: c.severity },
      { label: 'Status', value: c.status.replaceAll('_', ' ') },
      { label: 'Assignee', value: c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}`.trim() : '—' },
      { label: 'Opened', value: c.openedAt.toLocaleDateString('en-US') },
      { label: 'Closed', value: c.closedAt ? c.closedAt.toLocaleDateString('en-US') : '—' },
    ],
    timeline,
    access: { canView: true },
  }
}

