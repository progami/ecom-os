import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { canRaiseViolation, getSubtreeEmployeeIds, isHROrAbove } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

const CaseTypeEnum = z.enum(['VIOLATION', 'GRIEVANCE', 'INVESTIGATION', 'INCIDENT', 'REQUEST', 'OTHER'])
const CaseStatusEnum = z.enum(['OPEN', 'IN_REVIEW', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'DISMISSED'])
const CaseSeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

const CreateCaseSchema = z.object({
  caseType: CaseTypeEnum,
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(10000).trim().optional().nullable(),
  severity: CaseSeverityEnum.optional(),
  subjectEmployeeId: z.string().min(1).max(100).optional().nullable(),
  assignedToId: z.string().min(1).max(100).optional().nullable(),
})

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const takeRaw = searchParams.get('take')
    const skipRaw = searchParams.get('skip')
    const q = searchParams.get('q')?.trim()
    const statusRaw = searchParams.get('status')
    const caseTypeRaw = searchParams.get('caseType')
    const assignedToId = searchParams.get('assignedToId')
    const subjectEmployeeId = searchParams.get('subjectEmployeeId')

    const take = Math.min(parseInt(takeRaw ?? '50', 10), 100)
    const skip = parseInt(skipRaw ?? '0', 10)

    const isHR = await isHROrAbove(actorId)

    const where: any = {}
    const and: any[] = []

    if (!isHR) {
      const subtreeIds = await getSubtreeEmployeeIds(actorId)
      const orConditions: any[] = [
        { createdById: actorId },
        { assignedToId: actorId },
        { subjectEmployeeId: actorId },
        { participants: { some: { employeeId: actorId } } },
      ]
      if (subtreeIds.length > 0) {
        orConditions.push({ subjectEmployeeId: { in: subtreeIds } })
      }
      and.push({ OR: orConditions })
    }

    if (q) {
      const searchOr: any[] = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]

      const asNumber = Number(q)
      if (!Number.isNaN(asNumber)) {
        searchOr.push({ caseNumber: asNumber })
      }

      and.push({ OR: searchOr })
    }

    if (and.length > 0) {
      where.AND = and
    }

    if (assignedToId) where.assignedToId = assignedToId
    if (subjectEmployeeId) where.subjectEmployeeId = subjectEmployeeId

    if (statusRaw) {
      const parsed = CaseStatusEnum.safeParse(statusRaw.toUpperCase())
      if (parsed.success) where.status = parsed.data
    }

    if (caseTypeRaw) {
      const parsed = CaseTypeEnum.safeParse(caseTypeRaw.toUpperCase())
      if (parsed.success) where.caseType = parsed.data
    }

    const [items, total] = await Promise.all([
      prisma.case.findMany({
        where,
        take,
        skip,
        orderBy: [{ updatedAt: 'desc' }],
        include: {
          subjectEmployee: { select: { id: true, firstName: true, lastName: true, avatar: true, employeeId: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          _count: { select: { notes: true, tasks: true, attachments: true } },
        },
      }),
      prisma.case.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch cases')
  }
}

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const actorId = await getCurrentEmployeeId()
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validation = validateBody(CreateCaseSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    const isHR = await isHROrAbove(actorId)

    if (!data.subjectEmployeeId && !isHR) {
      return NextResponse.json({ error: 'Only HR can create non-employee cases' }, { status: 403 })
    }

    if (data.subjectEmployeeId && !isHR) {
      const permissionCheck = await canRaiseViolation(actorId, data.subjectEmployeeId)
      if (!permissionCheck.allowed) {
        return NextResponse.json({ error: permissionCheck.reason ?? 'Forbidden' }, { status: 403 })
      }
    }

    if (data.assignedToId && !isHR && data.assignedToId !== actorId) {
      return NextResponse.json({ error: 'Only HR can assign cases to other employees' }, { status: 403 })
    }

    type ParticipantRole = 'SUBJECT' | 'ASSIGNEE' | 'REPORTER'
    const participants: { employeeId: string; role: ParticipantRole }[] = []

    if (data.subjectEmployeeId) {
      participants.push({ employeeId: data.subjectEmployeeId, role: 'SUBJECT' })
    }

    if (data.assignedToId) {
      if (!participants.some((p) => p.employeeId === data.assignedToId)) {
        participants.push({ employeeId: data.assignedToId, role: 'ASSIGNEE' })
      }
    }

    if (!participants.some((p) => p.employeeId === actorId)) {
      participants.push({ employeeId: actorId, role: 'REPORTER' })
    }

    const created = await prisma.case.create({
      data: {
        caseType: data.caseType,
        title: data.title,
        description: data.description ?? null,
        severity: data.severity ?? 'MEDIUM',
        status: 'OPEN',
        subjectEmployeeId: data.subjectEmployeeId ?? null,
        assignedToId: data.assignedToId ?? null,
        createdById: actorId,
        participants: {
          create: participants.map((p) => ({
            role: p.role,
            employee: { connect: { id: p.employeeId } },
          })),
        },
      },
      include: {
        subjectEmployee: { select: { id: true, firstName: true, lastName: true, avatar: true, employeeId: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        participants: { include: { employee: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
      },
    })

    await writeAuditLog({
      actorId,
      action: 'CREATE',
      entityType: 'CASE',
      entityId: created.id,
      summary: `Created case #${created.caseNumber}`,
      metadata: {
        caseNumber: created.caseNumber,
        caseType: created.caseType,
        subjectEmployeeId: created.subjectEmployeeId,
        assignedToId: created.assignedToId,
      },
      req,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create case')
  }
}
