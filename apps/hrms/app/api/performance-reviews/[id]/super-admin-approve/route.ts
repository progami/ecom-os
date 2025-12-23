import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canFinalApprove, getHREmployees } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Super Admin approval endpoint for performance reviews
 * Workflow: Manager creates -> HR reviews -> Super Admin approves (FINAL)
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

    const permissionCheck = await canFinalApprove(currentEmployeeId)
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
            email: true,
            reportsToId: true,
          },
        },
      },
    })

    if (!review) {
      return NextResponse.json({ error: 'Performance review not found' }, { status: 404 })
    }

    // Verify review is in correct state for Super Admin approval
    if (review.status !== 'PENDING_SUPER_ADMIN') {
      return NextResponse.json(
        { error: `Cannot approve: review is in ${review.status} status, expected PENDING_SUPER_ADMIN` },
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
              email: true,
            },
          },
        },
      })

      // Notify the employee about the review
      await prisma.notification.create({
        data: {
          type: 'REVIEW_APPROVED',
          title: 'Performance Review - Acknowledgment Required',
          message: `Your performance review is ready. Please review and acknowledge.`,
          link: `/performance/reviews/${id}`,
          employeeId: review.employee.id,
          relatedId: id,
          relatedType: 'REVIEW',
        },
      })

      await writeAuditLog({
        actorId: currentEmployeeId,
        action: 'APPROVE',
        entityType: 'PERFORMANCE_REVIEW',
        entityId: updated.id,
        summary: `Super Admin approved review for ${updated.employee.firstName} ${updated.employee.lastName}`,
        metadata: {
          notes: Boolean(notes),
          newStatus: updated.status,
        },
        req,
      })

      return NextResponse.json({
        success: true,
        message: 'Review approved by Super Admin, sent to employee for acknowledgment',
        review: updated,
      })
    } else {
      // Super Admin rejects - move back to DRAFT
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

      // Notify HR about rejection
      const hrEmployees = await getHREmployees()
      for (const hr of hrEmployees) {
        await prisma.notification.create({
          data: {
            type: 'REVIEW_REJECTED',
            title: 'Review Returned by Super Admin',
            message: `The performance review for ${updated.employee.firstName} ${updated.employee.lastName} has been returned by Super Admin.`,
            link: `/performance/reviews/${id}`,
            employeeId: hr.id,
            relatedId: id,
            relatedType: 'REVIEW',
          },
        })
      }

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

      await writeAuditLog({
        actorId: currentEmployeeId,
        action: 'REJECT',
        entityType: 'PERFORMANCE_REVIEW',
        entityId: updated.id,
        summary: `Super Admin returned review for ${updated.employee.firstName} ${updated.employee.lastName}`,
        metadata: {
          notes: Boolean(notes),
          newStatus: updated.status,
        },
        req,
      })

      return NextResponse.json({
        success: true,
        message: 'Review returned for revision',
        review: updated,
      })
    }
  } catch (e) {
    return safeErrorResponse(e, 'Failed to process Super Admin approval')
  }
}

/**
 * GET - Get Super Admin approval status for a performance review
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
      canApprove: review.status === 'PENDING_SUPER_ADMIN',
      superAdminApproval: {
        approvedAt: review.superAdminApprovedAt,
        approvedById: review.superAdminApprovedById,
        notes: review.superAdminNotes,
        approved: review.superAdminApproved,
      },
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to get Super Admin approval status')
  }
}
