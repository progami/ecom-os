import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isSuperAdmin } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Super Admin Review endpoint for performance reviews
 * 3-tier workflow: Manager creates -> HR reviews -> Super Admin approves -> Employee acknowledges
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

    // Check if current user is Super Admin
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await isSuperAdmin(currentEmployeeId)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Permission denied: Only Super Admin can give final approval' },
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

    // Verify review is in correct state for Super Admin review
    if (review.status !== 'PENDING_SUPER_ADMIN') {
      return NextResponse.json(
        { error: `Cannot review: review is in ${review.status} status, expected PENDING_SUPER_ADMIN` },
        { status: 400 }
      )
    }

    if (approved) {
      // Super Admin approves - move to PENDING_ACKNOWLEDGMENT
      const updated = await prisma.performanceReview.update({
        where: { id },
        data: {
          status: 'PENDING_ACKNOWLEDGMENT',
          superAdminApprovedAt: new Date(),
          superAdminApprovedById: currentEmployeeId,
          superAdminNotes: notes ?? null,
          superAdminApproved: true,
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

      // Notify employee to acknowledge
      await prisma.notification.create({
        data: {
          type: 'REVIEW_APPROVED',
          title: 'Performance Review Ready',
          message: `Your performance review is ready for acknowledgment.`,
          link: `/performance/reviews/${id}`,
          employeeId: updated.employee.id,
          relatedId: id,
          relatedType: 'REVIEW',
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Review approved by Super Admin, sent to employee for acknowledgment',
        review: updated,
      })
    } else {
      // Super Admin rejects - move back to DRAFT (manager can revise)
      const updated = await prisma.performanceReview.update({
        where: { id },
        data: {
          status: 'DRAFT',
          superAdminApprovedAt: new Date(),
          superAdminApprovedById: currentEmployeeId,
          superAdminNotes: notes ?? null,
          superAdminApproved: false,
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
            title: 'Review Returned by Super Admin',
            message: `The performance review for ${updated.employee.firstName} ${updated.employee.lastName} has been returned by Super Admin for revision.`,
            link: `/performance/reviews/${id}`,
            employeeId: review.employee.reportsToId,
            relatedId: id,
            relatedType: 'REVIEW',
          },
        })
      }

      // Notify HR who approved it
      if (review.hrReviewedById) {
        await prisma.notification.create({
          data: {
            type: 'REVIEW_REJECTED',
            title: 'Review Returned by Super Admin',
            message: `The performance review for ${updated.employee.firstName} ${updated.employee.lastName} that you approved has been returned by Super Admin for revision.`,
            link: `/performance/reviews/${id}`,
            employeeId: review.hrReviewedById,
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
    return safeErrorResponse(e, 'Failed to process Super Admin review')
  }
}

/**
 * GET - Get Super Admin review status for a performance review
 */
export async function GET(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const review = await prisma.performanceReview.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        superAdminApprovedAt: true,
        superAdminApprovedById: true,
        superAdminNotes: true,
        superAdminApproved: true,
      },
    })

    if (!review) {
      return NextResponse.json({ error: 'Performance review not found' }, { status: 404 })
    }

    const isAdmin = await isSuperAdmin(currentEmployeeId)

    return NextResponse.json({
      canReview: review.status === 'PENDING_SUPER_ADMIN' && isAdmin,
      superAdminReview: {
        approvedAt: review.superAdminApprovedAt,
        approvedById: review.superAdminApprovedById,
        notes: review.superAdminNotes,
        approved: review.superAdminApproved,
      },
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to get Super Admin review status')
  }
}
