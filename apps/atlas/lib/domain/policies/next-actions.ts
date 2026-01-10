import type { Policy } from '@ecom-os/prisma-atlas'
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record'

export type PolicyViewerContext = {
  employeeId: string
  isHR: boolean
  isSuperAdmin: boolean
}

export type PolicyAckContext = {
  isApplicable: boolean
  isAcknowledged: boolean
  acknowledgedAt?: Date | null
}

export function buildPolicyNextActions(policy: Policy, ack: PolicyAckContext): WorkflowRecordDTO['actions'] {
  const canAcknowledge = ack.isApplicable && !ack.isAcknowledged && policy.status === 'ACTIVE'
  const actions: WorkflowRecordDTO['actions'] = { primary: null, secondary: [], more: [] }

  if (canAcknowledge) {
    actions.primary = { id: 'policy.acknowledge', label: 'Acknowledge', variant: 'primary', disabled: false }
  } else if (!ack.isApplicable) {
    actions.primary = {
      id: 'policy.acknowledge',
      label: 'Not applicable',
      variant: 'primary',
      disabled: true,
      disabledReason: 'This policy does not apply to your region.',
    }
  } else if (ack.isAcknowledged) {
    actions.primary = {
      id: 'policy.acknowledge',
      label: 'Acknowledged',
      variant: 'primary',
      disabled: true,
      disabledReason: 'You have already acknowledged this policy.',
    }
  } else if (policy.status !== 'ACTIVE') {
    actions.primary = {
      id: 'policy.acknowledge',
      label: 'Not active',
      variant: 'primary',
      disabled: true,
      disabledReason: 'Only active policies require acknowledgement.',
    }
  }

  return actions
}

