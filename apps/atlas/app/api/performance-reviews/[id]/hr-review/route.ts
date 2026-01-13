import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse, validateBody } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canHRReview } from '@/lib/permissions'
import { z } from 'zod'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * HR Review endpoint for performance reviews
 * 3-tier workflow: Manager creates -> HR reviews -> Super Admin approves -> Employee acknowledges
 */
const HRReviewBodySchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function POST(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    const body = await req.json()
    const validation = validateBody(HRReviewBodySchema, body)
    if (!validation.success) return validation.error

    const { approved, notes } = validation.data

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

    // SECURITY FIX: Prevent HR from reviewing their own performance review
    if (review.employeeId === currentEmployeeId) {
      return NextResponse.json(
        { error: 'Cannot review your own performance review' },
        { status: 403 }
      )
    }

    // Verify review is in correct state for HR review
    if (review.status !== 'PENDING_HR_REVIEW') {
      return NextResponse.json(
        { error: `Cannot review: review is in ${review.status} status, expected PENDING_HR_REVIEW` },
        { status: 400 }
      )
    }

    const recordLink = `/performance/reviews/${id}`

    if (approved) {
      // HR approves - move to PENDING_SUPER_ADMIN for final approval
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

      // Notify Super Admins for final approval
      const superAdmins = await prisma.employee.findMany({
        where: { isSuperAdmin: true, status: 'ACTIVE' },
        select: { id: true },
      })

      await Promise.all(
        superAdmins.map((admin) =>
          prisma.notification.create({
            data: {
              type: 'REVIEW_PENDING_ADMIN',
              title: 'Review Pending Final Approval',
              message: `A performance review for ${updated.employee.firstName} ${updated.employee.lastName} has been approved by HR and requires your final approval.`,
              link: recordLink,
              employeeId: admin.id,
              relatedId: id,
              relatedType: 'REVIEW',
            },
          })
        )
      )

      await prisma.auditLog.create({
        data: {
          actorId: currentEmployeeId,
          action: 'APPROVE',
          entityType: 'PERFORMANCE_REVIEW',
          entityId: id,
          summary: 'HR approved review',
          metadata: {
            fromStatus: review.status,
            toStatus: 'PENDING_SUPER_ADMIN',
            note: notes ?? null,
          },
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          userAgent: req.headers.get('user-agent') ?? null,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Review approved by HR, sent to Super Admin for final approval',
        review: updated,
      })
    } else {
      // HR requests changes - self-loop on PENDING_HR_REVIEW
      const updated = await prisma.performanceReview.update({
        where: { id },
        data: {
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

      const targets = new Set<string>()
      if (review.assignedReviewerId) targets.add(review.assignedReviewerId)
      if (!targets.size && review.employee.reportsToId) targets.add(review.employee.reportsToId)
      targets.delete(currentEmployeeId)

      await Promise.all(
        Array.from(targets).map((employeeId) =>
          prisma.notification.create({
            data: {
              type: 'REVIEW_REJECTED',
              title: 'Review Needs Changes (HR)',
              message: `HR requested changes to the performance review for ${updated.employee.firstName} ${updated.employee.lastName}.${notes ? ` Notes: ${notes}` : ''}`,
              link: recordLink,
              employeeId,
              relatedId: id,
              relatedType: 'REVIEW',
            },
          })
        )
      )

      await prisma.auditLog.create({
        data: {
          actorId: currentEmployeeId,
          action: 'COMMENT',
          entityType: 'PERFORMANCE_REVIEW',
          entityId: id,
          summary: 'HR requested changes',
          metadata: {
            note: notes ?? null,
          },
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          userAgent: req.headers.get('user-agent') ?? null,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Changes requested by HR',
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
