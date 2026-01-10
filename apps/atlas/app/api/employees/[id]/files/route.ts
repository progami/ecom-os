import { NextResponse } from 'next/server'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { isHROrAbove } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    if (!id || id.length > 100) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const actorId = await getCurrentEmployeeId()
    if (!actorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [isHR, baseEmployee] = await Promise.all([
      isHROrAbove(actorId),
      prisma.employee.findFirst({
        where: { OR: [{ id }, { employeeId: id }] },
        select: { id: true },
      }),
    ])

    if (!baseEmployee) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isSelf = actorId === baseEmployee.id
    if (!isHR && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const where = isSelf
      ? { employeeId: baseEmployee.id, visibility: 'EMPLOYEE_AND_HR' as const }
      : { employeeId: baseEmployee.id }

    const files = await prisma.employeeFile.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
      take: 200,
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    })

    const items = files.map((f) => ({
      id: f.id,
      title: f.title,
      fileName: f.fileName,
      contentType: f.contentType,
      size: f.size,
      visibility: f.visibility,
      uploadedAt: f.uploadedAt,
      uploadedBy: f.uploadedBy,
    }))

    return NextResponse.json({ items, total: items.length })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch employee files')
  }
}

