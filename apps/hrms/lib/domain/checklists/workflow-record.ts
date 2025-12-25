import { prisma } from '@/lib/prisma'
import { isManagerOf } from '@/lib/permissions'
import type { WorkflowRecordDTO, WorkflowTone, WorkflowStageStatus } from '@/lib/contracts/workflow-record'
import { computeChecklistProgress } from '@/lib/domain/checklists/checklist-service'

function tone(label: 'neutral' | 'info' | 'success' | 'warning' | 'danger'): WorkflowTone {
  return label
}

function stageStatus(currentStageId: string, stageId: string, order: string[]): WorkflowStageStatus {
  const currentIdx = order.indexOf(currentStageId)
  const idx = order.indexOf(stageId)
  if (idx < currentIdx) return 'completed'
  if (idx === currentIdx) return 'current'
  return 'upcoming'
}

function computeSla(items: Array<{ status: string; dueDate: Date | null }>): {
  dueAt?: string
  isOverdue: boolean
  overdueLabel?: string
  tone: 'none' | 'warning' | 'danger'
} | undefined {
  const open = items.filter((i) => i.status !== 'DONE' && i.status !== 'CANCELLED')
  const dueDates = open.map((i) => i.dueDate).filter(Boolean) as Date[]
  if (dueDates.length === 0) return undefined

  const earliest = dueDates.sort((a, b) => a.getTime() - b.getTime())[0]!
  const now = Date.now()
  const isOverdue = earliest.getTime() < now
  if (!isOverdue) {
    return { dueAt: earliest.toISOString(), isOverdue: false, tone: 'none' }
  }

  const overdueDays = Math.max(1, Math.floor((now - earliest.getTime()) / 86_400_000))
  return {
    dueAt: earliest.toISOString(),
    isOverdue: true,
    overdueLabel: `${overdueDays}d overdue`,
    tone: overdueDays >= 7 ? 'danger' : 'warning',
  }
}

export async function getChecklistWorkflowRecord(params: { id: string; viewer: { employeeId: string; isHR: boolean; isSuperAdmin: boolean } }): Promise<WorkflowRecordDTO> {
  const instance = await prisma.checklistInstance.findUnique({
    where: { id: params.id },
    include: {
      template: { select: { id: true, name: true, lifecycleType: true, version: true } },
      employee: {
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          department: true,
          position: true,
          reportsToId: true,
          avatar: true,
          employmentType: true,
        },
      },
      items: {
        select: {
          id: true,
          status: true,
          dueDate: true,
          completedAt: true,
          taskId: true,
          templateItem: { select: { title: true, ownerType: true, sortOrder: true, dependsOnItemId: true } },
        },
        orderBy: { templateItem: { sortOrder: 'asc' } },
      },
    },
  })

  if (!instance) {
    return {
      identity: { title: 'Checklist', recordId: params.id, href: `/checklists/${params.id}` },
      subject: { displayName: 'Unknown' },
      workflow: {
        currentStageId: 'unknown',
        currentStageLabel: 'Unknown',
        stages: [{ id: 'unknown', label: 'Unknown', status: 'current' }],
      },
      actions: { primary: null, secondary: [], more: [] },
      summary: [],
      timeline: [],
      access: { canView: false, noAccessReason: 'Checklist not found.' },
    }
  }

  const viewer = params.viewer
  const isSubject = viewer.employeeId === instance.employeeId
  const isDirectManager = instance.employee.reportsToId === viewer.employeeId
  const isManager = isDirectManager || (!viewer.isHR && !viewer.isSuperAdmin ? await isManagerOf(viewer.employeeId, instance.employeeId) : false)
  const canView = viewer.isHR || viewer.isSuperAdmin || isSubject || isManager

  if (!canView) {
    return {
      identity: {
        title: instance.template.lifecycleType === 'ONBOARDING' ? 'Onboarding checklist' : 'Offboarding checklist',
        recordId: instance.id,
        href: `/checklists/${instance.id}`,
      },
      subject: {
        displayName: `${instance.employee.firstName} ${instance.employee.lastName}`.trim(),
        employeeId: instance.employee.employeeId,
      },
      workflow: {
        currentStageId: 'restricted',
        currentStageLabel: 'Restricted',
        stages: [{ id: 'restricted', label: 'Restricted', status: 'current' }],
      },
      actions: { primary: null, secondary: [], more: [] },
      summary: [],
      timeline: [],
      access: { canView: false, noAccessReason: 'Only HR, the employee, or their manager can view this checklist.' },
    }
  }

  const progress = computeChecklistProgress(instance.items)
  const isComplete = progress.total > 0 && progress.done === progress.total

  const stageOrder = ['created', 'in_progress', 'completed'] as const
  const currentStageId = isComplete ? 'completed' : 'in_progress'

  const sla = computeSla(instance.items)

  const title = instance.template.lifecycleType === 'ONBOARDING' ? 'Onboarding checklist' : 'Offboarding checklist'
  const statusBadge = isComplete
    ? { label: 'Completed', tone: tone('success') }
    : progress.blocked > 0
      ? { label: 'Blocked', tone: tone('warning') }
      : { label: 'In progress', tone: tone('info') }

  const timeline = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: 'CHECKLIST_INSTANCE', entityId: instance.id },
        { entityType: 'CHECKLIST_ITEM_INSTANCE', metadata: { path: ['checklistInstanceId'], equals: instance.id } },
        { entityType: 'TASK', metadata: { path: ['checklistInstanceId'], equals: instance.id } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 75,
    include: { actor: { select: { firstName: true, lastName: true, avatar: true } } },
  })

  const timelineEntries = timeline.map((log) => ({
    id: log.id,
    at: log.createdAt.toISOString(),
    actor: log.actor
      ? { type: 'user' as const, name: `${log.actor.firstName} ${log.actor.lastName}`.trim(), avatarUrl: log.actor.avatar }
      : { type: 'system' as const, name: 'System' },
    event: log.summary ?? 'Updated',
  }))

  return {
    identity: {
      title,
      recordId: instance.id,
      href: `/checklists/${instance.id}`,
    },
    subject: {
      displayName: `${instance.employee.firstName} ${instance.employee.lastName}`.trim(),
      employeeId: instance.employee.employeeId,
      subtitle: `${instance.employee.department} • ${instance.employee.position}`,
      avatarUrl: instance.employee.avatar,
    },
    workflow: {
      currentStageId,
      currentStageLabel: currentStageId === 'completed' ? 'Completed' : 'In progress',
      stages: stageOrder.map((id) => ({
        id,
        label: id === 'created' ? 'Created' : id === 'in_progress' ? 'In progress' : 'Completed',
        status: stageStatus(currentStageId, id, [...stageOrder]),
      })),
      statusBadge,
      sla,
    },
    actions: {
      primary: null,
      secondary: [],
      more: [],
    },
    summary: [
      { label: 'Template', value: `${instance.template.name} (v${instance.template.version})` },
      { label: 'Progress', value: `${progress.done}/${progress.total} (${progress.percentDone}%)` },
      { label: 'Open', value: String(progress.open) },
      { label: 'Blocked', value: String(progress.blocked) },
      { label: 'Anchor date', value: instance.anchorDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) },
      { label: 'Created', value: instance.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) },
    ],
    timeline: timelineEntries,
    access: { canView: true },
  }
}

