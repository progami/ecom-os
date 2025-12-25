import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { getHREmployees, getSuperAdminEmployees } from '@/lib/permissions'
import { ChecklistLifecycleType, ChecklistOwnerType, TaskCategory } from '@/lib/hrms-prisma-types'

const SETTINGS_ID = 'singleton'

type TransactionCallback = Parameters<typeof prisma.$transaction>[0]
type TransactionClient = Parameters<TransactionCallback>[0]
type DbClient = typeof prisma | TransactionClient

function addDays(anchor: Date, days: number): Date {
  return new Date(anchor.getTime() + days * 86_400_000)
}

export async function getHrmsSettings(client: DbClient = prisma): Promise<{
  defaultHROwnerId: string | null
  defaultITOwnerId: string | null
}> {
  const row = await client.hrmsSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
    select: { defaultHROwnerId: true, defaultITOwnerId: true },
  })

  return {
    defaultHROwnerId: row.defaultHROwnerId ?? null,
    defaultITOwnerId: row.defaultITOwnerId ?? null,
  }
}

async function resolveFallbackOwnerIds(): Promise<{ hrOwnerId: string | null; itOwnerId: string | null }> {
  const [hrEmployees, superAdmins] = await Promise.all([getHREmployees(), getSuperAdminEmployees()])

  const hrOwnerId = hrEmployees[0]?.id ?? superAdmins[0]?.id ?? null
  const itOwnerId = superAdmins[0]?.id ?? hrEmployees[0]?.id ?? null

  return { hrOwnerId, itOwnerId }
}

async function resolveChecklistOwnerId(params: {
  ownerType: ChecklistOwnerType
  employee: { id: string; reportsToId: string | null }
  settings: { defaultHROwnerId: string | null; defaultITOwnerId: string | null }
}): Promise<string> {
  if (params.ownerType === 'EMPLOYEE') return params.employee.id

  if (params.ownerType === 'MANAGER') {
    if (params.employee.reportsToId) return params.employee.reportsToId
    // No manager configured; fall back to HR
  }

  const fallback = await resolveFallbackOwnerIds()

  if (params.ownerType === 'HR' || params.ownerType === 'MANAGER') {
    return params.settings.defaultHROwnerId ?? fallback.hrOwnerId ?? params.employee.id
  }

  // IT
  return params.settings.defaultITOwnerId ?? fallback.itOwnerId ?? params.employee.id
}

export type InstantiateChecklistInput = {
  employeeId: string
  lifecycleType: ChecklistLifecycleType
  actorId: string
  templateId?: string
  anchorDate?: Date
}

