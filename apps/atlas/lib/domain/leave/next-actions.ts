import type { LeaveRequest } from '@ecom-os/prisma-atlas'
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
  const pendingStatuses = ['PENDING', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_SUPER_ADMIN']
  const isPending = pendingStatuses.includes(leave.status)

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

  const canApproveReject = (() => {
    switch (leave.status) {
      case 'PENDING':
      case 'PENDING_MANAGER':
        return viewer.isHR || viewer.isSuperAdmin || isManager
      case 'PENDING_HR':
        return viewer.isHR
      case 'PENDING_SUPER_ADMIN':
        return viewer.isSuperAdmin
      default:
        return false
    }
  })()

  if (canApproveReject) {
    const label =
      leave.status === 'PENDING_HR'
        ? 'Approve (HR)'
        : leave.status === 'PENDING_SUPER_ADMIN'
          ? 'Final approve'
          : 'Approve'

    actions.primary = { id: 'leave.approve', label, variant: 'primary', disabled: false }
    actions.secondary = [{ id: 'leave.reject', label: 'Reject', variant: 'danger', disabled: false }]
    return actions
  }

  const waitingLabel =
    leave.status === 'PENDING_HR'
      ? 'Waiting for HR'
      : leave.status === 'PENDING_SUPER_ADMIN'
        ? 'Waiting for final approval'
        : 'Waiting for manager'

  const disabledReason =
    leave.status === 'PENDING_SUPER_ADMIN'
      ? 'Only Super Admin can give final approval.'
      : leave.status === 'PENDING_HR'
        ? 'Only HR can approve at this stage.'
        : 'Only the requester, their manager, or HR can act on this request.'

  actions.primary = {
    id: 'leave.approve',
    label: waitingLabel,
    variant: 'primary',
    disabled: true,
    disabledReason,
  }

  return actions
}
