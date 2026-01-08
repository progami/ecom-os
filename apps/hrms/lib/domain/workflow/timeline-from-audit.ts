import type { AuditAction, AuditEntityType } from '@ecom-os/prisma-hrms'
import { prisma } from '@/lib/prisma'
import type { WorkflowTimelineEntry } from '@/lib/contracts/workflow-record'

function actionToLabel(action: AuditAction): string {
  switch (action) {
    case 'CREATE':
      return 'Created'
    case 'UPDATE':
      return 'Updated'
    case 'DELETE':
      return 'Deleted'
    case 'SUBMIT':
      return 'Submitted'
    case 'APPROVE':
      return 'Approved'
    case 'REJECT':
      return 'Rejected'
    case 'ACKNOWLEDGE':
      return 'Acknowledged'
    case 'ASSIGN':
      return 'Assigned'
    case 'COMMENT':
      return 'Commented'
    case 'ATTACH':
      return 'Attachment added'
    case 'COMPLETE':
      return 'Completed'
    case 'EXPORT':
      return 'Exported'
    default:
      return action
  }
}

function entityToLabel(entityType: AuditEntityType): string {
  switch (entityType) {
    case 'LEAVE_REQUEST':
      return 'Leave request'
    case 'PERFORMANCE_REVIEW':
      return 'Performance review'
    case 'DISCIPLINARY_ACTION':
      return 'Violation'
    case 'POLICY':
      return 'Policy'
    case 'CASE':
      return 'Case'
    case 'TASK':
      return 'Task'
    default:
      return entityType.replaceAll('_', ' ').toLowerCase()
  }
}

export async function timelineFromAudit(params: {
  entityType: AuditEntityType
  entityId: string
  take?: number
}): Promise<WorkflowTimelineEntry[]> {
  const take = params.take ?? 50

  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: params.entityType,
      entityId: params.entityId,
    },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      actor: { select: { firstName: true, lastName: true, avatar: true } },
    },
  })

  return logs.map((log) => {
    const metadata = (log.metadata as any) ?? null
    const fromStatus = metadata?.previousStatus ?? metadata?.fromStatus
    const toStatus = metadata?.newStatus ?? metadata?.toStatus
    const note = typeof metadata?.note === 'string' && metadata.note.trim() ? metadata.note.trim() : undefined

    return {
      id: log.id,
      at: log.createdAt.toISOString(),
      actor: log.actor
        ? { type: 'user', name: `${log.actor.firstName} ${log.actor.lastName}`.trim(), avatarUrl: log.actor.avatar }
        : { type: 'system', name: 'System' },
      event: log.summary ?? `${actionToLabel(log.action)} ${entityToLabel(log.entityType)}`,
      note,
      transition: fromStatus && toStatus ? { from: String(fromStatus), to: String(toStatus) } : undefined,
    }
  })
}
