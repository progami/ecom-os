import type { Policy } from '@ecom-os/prisma-hrms'
import type { WorkflowRecordDTO, WorkflowStageStatus } from '@/lib/contracts/workflow-record'
import { timelineFromAudit } from '@/lib/domain/workflow/timeline-from-audit'
import { toneForStatus } from '@/lib/domain/workflow/tone'

type ViewerContext = {
  employeeId: string
  isHR: boolean
  isSuperAdmin: boolean
}

type PolicyAckContext = {
  isApplicable: boolean
  isAcknowledged: boolean
  acknowledgedAt?: Date | null
}

function stageStatus(order: string[], current: string, id: string): WorkflowStageStatus {
  if (current === id) return 'current'
  return order.indexOf(id) < order.indexOf(current) ? 'completed' : 'upcoming'
}

export async function policyToWorkflowRecordDTO(policy: Policy, viewer: ViewerContext, ack: PolicyAckContext): Promise<WorkflowRecordDTO> {
  const order = ['published', 'ack']
  const currentStageId = ack.isAcknowledged ? 'ack' : 'published'

  const timeline = await timelineFromAudit({ entityType: 'POLICY', entityId: policy.id })

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

  return {
    identity: {
      title: 'Policy',
      recordId: policy.id,
      href: `/policies/${policy.id}`,
    },
    subject: {
      displayName: policy.title,
      subtitle: `v${policy.version} • ${policy.category}`,
    },
    workflow: {
      currentStageId,
      currentStageLabel: currentStageId === 'ack' ? 'Acknowledged' : 'Published',
      stages: [
        { id: 'published', label: 'Published', status: stageStatus(order, currentStageId, 'published') },
        { id: 'ack', label: 'Acknowledged', status: stageStatus(order, currentStageId, 'ack') },
      ],
      statusBadge: { label: policy.status, tone: toneForStatus(policy.status) },
      sla: policy.effectiveDate
        ? { dueAt: policy.effectiveDate.toISOString(), isOverdue: false, tone: 'none' }
        : { isOverdue: false, tone: 'none' },
    },
    actions,
    summary: [
      { label: 'Category', value: policy.category },
      { label: 'Version', value: policy.version },
      { label: 'Region', value: policy.region },
      { label: 'Effective date', value: policy.effectiveDate ? policy.effectiveDate.toLocaleDateString('en-US') : '—' },
    ],
    timeline,
    access: { canView: true },
  }
}

