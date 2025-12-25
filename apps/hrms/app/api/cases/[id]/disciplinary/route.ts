import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove, isManagerOf } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

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

    const [isHR, base] = await Promise.all([
      isHROrAbove(actorId),
      prisma.case.findUnique({
        where: { id },
        select: {
          id: true,
          caseType: true,
          createdById: true,
          assignedToId: true,
          subjectEmployeeId: true,
          participants: { select: { employeeId: true } },
        },
      }),
    ])

    if (!base) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const allowed =
      isHR ||
      base.createdById === actorId ||
      base.assignedToId === actorId ||
      base.subjectEmployeeId === actorId ||
      base.participants.some((p) => p.employeeId === actorId) ||
      (base.subjectEmployeeId ? await isManagerOf(actorId, base.subjectEmployeeId) : false)

    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (base.caseType !== 'VIOLATION') {
      return NextResponse.json({ disciplinaryActionId: null })
    }

    const disciplinary = await prisma.disciplinaryAction.findUnique({
      where: { caseId: id },
      select: { id: true },
    })

    return NextResponse.json({ disciplinaryActionId: disciplinary?.id ?? null })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch linked disciplinary action')
  }
}

