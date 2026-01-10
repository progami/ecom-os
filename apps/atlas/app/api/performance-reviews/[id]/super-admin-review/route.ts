import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse, validateBody } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isSuperAdmin } from '@/lib/permissions'
import { z } from 'zod'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Super Admin Review endpoint for performance reviews
 * 3-tier workflow: Manager creates -> HR reviews -> Super Admin approves -> Employee acknowledges
 */
const SuperAdminReviewBodySchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function POST(req: Request, context: RouteContext) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await context.params
    const body = await req.json()
    const validation = validateBody(SuperAdminReviewBodySchema, body)
    if (!validation.success) return validation.error

    const { approved, notes } = validation.data

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

    const recordLink = `/performance/reviews/${id}`

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
          link: recordLink,
          employeeId: updated.employee.id,
          relatedId: id,
          relatedType: 'REVIEW',
        },
      })

      await prisma.auditLog.create({
        data: {
          actorId: currentEmployeeId,
          action: 'APPROVE',
          entityType: 'PERFORMANCE_REVIEW',
          entityId: id,
          summary: 'Super Admin approved review',
          metadata: {
            fromStatus: review.status,
            toStatus: 'PENDING_ACKNOWLEDGMENT',
            note: notes ?? null,
          },
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          userAgent: req.headers.get('user-agent') ?? null,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Review approved by Super Admin, sent to employee for acknowledgment',
        review: updated,
      })
    } else {
      // Super Admin requests changes - self-loop on PENDING_SUPER_ADMIN
      const updated = await prisma.performanceReview.update({
        where: { id },
        data: {
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

      const targets = new Set<string>()
      if (review.assignedReviewerId) targets.add(review.assignedReviewerId)
      if (!targets.size && review.employee.reportsToId) targets.add(review.employee.reportsToId)
      if (review.hrReviewedById) targets.add(review.hrReviewedById)
      targets.delete(currentEmployeeId)

      await Promise.all(
        Array.from(targets).map((employeeId) =>
          prisma.notification.create({
            data: {
              type: 'REVIEW_REJECTED',
              title: 'Review Needs Changes (Final Approval)',
              message: `Super Admin requested changes to the performance review for ${updated.employee.firstName} ${updated.employee.lastName}.${notes ? ` Notes: ${notes}` : ''}`,
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
          summary: 'Super Admin requested changes',
          metadata: {
            note: notes ?? null,
          },
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          userAgent: req.headers.get('user-agent') ?? null,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Changes requested by Super Admin',
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

    const isAdmin = await isSuperAdmin(currentEmployeeId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    return NextResponse.json({
      canReview: review.status === 'PENDING_SUPER_ADMIN',
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
