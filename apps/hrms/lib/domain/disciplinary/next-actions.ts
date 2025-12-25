import type { DisciplinaryAction } from '@ecom-os/prisma-hrms'
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record'

export type DisciplinaryWorkflowRecordInput = DisciplinaryAction & {
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

export type DisciplinaryViewerContext = {
  employeeId: string
  isHR: boolean
  isSuperAdmin: boolean
  canActAsManager: boolean
}

export function buildDisciplinaryNextActions(
  action: DisciplinaryWorkflowRecordInput,
  viewer: DisciplinaryViewerContext
): WorkflowRecordDTO['actions'] {
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
      actions.secondary = [{ id: 'disciplinary.hrReject', label: 'Reject', variant: 'danger', disabled: false }]
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
      actions.secondary = [{ id: 'disciplinary.adminReject', label: 'Reject', variant: 'danger', disabled: false }]
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
      actions.secondary = [{ id: 'disciplinary.appeal', label: 'Appeal', variant: 'secondary', disabled: false }]
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

