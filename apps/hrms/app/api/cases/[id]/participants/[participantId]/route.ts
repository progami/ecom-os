import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string; participantId: string }> }

const CaseParticipantRoleEnum = z.enum([
  'SUBJECT',
  'REPORTER',
  'WITNESS',
  'ASSIGNEE',
  'HR',
  'LEGAL',
  'OTHER',
])

const UpdateParticipantSchema = z.object({
  role: CaseParticipantRoleEnum,
})

export async function PATCH(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id, participantId } = await context.params
    if (!id || id.length > 100 || !participantId || participantId.length > 100) {
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
    const validation = validateBody(UpdateParticipantSchema, body)
    if (!validation.success) return validation.error

    const data = validation.data

    const participant = await prisma.caseParticipant.findUnique({
      where: { id: participantId },
      select: { id: true, caseId: true, employeeId: true, role: true },
    })

    if (!participant || participant.caseId !== id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const c = await prisma.case.findUnique({
      where: { id },
      select: { id: true, caseNumber: true, subjectEmployeeId: true, assignedToId: true },
    })
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (data.role === 'SUBJECT' && c.subjectEmployeeId && participant.employeeId !== c.subjectEmployeeId) {
      return NextResponse.json({ error: 'SUBJECT participant must match case subject employee' }, { status: 400 })
    }

    if (data.role === 'ASSIGNEE' && c.assignedToId && participant.employeeId !== c.assignedToId) {
      return NextResponse.json({ error: 'ASSIGNEE participant must match case assignee' }, { status: 400 })
    }

    const updated = await prisma.caseParticipant.update({
      where: { id: participantId },
      data: { role: data.role },
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
        participantId: updated.id,
        employeeId: updated.employeeId,
        role: updated.role,
      },
      req,
    })

    return NextResponse.json(updated)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update participant')
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id, participantId } = await context.params
    if (!id || id.length > 100 || !participantId || participantId.length > 100) {
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

    const participant = await prisma.caseParticipant.findUnique({
      where: { id: participantId },
      select: { id: true, caseId: true, employeeId: true, role: true },
    })

    if (!participant || participant.caseId !== id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (participant.role === 'SUBJECT' || participant.role === 'ASSIGNEE') {
      return NextResponse.json({ error: 'Cannot remove subject or assignee participant' }, { status: 400 })
    }

    const c = await prisma.case.findUnique({
      where: { id },
      select: { id: true, caseNumber: true },
    })
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.caseParticipant.delete({ where: { id: participantId } })

    await writeAuditLog({
      actorId,
      action: 'UPDATE',
      entityType: 'CASE',
      entityId: c.id,
      summary: `Updated participants for case #${c.caseNumber}`,
      metadata: {
        participantId,
        employeeId: participant.employeeId,
        removed: true,
      },
      req,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to remove participant')
  }
}

