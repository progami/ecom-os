import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { UpdatePerformanceReviewSchema } from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canManageEmployee } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const item = await prisma.performanceReview.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            position: true,
            email: true,
          },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Fetch assigned reviewer details if exists
    let assignedReviewer = null
    if (item.assignedReviewerId) {
      assignedReviewer = await prisma.employee.findUnique({
        where: { id: item.assignedReviewerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
        },
      })
    }

    return NextResponse.json({ ...item, assignedReviewer })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch performance review')
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

    // Check if current user has permission to manage this employee
    const existing = await prisma.performanceReview.findUnique({
      where: { id },
      select: { employeeId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 })
    }

    const permissionCheck = await canManageEmployee(currentEmployeeId, existing.employeeId)
    if (!permissionCheck.canManage) {
      return NextResponse.json(
        { error: `Permission denied: ${permissionCheck.reason}` },
        { status: 403 }
      )
    }

    const body = await req.json()

    const validation = validateBody(UpdatePerformanceReviewSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data
    const updates: Record<string, unknown> = {}

    if (data.reviewType !== undefined) updates.reviewType = data.reviewType
    if (data.reviewPeriod !== undefined) updates.reviewPeriod = data.reviewPeriod
    if (data.reviewDate !== undefined) updates.reviewDate = new Date(data.reviewDate)
    // reviewerName is derived from assignedReviewerId - not editable
    if (data.overallRating !== undefined) updates.overallRating = data.overallRating
    if (data.qualityOfWork !== undefined) updates.qualityOfWork = data.qualityOfWork
    if (data.productivity !== undefined) updates.productivity = data.productivity
    if (data.communication !== undefined) updates.communication = data.communication
    if (data.teamwork !== undefined) updates.teamwork = data.teamwork
    if (data.initiative !== undefined) updates.initiative = data.initiative
    if (data.attendance !== undefined) updates.attendance = data.attendance
    if (data.strengths !== undefined) updates.strengths = data.strengths
    if (data.areasToImprove !== undefined) updates.areasToImprove = data.areasToImprove
    if (data.goals !== undefined) updates.goals = data.goals
    if (data.comments !== undefined) updates.comments = data.comments
    if (data.status !== undefined) updates.status = data.status

    const item = await prisma.performanceReview.update({
      where: { id },
      data: updates,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    })

    return NextResponse.json(item)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update performance review')
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // Check if current user has permission to manage this employee
    const existing = await prisma.performanceReview.findUnique({
      where: { id },
      select: { employeeId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 })
    }

    const permissionCheck = await canManageEmployee(currentEmployeeId, existing.employeeId)
    if (!permissionCheck.canManage) {
      return NextResponse.json(
        { error: `Permission denied: ${permissionCheck.reason}` },
        { status: 403 }
      )
    }

    await prisma.performanceReview.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to delete performance review')
  }
}