export async function instantiateChecklistForEmployee(input: InstantiateChecklistInput): Promise<{
  instanceId: string
  created: boolean
}> {
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, joinDate: true, reportsToId: true },
  })

  if (!employee) {
    throw new Error('Employee not found')
  }

  const resolvedAnchorDate = input.anchorDate ?? employee.joinDate
  const template = await prisma.checklistTemplate.findFirst({
    where: {
      id: input.templateId,
      lifecycleType: input.lifecycleType,
      isActive: true,
    },
    orderBy: { version: 'desc' },
    select: { id: true },
  })

  const fallbackTemplate = template
    ? null
    : await prisma.checklistTemplate.findFirst({
        where: { lifecycleType: input.lifecycleType, isActive: true },
        orderBy: { version: 'desc' },
        select: { id: true },
      })

  const templateId = template?.id ?? fallbackTemplate?.id
  if (!templateId) {
    throw new Error(`No active ${input.lifecycleType.toLowerCase()} checklist template configured.`)
  }

  const existing = await prisma.checklistInstance.findFirst({
    where: {
      employeeId: input.employeeId,
      lifecycleType: input.lifecycleType,
      templateId,
    },
    select: { id: true },
  })

  if (existing) {
    return { instanceId: existing.id, created: false }
  }

  const category: TaskCategory = input.lifecycleType === 'ONBOARDING' ? 'ONBOARDING' : 'OFFBOARDING'

  const created = await prisma.$transaction(async (tx) => {
    const [settings, fullTemplate] = await Promise.all([
      getHrmsSettings(tx),
      tx.checklistTemplate.findUnique({
        where: { id: templateId },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      }),
    ])

    if (!fullTemplate) {
      throw new Error('Checklist template not found')
    }

    const instance = await tx.checklistInstance.create({
      data: {
        templateId: fullTemplate.id,
        employeeId: input.employeeId,
        lifecycleType: input.lifecycleType,
        anchorDate: resolvedAnchorDate,
      },
      select: { id: true },
    })

    await writeAuditLog({
      actorId: input.actorId,
      action: 'CREATE',
      entityType: 'CHECKLIST_INSTANCE',
      entityId: instance.id,
      summary: `${input.lifecycleType === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'} checklist created`,
      metadata: {
        employeeId: input.employeeId,
        templateId: fullTemplate.id,
        lifecycleType: input.lifecycleType,
      },
      client: tx,
    })

    for (const item of fullTemplate.items) {
      const dueDate = addDays(resolvedAnchorDate, item.dueOffsetDays)

      // Dependencies: create blocked items without tasks until dependency is complete.
      if (item.dependsOnItemId) {
        await tx.checklistItemInstance.create({
          data: {
            instanceId: instance.id,
            templateItemId: item.id,
            status: 'BLOCKED',
            dueDate,
          },
        })
        continue
      }

      const ownerId = await resolveChecklistOwnerId({
        ownerType: item.ownerType,
        employee,
        settings,
      })

      const task = await tx.task.create({
        data: {
          title: item.title,
          description: item.description ?? null,
          category,
          dueDate,
          createdById: input.actorId,
          assignedToId: ownerId,
          subjectEmployeeId: input.employeeId,
        },
        select: { id: true, title: true },
      })

      if (ownerId && ownerId !== input.actorId) {
        await tx.notification.create({
          data: {
            type: 'SYSTEM',
            title: input.lifecycleType === 'ONBOARDING' ? 'New onboarding task assigned' : 'New offboarding task assigned',
            message: 'You have been assigned a new checklist task.',
            link: `/tasks/${task.id}`,
            employeeId: ownerId,
            relatedId: task.id,
            relatedType: 'TASK',
          },
        })
      }

      await writeAuditLog({
        actorId: input.actorId,
        action: 'CREATE',
        entityType: 'TASK',
        entityId: task.id,
        summary: `Created task "${task.title}"`,
        metadata: {
          source: 'CHECKLIST',
          checklistInstanceId: instance.id,
          checklistTemplateItemId: item.id,
        },
        client: tx,
      })

      await tx.checklistItemInstance.create({
        data: {
          instanceId: instance.id,
          templateItemId: item.id,
          status: 'OPEN',
          dueDate,
          taskId: task.id,
        },
      })
    }

    return instance
  })

  return { instanceId: created.id, created: true }
}

