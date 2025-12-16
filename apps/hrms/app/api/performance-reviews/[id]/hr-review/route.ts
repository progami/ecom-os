import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canHRReview, getSuperAdminEmployees } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * HR Review endpoint for performance reviews
 * Workflow: Manager creates -> HR reviews -> Super Admin approves
 */
export async function POST(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    const body = await req.json()
    const { approved, notes } = body

    if (typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'approved field is required (boolean)' },
        { status: 400 }
      )
    }

    // Check if current user is HR
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissionCheck = await canHRReview(currentEmployeeId)
    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: `Permission denied: ${permissionCheck.reason}` },
        { status: 403 }
      )
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
      return NextResponse.json({ error: 'Performance review not found' }, { status: 404 })
    }

    // Verify review is in correct state for HR review
    if (review.status !== 'PENDING_HR_REVIEW') {
      return NextResponse.json(
        { error: `Cannot review: review is in ${review.status} status, expected PENDING_HR_REVIEW` },
        { status: 400 }
      )
    }

    if (approved) {
      // HR approves - move to PENDING_SUPER_ADMIN
      const updated = await prisma.performanceReview.update({
        where: { id },
        data: {
          status: 'PENDING_SUPER_ADMIN',
          hrReviewedAt: new Date(),
          hrReviewedById: currentEmployeeId,
          hrReviewNotes: notes ?? null,
          hrApproved: true,
        },
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

      // Notify Super Admins
      const superAdmins = await getSuperAdminEmployees()
      for (const admin of superAdmins) {
        await prisma.notification.create({
          data: {
            type: 'REVIEW_PENDING_ADMIN',
            title: 'Review Pending Final Approval',
            message: `A performance review for ${updated.employee.firstName} ${updated.employee.lastName} has been reviewed by HR and needs your final approval.`,
            link: `/performance/reviews/${id}`,
            employeeId: admin.id,
            relatedId: id,
            relatedType: 'REVIEW',
          },
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Review approved by HR, sent to Super Admin for final approval',
        review: updated,
      })
    } else {
      // HR rejects - move back to DRAFT (manager can revise)
      const updated = await prisma.performanceReview.update({
        where: { id },
        data: {
          status: 'DRAFT',
          hrReviewedAt: new Date(),
          hrReviewedById: currentEmployeeId,
          hrReviewNotes: notes ?? null,
          hrApproved: false,
        },
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

      // Notify the manager who created it
      if (review.employee.reportsToId) {
        await prisma.notification.create({
          data: {
            type: 'REVIEW_REJECTED',
            title: 'Review Returned by HR',
            message: `The performance review for ${updated.employee.firstName} ${updated.employee.lastName} has been returned by HR for revision.`,
            link: `/performance/reviews/${id}`,
            employeeId: review.employee.reportsToId,
            relatedId: id,
            relatedType: 'REVIEW',
          },
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Review returned to manager for revision',
        review: updated,
      })
    }
  } catch (e) {
    return safeErrorResponse(e, 'Failed to process HR review')
  }
}

/**
 * GET - Get HR review status for a performance review
 */
export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    const review = await prisma.performanceReview.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        hrReviewedAt: true,
        hrReviewedById: true,
        hrReviewNotes: true,
        hrApproved: true,
      },
    })

    if (!review) {
      return NextResponse.json({ error: 'Performance review not found' }, { status: 404 })
    }

    return NextResponse.json({
      canReview: review.status === 'PENDING_HR_REVIEW',
      hrReview: {
        reviewedAt: review.hrReviewedAt,
        reviewedById: review.hrReviewedById,
        notes: review.hrReviewNotes,
        approved: review.hrApproved,
      },
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to get HR review status')
  }
}
