import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove, isManagerOf } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

const TaskStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
const TaskCategoryEnum = z.enum(['GENERAL', 'ONBOARDING', 'OFFBOARDING', 'CASE', 'POLICY'])

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(5000).trim().optional().nullable(),
  status: TaskStatusEnum.optional(),
  category: TaskCategoryEnum.optional(),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid dueDate' }).optional().nullable(),
  assignedToId: z.string().min(1).max(100).optional().nullable(),
  subjectEmployeeId: z.string().min(1).max(100).optional().nullable(),
})

async function canAccessTask(taskId: string, actorId: string): Promise<{ allowed: boolean; isHR: boolean }> {
  const [task, isHR] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        createdById: true,
        assignedToId: true,
        subjectEmployeeId: true,
      },
    }),
    isHROrAbove(actorId),
  ])

  if (!task) return { allowed: false, isHR }
  if (isHR) return { allowed: true, isHR }
  if (task.createdById === actorId) return { allowed: true, isHR }
  if (task.assignedToId === actorId) return { allowed: true, isHR }
  if (task.subjectEmployeeId === actorId) return { allowed: true, isHR }
  return { allowed: false, isHR }
}

export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await canAccessTask(id, actorId)
    if (!access.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        subjectEmployee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        case: { select: { id: true, caseNumber: true, title: true } },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch task')
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await canAccessTask(id, actorId)
    if (!access.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const validation = validateBody(UpdateTaskSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    const existing = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        createdById: true,
        assignedToId: true,
        subjectEmployeeId: true,
        status: true,
        completedAt: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Only HR or the creator can reassign tasks / change subject employee.
    if (data.assignedToId !== undefined || data.subjectEmployeeId !== undefined) {
      if (!access.isHR && existing.createdById !== actorId) {
        return NextResponse.json({ error: 'Only HR or the task creator can change assignment' }, { status: 403 })
      }
    }

    if (data.assignedToId && data.assignedToId !== actorId && !access.isHR) {
      const canAssign = await isManagerOf(actorId, data.assignedToId)
      if (!canAssign) {
        return NextResponse.json({ error: 'Cannot assign tasks outside your reporting line' }, { status: 403 })
      }
    }

    if (data.subjectEmployeeId && data.subjectEmployeeId !== actorId && !access.isHR) {
      const canTarget = await isManagerOf(actorId, data.subjectEmployeeId)
      if (!canTarget) {
        return NextResponse.json({ error: 'Cannot set subject employee outside your reporting line' }, { status: 403 })
      }
    }

    const updates: any = {}
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.category !== undefined) updates.category = data.category
    if (data.dueDate !== undefined) updates.dueDate = data.dueDate ? new Date(data.dueDate) : null
    if (data.assignedToId !== undefined) updates.assignedToId = data.assignedToId
    if (data.subjectEmployeeId !== undefined) updates.subjectEmployeeId = data.subjectEmployeeId

    if (data.status !== undefined) {
      updates.status = data.status
      if (data.status === 'DONE') {
        if (!existing.completedAt) {
          updates.completedAt = new Date()
        }
      } else {
        if (existing.completedAt) {
          updates.completedAt = null
        }
      }
    }

    const updated = await prisma.task.update({
      where: { id },
      data: updates,
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        subjectEmployee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        case: { select: { id: true, caseNumber: true, title: true } },
      },
    })

    const assignmentChanged = data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId
    const action = data.status === 'DONE' && existing.status !== 'DONE'
      ? 'COMPLETE'
      : assignmentChanged
        ? 'ASSIGN'
        : 'UPDATE'
    await writeAuditLog({
      actorId,
      action,
      entityType: 'TASK',
      entityId: updated.id,
      summary: `Updated task "${updated.title}"`,
      metadata: {
        changed: Object.keys(updates),
      },
      req,
    })

    if (assignmentChanged && updated.assignedToId && updated.assignedToId !== actorId) {
      await prisma.notification.create({
        data: {
          type: 'SYSTEM',
          title: 'Task assignment updated',
          message: `You have been assigned: "${updated.title}".`,
          link: `/tasks/${updated.id}`,
          employeeId: updated.assignedToId,
          relatedId: updated.id,
          relatedType: 'TASK',
        },
      })
    }

    return NextResponse.json(updated)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update task')
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isHR = await isHROrAbove(actorId)

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, title: true, createdById: true },
    })

    if (!task) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!isHR && task.createdById !== actorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.task.delete({ where: { id } })

    await writeAuditLog({
      actorId,
      action: 'DELETE',
      entityType: 'TASK',
      entityId: id,
      summary: `Deleted task "${task.title}"`,
      req,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete task')
  }
}