export async function syncChecklistFromTaskStatus(params: {
  taskId: string
  newStatus: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
  actorId: string
}): Promise<void> {
  if (params.newStatus !== 'DONE' && params.newStatus !== 'CANCELLED') return

  await prisma.$transaction(async (tx) => {
    const item = await tx.checklistItemInstance.findFirst({
      where: { taskId: params.taskId },
      include: {
        templateItem: true,
        instance: {
          select: {
            id: true,
            anchorDate: true,
            lifecycleType: true,
            employee: { select: { id: true, reportsToId: true } },
          },
        },
      },
    })

    if (!item) return

    const nextStatus = params.newStatus === 'DONE' ? 'DONE' : 'CANCELLED'
    const completedAt = params.newStatus === 'DONE' ? new Date() : null

    await tx.checklistItemInstance.update({
      where: { id: item.id },
      data: { status: nextStatus, completedAt },
    })

    await writeAuditLog({
      actorId: params.actorId,
      action: params.newStatus === 'DONE' ? 'COMPLETE' : 'UPDATE',
      entityType: 'CHECKLIST_ITEM_INSTANCE',
      entityId: item.id,
      summary: params.newStatus === 'DONE' ? 'Checklist item completed' : 'Checklist item cancelled',
      metadata: {
        checklistInstanceId: item.instanceId,
        taskId: params.taskId,
      },
      client: tx,
    })

    // Unblock dependent items (simple 1-level dependencies)
    if (params.newStatus !== 'DONE') return

    const dependentTemplateItems = await tx.checklistTemplateItem.findMany({
      where: {
        templateId: item.templateItem.templateId,
        dependsOnItemId: item.templateItemId,
      },
      orderBy: { sortOrder: 'asc' },
    })

    if (dependentTemplateItems.length === 0) return

    const blockedInstances = await tx.checklistItemInstance.findMany({
      where: {
        instanceId: item.instanceId,
        templateItemId: { in: dependentTemplateItems.map((t) => t.id) },
        status: 'BLOCKED',
      },
      include: { templateItem: true },
    })

    if (blockedInstances.length === 0) return

    const settings = await getHrmsSettings(tx)
    const category: TaskCategory = item.instance.lifecycleType === 'ONBOARDING' ? 'ONBOARDING' : 'OFFBOARDING'

    for (const blocked of blockedInstances) {
      const ownerId = await resolveChecklistOwnerId({
        ownerType: blocked.templateItem.ownerType,
        employee: item.instance.employee,
        settings,
      })

      const dueDate = addDays(item.instance.anchorDate, blocked.templateItem.dueOffsetDays)

      const task = await tx.task.create({
        data: {
          title: blocked.templateItem.title,
          description: blocked.templateItem.description ?? null,
          category,
          dueDate,
          createdById: params.actorId,
          assignedToId: ownerId,
          subjectEmployeeId: item.instance.employee.id,
        },
        select: { id: true, title: true },
      })

      if (ownerId && ownerId !== params.actorId) {
        await tx.notification.create({
          data: {
            type: 'SYSTEM',
            title: item.instance.lifecycleType === 'ONBOARDING' ? 'New onboarding task assigned' : 'New offboarding task assigned',
            message: 'A checklist item is now ready and has been assigned to you.',
            link: `/tasks/${task.id}`,
            employeeId: ownerId,
            relatedId: task.id,
            relatedType: 'TASK',
          },
        })
      }

      await tx.checklistItemInstance.update({
        where: { id: blocked.id },
        data: {
          status: 'OPEN',
          dueDate,
          taskId: task.id,
        },
      })

      await writeAuditLog({
        actorId: params.actorId,
        action: 'CREATE',
        entityType: 'TASK',
        entityId: task.id,
        summary: `Created task "${task.title}"`,
        metadata: {
          source: 'CHECKLIST',
          checklistInstanceId: item.instanceId,
          checklistTemplateItemId: blocked.templateItemId,
        },
        client: tx,
      })

      await writeAuditLog({
        actorId: params.actorId,
        action: 'UPDATE',
        entityType: 'CHECKLIST_ITEM_INSTANCE',
        entityId: blocked.id,
        summary: 'Checklist item unblocked',
        metadata: {
          checklistInstanceId: item.instanceId,
          dependsOnTemplateItemId: item.templateItemId,
          createdTaskId: task.id,
        },
        client: tx,
      })
    }
  })
}

export function computeChecklistProgress(statuses: Array<{ status: string }>): {
  total: number
  done: number
  open: number
  blocked: number
  percentDone: number
} {
  const total = statuses.length
  const done = statuses.filter((s) => s.status === 'DONE').length
  const open = statuses.filter((s) => s.status === 'OPEN' || s.status === 'IN_PROGRESS').length
  const blocked = statuses.filter((s) => s.status === 'BLOCKED').length
  const percentDone = total === 0 ? 0 : Math.round((done / total) * 100)
  return { total, done, open, blocked, percentDone }
}
