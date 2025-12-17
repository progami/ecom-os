import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canManageEmployee } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/performance-reviews/[id]/start
 *
 * Manager starts working on a review (NOT_STARTED → IN_PROGRESS)
 * This is called when manager first opens the review to fill it out
 */
export async function POST(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 })
    }

    // Get the performance review
    const review = await prisma.performanceReview.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!review) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Check permission - must be the assigned reviewer or have permission to manage the employee
    const isAssignedReviewer = review.assignedReviewerId === currentEmployeeId
    const permissionCheck = await canManageEmployee(currentEmployeeId, review.employeeId)

    if (!isAssignedReviewer && !permissionCheck.canManage) {
      return NextResponse.json(
        { error: 'You are not authorized to start this review' },
        { status: 403 }
      )
    }

    // Check if review is in NOT_STARTED status
    if (review.status !== 'NOT_STARTED') {
      // If already started, just return success (idempotent)
      if (review.status === 'IN_PROGRESS' || review.status === 'DRAFT') {
        return NextResponse.json({
          ...review,
          message: 'Review already in progress',
        })
      }
      return NextResponse.json(
        { error: `Cannot start: review is in ${review.status} status` },
        { status: 400 }
      )
    }

    // Transition to IN_PROGRESS
    const updated = await prisma.performanceReview.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            position: true,
          },
        },
      },
    })

    console.log(`[Performance Review] Review ${id} started by ${currentEmployeeId} for ${review.employee.firstName} ${review.employee.lastName}`)

    return NextResponse.json({
      ...updated,
      message: 'Review started successfully',
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to start performance review')
  }
}
