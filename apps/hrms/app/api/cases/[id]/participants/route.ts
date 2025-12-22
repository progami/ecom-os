import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

const CaseParticipantRoleEnum = z.enum([
  'SUBJECT',
  'REPORTER',
  'WITNESS',
  'ASSIGNEE',
  'HR',
  'LEGAL',
  'OTHER',
])

const CreateParticipantSchema = z.object({
  employeeId: z.string().min(1).max(100),
  role: CaseParticipantRoleEnum,
})

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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const validation = validateBody(CreateParticipantSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    const c = await prisma.case.findUnique({
      where: { id },
      select: { id: true, caseNumber: true, title: true, subjectEmployeeId: true, assignedToId: true },
    })

    if (!c) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (data.role === 'SUBJECT' && c.subjectEmployeeId && data.employeeId !== c.subjectEmployeeId) {
      return NextResponse.json({ error: 'SUBJECT participant must match case subject employee' }, { status: 400 })
    }

    if (data.role === 'ASSIGNEE' && c.assignedToId && data.employeeId !== c.assignedToId) {
      return NextResponse.json({ error: 'ASSIGNEE participant must match case assignee' }, { status: 400 })
    }

    const participant = await prisma.caseParticipant.upsert({
      where: { caseId_employeeId: { caseId: id, employeeId: data.employeeId } },
      create: {
        caseId: id,
        employeeId: data.employeeId,
        role: data.role,
      },
      update: {
        role: data.role,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    })

    await writeAuditLog({
      actorId,
      action: 'UPDATE',
      entityType: 'CASE',
      entityId: c.id,
      summary: `Updated participants for case #${c.caseNumber}`,
      metadata: {
        participantId: participant.id,
        employeeId: participant.employeeId,
        role: participant.role,
      },
      req,
    })

    return NextResponse.json(participant, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to add participant')
  }
}

