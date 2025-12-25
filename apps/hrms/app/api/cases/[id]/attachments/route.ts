import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove, isManagerOf } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

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

    const items = attachments
      .filter((a) => access.isHR || a.visibility !== 'INTERNAL_HR')
      .map((a) => ({
        id: a.id,
        caseId: a.caseId,
        uploadedById: a.uploadedById,
        title: a.title,
        fileName: a.fileName,
        contentType: a.contentType,
        size: a.size,
        visibility: a.visibility,
        createdAt: a.createdAt,
        uploadedBy: a.uploadedBy,
      }))

    return NextResponse.json({ items, total: items.length })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch case attachments')
  }
}
