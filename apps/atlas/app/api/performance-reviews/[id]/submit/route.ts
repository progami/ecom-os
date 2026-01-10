import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canManageEmployee, getHREmployees } from '@/lib/permissions'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/performance-reviews/[id]/submit
 *
 * Manager submits a completed review (IN_PROGRESS → PENDING_HR_REVIEW)
 * Validates that all required fields are filled
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
        { error: 'You are not authorized to submit this review' },
        { status: 403 }
      )
    }

    // Check if review is in a submittable status
    const isInitialSubmit = ['IN_PROGRESS', 'DRAFT', 'NOT_STARTED'].includes(review.status)
    const isResubmitToHr = review.status === 'PENDING_HR_REVIEW' && review.hrApproved === false
    const isResubmitToAdmin = review.status === 'PENDING_SUPER_ADMIN' && review.superAdminApproved === false

    if (!isInitialSubmit && !isResubmitToHr && !isResubmitToAdmin) {
      return NextResponse.json(
        { error: `Cannot submit: review is in ${review.status} status` },
        { status: 400 }
      )
    }

    // Validate required fields are filled
    const validationErrors: string[] = []

    if (!review.overallRating || review.overallRating < 1 || review.overallRating > 10) {
      validationErrors.push('Overall rating must be between 1 and 10')
    }

    // For quarterly reviews, require category ratings
    if (review.reviewType === 'QUARTERLY') {
      if (!review.qualityOfWork || review.qualityOfWork < 1 || review.qualityOfWork > 10) {
        validationErrors.push('Quality of Work rating must be between 1 and 10')
      }
      if (!review.productivity || review.productivity < 1 || review.productivity > 10) {
        validationErrors.push('Productivity rating must be between 1 and 10')
      }
      if (!review.communication || review.communication < 1 || review.communication > 10) {
        validationErrors.push('Communication rating must be between 1 and 10')
      }
      if (!review.teamwork || review.teamwork < 1 || review.teamwork > 10) {
        validationErrors.push('Teamwork rating must be between 1 and 10')
      }
      if (!review.initiative || review.initiative < 1 || review.initiative > 10) {
        validationErrors.push('Initiative rating must be between 1 and 10')
      }
      if (!review.attendance || review.attendance < 1 || review.attendance > 10) {
        validationErrors.push('Attendance rating must be between 1 and 10')
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      )
    }

    // Transition to PENDING_HR_REVIEW (or re-submit to current stage)
    let startedAt = review.startedAt
    if (!startedAt) {
      startedAt = new Date()
    }

    const nextStatus = isInitialSubmit ? 'PENDING_HR_REVIEW' : review.status
    const updated = await prisma.performanceReview.update({
      where: { id },
      data: {
        submittedAt: new Date(),
        // If it wasn't started yet, set startedAt now
        startedAt,
        ...(nextStatus !== review.status ? { status: nextStatus } : {}),
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

    const recordLink = `/performance/reviews/${id}`

    if (isResubmitToAdmin) {
      const superAdmins = await prisma.employee.findMany({
        where: { isSuperAdmin: true, status: 'ACTIVE' },
        select: { id: true },
      })

      await Promise.all(
        superAdmins.map((admin) =>
          prisma.notification.create({
            data: {
              type: 'REVIEW_PENDING_ADMIN',
              title: 'Review Resubmitted',
              message: `${review.reviewerName} updated a review for ${updated.employee.firstName} ${updated.employee.lastName}. Please review again.`,
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
          action: 'SUBMIT',
          entityType: 'PERFORMANCE_REVIEW',
          entityId: id,
          summary: 'Manager resubmitted review for final approval',
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          userAgent: req.headers.get('user-agent') ?? null,
        },
      })
    } else {
      // Notify HR about new/updated review to process
      const hrEmployees = await getHREmployees()
      for (const hr of hrEmployees) {
        await prisma.notification.create({
          data: {
            type: 'REVIEW_PENDING_HR',
            title: isResubmitToHr ? 'Review Resubmitted' : 'Performance Review Submitted',
            message: `${review.reviewerName} has ${isResubmitToHr ? 'updated' : 'submitted'} a performance review for ${updated.employee.firstName} ${updated.employee.lastName}. Please review.`,
            link: recordLink,
            employeeId: hr.id,
            relatedId: id,
            relatedType: 'REVIEW',
          },
        })
      }

      await prisma.auditLog.create({
        data: {
          actorId: currentEmployeeId,
          action: 'SUBMIT',
          entityType: 'PERFORMANCE_REVIEW',
          entityId: id,
          summary: isResubmitToHr ? 'Manager resubmitted review to HR' : 'Manager submitted review to HR',
          metadata: isInitialSubmit
            ? {
                fromStatus: review.status,
                toStatus: nextStatus,
              }
            : undefined,
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          userAgent: req.headers.get('user-agent') ?? null,
        },
      })
    }

    console.log(`[Performance Review] Review ${id} submitted by ${currentEmployeeId} for ${review.employee.firstName} ${review.employee.lastName}`)

    return NextResponse.json({
      ...updated,
      message: 'Review submitted successfully',
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to submit performance review')
  }
}
