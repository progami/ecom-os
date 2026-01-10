import type { Policy } from '@ecom-os/prisma-atlas'
import type { WorkflowRecordDTO, WorkflowStageStatus } from '@/lib/contracts/workflow-record'
import { timelineFromAudit } from '@/lib/domain/workflow/timeline-from-audit'
import { toneForStatus } from '@/lib/domain/workflow/tone'
import { buildPolicyNextActions, type PolicyAckContext, type PolicyViewerContext } from './next-actions'

function stageStatus(order: string[], current: string, id: string): WorkflowStageStatus {
  if (current === id) return 'current'
  return order.indexOf(id) < order.indexOf(current) ? 'completed' : 'upcoming'
}

export async function policyToWorkflowRecordDTO(
  policy: Policy,
  _viewer: PolicyViewerContext,
  ack: PolicyAckContext
): Promise<WorkflowRecordDTO> {
  const order = ['published', 'ack']
  const currentStageId = ack.isAcknowledged ? 'ack' : 'published'

  const timeline = await timelineFromAudit({ entityType: 'POLICY', entityId: policy.id })
  const actions = buildPolicyNextActions(policy, ack)

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
