import { NextRequest, NextResponse } from 'next/server'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'
import { canViewEmployeeDirectory, getAuthorizedReporters, isHROrAbove } from '@/lib/permissions'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitError = withRateLimit(request)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: targetEmployeeId } = await params

    const [isHR, base] = await Promise.all([
      isHROrAbove(currentEmployeeId),
      prisma.employee.findFirst({
        where: { OR: [{ id: targetEmployeeId }, { employeeId: targetEmployeeId }] },
        select: { id: true, status: true },
      }),
    ])

    if (!base) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isSelf = currentEmployeeId === base.id
    if (!isHR && !isSelf && base.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const canView = await canViewEmployeeDirectory(currentEmployeeId, base.id)
    if (!canView) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const reporters = await getAuthorizedReporters(base.id)

    return NextResponse.json({
      items: reporters,
      total: reporters.length,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch authorized reporters')
  }
}
