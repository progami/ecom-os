import type { LeaveRequest } from '@ecom-os/prisma-hrms'
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record'

export type LeaveWorkflowRecordInput = LeaveRequest & {
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

export type LeaveViewerContext = {
  employeeId: string
  isHR: boolean
  isSuperAdmin: boolean
}

export function buildLeaveNextActions(leave: LeaveWorkflowRecordInput, viewer: LeaveViewerContext): WorkflowRecordDTO['actions'] {
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

