import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove, isManagerOf } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

const CreateAttachmentSchema = z.object({
  title: z.string().max(200).trim().optional().nullable(),
  fileUrl: z.string().url().max(2000),
})

async function getCaseAccess(caseId: string, actorId: string) {
  const [isHR, base] = await Promise.all([
    isHROrAbove(actorId),
    prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        createdById: true,
        assignedToId: true,
        subjectEmployeeId: true,
        participants: { select: { employeeId: true } },
      },
    }),
  ])

  if (!base) return { exists: false, allowed: false, isHR, isManager: false, base: null as any }
  if (isHR) return { exists: true, allowed: true, isHR, isManager: false, base }

  if (base.createdById === actorId) return { exists: true, allowed: true, isHR, isManager: false, base }
  if (base.assignedToId === actorId) return { exists: true, allowed: true, isHR, isManager: false, base }

  const isParticipant = base.participants.some((p) => p.employeeId === actorId)
  if (isParticipant) return { exists: true, allowed: true, isHR, isManager: false, base }

  let isManager = false
  if (base.subjectEmployeeId) {
    isManager = await isManagerOf(actorId, base.subjectEmployeeId)
  }

  if (isManager) return { exists: true, allowed: true, isHR, isManager, base }

  return { exists: true, allowed: false, isHR, isManager: false, base }
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

    const access = await getCaseAccess(id, actorId)
    if (!access.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!access.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isCreator = access.base.createdById === actorId
    const isAssignee = access.base.assignedToId === actorId
    const managerLike = access.isHR || access.isManager || isCreator || isAssignee

    if (!managerLike) {
      return NextResponse.json({ items: [], total: 0 })
    }

    const attachments = await prisma.caseAttachment.findMany({
      where: { caseId: id },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ items: attachments, total: attachments.length })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch case attachments')
  }
}

export async function POST(req: Request, context: RouteContext) {
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
    if (!isHR) {
      return NextResponse.json({ error: 'Only HR can add attachments' }, { status: 403 })
    }

    const body = await req.json()
    const validation = validateBody(CreateAttachmentSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    const created = await prisma.caseAttachment.create({
      data: {
        caseId: id,
        uploadedById: actorId,
        title: data.title ?? null,
        fileUrl: data.fileUrl,
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    })

    await writeAuditLog({
      actorId,
      action: 'ATTACH',
      entityType: 'CASE_ATTACHMENT',
      entityId: created.id,
      summary: 'Added case attachment',
      metadata: {
        caseId: id,
        fileUrl: data.fileUrl,
      },
      req,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to add attachment')
  }
}

