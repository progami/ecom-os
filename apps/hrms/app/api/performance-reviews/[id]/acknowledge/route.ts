import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { getHREmployees } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/performance-reviews/[id]/acknowledge
 *
 * Employee acknowledges their performance review
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
            reportsToId: true,
          },
        },
      },
    })

    if (!review) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Only the employee can acknowledge their own review
    if (currentEmployeeId !== review.employeeId) {
      return NextResponse.json(
        { error: 'You can only acknowledge your own performance review' },
        { status: 403 }
      )
    }

    // Check if review is in correct status
    if (review.status !== 'PENDING_ACKNOWLEDGMENT') {
      return NextResponse.json(
        { error: `Cannot acknowledge: review is in ${review.status} status, expected PENDING_ACKNOWLEDGMENT` },
        { status: 400 }
      )
    }

    // Check if already acknowledged
    if (review.acknowledgedAt) {
      return NextResponse.json({ error: 'Already acknowledged' }, { status: 400 })
    }

    // Update the review
    const updated = await prisma.performanceReview.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        status: 'COMPLETED',
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

    // Notify HR that employee acknowledged
    const hrEmployees = await getHREmployees()
    for (const hr of hrEmployees) {
      await prisma.notification.create({
        data: {
          type: 'REVIEW_ACKNOWLEDGED',
          title: 'Performance Review Acknowledged',
          message: `${updated.employee.firstName} ${updated.employee.lastName} has acknowledged their performance review.`,
          link: `/performance/reviews/${id}`,
          employeeId: hr.id,
          relatedId: id,
          relatedType: 'REVIEW',
        },
      })
    }

    // Notify manager
    if (review.employee.reportsToId) {
      await prisma.notification.create({
        data: {
          type: 'REVIEW_ACKNOWLEDGED',
          title: 'Performance Review Acknowledged',
          message: `${updated.employee.firstName} ${updated.employee.lastName} has acknowledged their performance review.`,
          link: `/performance/reviews/${id}`,
          employeeId: review.employee.reportsToId,
          relatedId: id,
          relatedType: 'REVIEW',
        },
      })
    }

    await writeAuditLog({
      actorId: currentEmployeeId,
      action: 'ACKNOWLEDGE',
      entityType: 'PERFORMANCE_REVIEW',
      entityId: id,
      summary: 'Acknowledged performance review',
      metadata: {
        employeeId: review.employeeId,
        newStatus: updated.status,
      },
      req,
    })

    return NextResponse.json({
      ...updated,
      message: 'Performance review acknowledged',
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to acknowledge performance review')
  }
}

/**
 * GET /api/performance-reviews/[id]/acknowledge
 *
 * Get acknowledgment status for a performance review
 */
export async function GET(req: Request, context: RouteContext) {
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

    const review = await prisma.performanceReview.findUnique({
      where: { id },
      select: {
        employeeId: true,
        status: true,
        acknowledgedAt: true,
      },
    })

    if (!review) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isEmployee = currentEmployeeId === review.employeeId
    const canAcknowledge = isEmployee &&
                          review.status === 'PENDING_ACKNOWLEDGMENT' &&
                          !review.acknowledgedAt

    return NextResponse.json({
      acknowledged: Boolean(review.acknowledgedAt),
      acknowledgedAt: review.acknowledgedAt,
      canAcknowledge,
      status: review.status,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to get acknowledgment status')
  }
}
