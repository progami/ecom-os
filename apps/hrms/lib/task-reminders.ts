import { prisma } from '@/lib/prisma'
import { sendNotificationEmail } from '@/lib/email-service'

type TaskReminderResult = {
  dueSoonCreated: number
  overdueCreated: number
  emailsQueued: number
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export async function processTaskDueReminders(options?: {
  dueSoonDays?: number
  dedupeHours?: number
}): Promise<TaskReminderResult> {
  const dueSoonDays = options?.dueSoonDays ?? 2
  const dedupeHours = options?.dedupeHours ?? 20

  const now = new Date()
  const dueSoonEnd = new Date(now.getTime() + dueSoonDays * 24 * 60 * 60 * 1000)
  const since = new Date(now.getTime() - dedupeHours * 60 * 60 * 1000)

  const [dueSoonTasks, overdueTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        assignedToId: { not: null },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        dueDate: {
          gte: now,
          lte: dueSoonEnd,
        },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignedToId: true,
      },
      take: 200,
    }),
    prisma.task.findMany({
      where: {
        assignedToId: { not: null },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        dueDate: {
          lt: now,
        },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignedToId: true,
      },
      take: 200,
    }),
  ])

  const allTaskIds = Array.from(new Set([...dueSoonTasks, ...overdueTasks].map((t) => t.id)))
  if (allTaskIds.length === 0) {
    return { dueSoonCreated: 0, overdueCreated: 0, emailsQueued: 0 }
  }

  const existing = await prisma.notification.findMany({
    where: {
      createdAt: { gte: since },
      relatedType: 'TASK',
      relatedId: { in: allTaskIds },
      title: { in: ['Task due soon', 'Task overdue'] },
      employeeId: { not: null },
    },
    select: {
      employeeId: true,
      relatedId: true,
      title: true,
    },
  })

  const existingKeys = new Set(
    existing.map((n) => `${n.employeeId}:${n.relatedId}:${n.title}`)
  )

  const assigneeIds = Array.from(new Set([...dueSoonTasks, ...overdueTasks].map((t) => t.assignedToId!).filter(Boolean)))
  const assignees = await prisma.employee.findMany({
    where: { id: { in: assigneeIds } },
    select: { id: true, email: true, firstName: true },
  })
  const assigneeById = new Map(assignees.map((a) => [a.id, a]))

  let dueSoonCreated = 0
  let overdueCreated = 0
  let emailsQueued = 0

  for (const t of dueSoonTasks) {
    const assigneeId = t.assignedToId
    if (!assigneeId || !t.dueDate) continue

    const key = `${assigneeId}:${t.id}:Task due soon`
    if (existingKeys.has(key)) continue

    await prisma.notification.create({
      data: {
        type: 'SYSTEM',
        title: 'Task due soon',
        message: `“${t.title}” is due on ${formatDay(t.dueDate)}.`,
        link: `/tasks/${t.id}`,
        employeeId: assigneeId,
        relatedId: t.id,
        relatedType: 'TASK',
      },
    })
    dueSoonCreated += 1

    const assignee = assigneeById.get(assigneeId)
    if (assignee?.email) {
      await sendNotificationEmail(assignee.email, assignee.firstName, 'TASK_DUE_SOON', `/tasks/${t.id}`)
      emailsQueued += 1
    }
  }

  for (const t of overdueTasks) {
    const assigneeId = t.assignedToId
    if (!assigneeId || !t.dueDate) continue

    const key = `${assigneeId}:${t.id}:Task overdue`
    if (existingKeys.has(key)) continue

    await prisma.notification.create({
      data: {
        type: 'SYSTEM',
        title: 'Task overdue',
        message: `“${t.title}” was due on ${formatDay(t.dueDate)}.`,
        link: `/tasks/${t.id}`,
        employeeId: assigneeId,
        relatedId: t.id,
        relatedType: 'TASK',
      },
    })
    overdueCreated += 1

    const assignee = assigneeById.get(assigneeId)
    if (assignee?.email) {
      await sendNotificationEmail(assignee.email, assignee.firstName, 'TASK_OVERDUE', `/tasks/${t.id}`)
      emailsQueued += 1
    }
  }

  return { dueSoonCreated, overdueCreated, emailsQueued }
}

