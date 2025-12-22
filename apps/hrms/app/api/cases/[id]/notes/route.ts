import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove, isManagerOf } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

const CaseNoteVisibilityEnum = z.enum(['INTERNAL_HR', 'MANAGER_VISIBLE', 'EMPLOYEE_VISIBLE'])
type CaseNoteVisibility = z.infer<typeof CaseNoteVisibilityEnum>

const CreateCaseNoteSchema = z.object({
  body: z.string().min(1).max(10000).trim(),
  visibility: CaseNoteVisibilityEnum.optional(),
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
  if (base.subjectEmployeeId === actorId) return { exists: true, allowed: true, isHR, isManager: false, base }

  const isParticipant = base.participants.some((p) => p.employeeId === actorId)
  if (isParticipant) return { exists: true, allowed: true, isHR, isManager: false, base }

  let isManager = false
  if (base.subjectEmployeeId) {
    isManager = await isManagerOf(actorId, base.subjectEmployeeId)
  }

  if (isManager) return { exists: true, allowed: true, isHR, isManager, base }

  return { exists: true, allowed: false, isHR, isManager: false, base }
}

function getAllowedVisibilities(access: {
  isHR: boolean
  isManager: boolean
  base: { createdById: string; assignedToId: string | null; subjectEmployeeId: string | null }
}, actorId: string): CaseNoteVisibility[] {
  if (access.isHR) return ['INTERNAL_HR', 'MANAGER_VISIBLE', 'EMPLOYEE_VISIBLE']

  const isCreator = access.base.createdById === actorId
  const isAssignee = access.base.assignedToId === actorId
  const managerLike = access.isManager || isCreator || isAssignee

  if (managerLike) return ['MANAGER_VISIBLE', 'EMPLOYEE_VISIBLE']
  return ['EMPLOYEE_VISIBLE']
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

    const allowed = getAllowedVisibilities(access, actorId)

    const notes = await prisma.caseNote.findMany({
      where: {
        caseId: id,
        visibility: { in: allowed },
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ items: notes, total: notes.length })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch case notes')
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

    const access = await getCaseAccess(id, actorId)
    if (!access.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!access.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const validation = validateBody(CreateCaseNoteSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    const allowed = getAllowedVisibilities(access, actorId)

    let visibility: z.infer<typeof CaseNoteVisibilityEnum>
    if (data.visibility) {
      visibility = data.visibility
    } else {
      visibility = allowed.includes('MANAGER_VISIBLE') ? 'MANAGER_VISIBLE' : 'EMPLOYEE_VISIBLE'
    }

    if (!allowed.includes(visibility)) {
      return NextResponse.json({ error: 'Forbidden visibility level' }, { status: 403 })
    }

    const created = await prisma.caseNote.create({
      data: {
        caseId: id,
        authorId: actorId,
        visibility,
        body: data.body,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    })

    await writeAuditLog({
      actorId,
      action: 'COMMENT',
      entityType: 'CASE_NOTE',
      entityId: created.id,
      summary: `Added note to case`,
      metadata: {
        caseId: id,
        visibility,
      },
      req,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to add case note')
  }
}
