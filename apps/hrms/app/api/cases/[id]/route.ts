import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove, isManagerOf } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'
import { getViewerContext } from '@/lib/domain/workflow/viewer'
import { caseToWorkflowRecordDTO } from '@/lib/domain/cases/workflow-record'

type RouteContext = { params: Promise<{ id: string }> }

const CaseStatusEnum = z.enum(['OPEN', 'IN_REVIEW', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'DISMISSED'])
const CaseSeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const CaseTypeEnum = z.enum(['VIOLATION', 'GRIEVANCE', 'INVESTIGATION', 'INCIDENT', 'REQUEST', 'OTHER'])
const CaseNoteVisibilityEnum = z.enum(['INTERNAL_HR', 'MANAGER_VISIBLE', 'EMPLOYEE_VISIBLE'])

const UpdateCaseSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(10000).trim().optional().nullable(),
  status: CaseStatusEnum.optional(),
  statusNote: z.string().max(10000).trim().optional().nullable(),
  severity: CaseSeverityEnum.optional(),
  caseType: CaseTypeEnum.optional(),
  assignedToId: z.string().min(1).max(100).optional().nullable(),
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
        status: true,
        closedAt: true,
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

export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format')
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

    if (format === 'workflow') {
      const viewer = await getViewerContext(actorId)
      const isCreator = access.base.createdById === actorId
      const isAssignee = access.base.assignedToId === actorId
      const canEdit = viewer.isHR || viewer.isSuperAdmin || isCreator || isAssignee

      const c = await prisma.case.findUnique({
        where: { id },
        include: {
          subjectEmployee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              avatar: true,
              department: true,
              position: true,
            },
          },
          assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      })

      if (!c) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const dto = await caseToWorkflowRecordDTO(c as any, {
        employeeId: actorId,
        isHR: viewer.isHR,
        isSuperAdmin: viewer.isSuperAdmin,
        canEdit,
        canView: true,
      })

      return NextResponse.json(dto)
    }

    const isCreator = access.base.createdById === actorId
    const isAssignee = access.base.assignedToId === actorId
    const isSubject = access.base.subjectEmployeeId === actorId
    const managerLike = access.isManager || isCreator || isAssignee

    let allowedVisibilities: z.infer<typeof CaseNoteVisibilityEnum>[] = ['EMPLOYEE_VISIBLE']
    if (access.isHR) {
      allowedVisibilities = ['INTERNAL_HR', 'MANAGER_VISIBLE', 'EMPLOYEE_VISIBLE']
    } else if (managerLike) {
      allowedVisibilities = ['MANAGER_VISIBLE', 'EMPLOYEE_VISIBLE']
    } else if (isSubject) {
      allowedVisibilities = ['EMPLOYEE_VISIBLE']
    }

    const includeNotes = access.isHR
      ? {
          include: {
            author: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
          orderBy: { createdAt: 'desc' as const },
        }
      : {
          where: { visibility: { in: allowedVisibilities } },
          include: {
            author: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
          orderBy: { createdAt: 'desc' as const },
        }

    const includeAttachments = access.isHR || managerLike
      ? {
          select: {
            id: true,
            caseId: true,
            uploadedById: true,
            title: true,
            fileName: true,
            contentType: true,
            size: true,
            visibility: true,
            createdAt: true,
            uploadedBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
          orderBy: { createdAt: 'desc' as const },
        }
      : null

    const c = await prisma.case.findUnique({
      where: { id },
      include: {
        subjectEmployee: { select: { id: true, firstName: true, lastName: true, avatar: true, employeeId: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        participants: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
          orderBy: { addedAt: 'asc' },
        },
        notes: includeNotes,
        ...(includeAttachments ? { attachments: includeAttachments } : {}),
        tasks: {
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
        },
      },
    })

    if (!c) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(c)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch case')
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

    const access = await getCaseAccess(id, actorId)
    if (!access.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!access.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isCreator = access.base.createdById === actorId
    const isAssignee = access.base.assignedToId === actorId
    const canUpdate = access.isHR || isCreator || isAssignee

    if (!canUpdate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const validation = validateBody(UpdateCaseSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    if (!access.isHR) {
      const nonHrFields = ['caseType', 'severity', 'assignedToId', 'title']
      const attempted = Object.keys(data)
      if (attempted.some((k) => nonHrFields.includes(k))) {
        return NextResponse.json({ error: 'Only HR can modify case type, severity, assignment, or title' }, { status: 403 })
      }
    }

    const closingStatuses = new Set(['RESOLVED', 'CLOSED', 'DISMISSED'])
    const statusChanged = data.status !== undefined && data.status !== access.base.status
    const isClosing = statusChanged && data.status !== undefined && closingStatuses.has(data.status)

    if (isClosing && !access.isHR) {
      return NextResponse.json({ error: 'Only HR can resolve, close, or dismiss cases' }, { status: 403 })
    }

    const statusNote = data.statusNote ? data.statusNote.trim() : null
    if (isClosing && !statusNote) {
      return NextResponse.json({ error: 'statusNote is required when resolving/closing/dismissing a case' }, { status: 400 })
    }

    const updates: any = {}
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.caseType !== undefined) updates.caseType = data.caseType
    if (data.severity !== undefined) updates.severity = data.severity
    if (data.assignedToId !== undefined) updates.assignedToId = data.assignedToId

    if (data.status !== undefined) {
      updates.status = data.status

      if (closingStatuses.has(data.status)) {
        if (!access.base.closedAt) {
          updates.closedAt = new Date()
        }
      } else {
        if (access.base.closedAt) {
          updates.closedAt = null
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.case.update({
        where: { id },
        data: updates,
      })

      if (statusChanged && statusNote) {
        await tx.caseNote.create({
          data: {
            caseId: id,
            authorId: actorId,
            visibility: access.isHR ? 'INTERNAL_HR' : 'MANAGER_VISIBLE',
            body: `Status changed to ${next.status}: ${statusNote}`,
          },
        })
      }

      return next
    })

    const isAssignmentChange = data.assignedToId !== undefined && data.assignedToId !== access.base.assignedToId
    const auditAction = isAssignmentChange ? 'ASSIGN' : isClosing ? 'COMPLETE' : 'UPDATE'
    const changed = new Set(Object.keys(updates))
    if (statusChanged && statusNote) changed.add('statusNote')

    await writeAuditLog({
      actorId,
      action: auditAction,
      entityType: 'CASE',
      entityId: updated.id,
      summary: `Updated case #${updated.caseNumber}`,
      metadata: {
        changed: Array.from(changed),
      },
      req,
    })

    return NextResponse.json(updated)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update case')
  }
}
