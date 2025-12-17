import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { canManageEmployee, getHREmployees } from '@/lib/permissions'
import { updateCycleStats } from '@/lib/quarterly-review-automation'

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
    const submittableStatuses = ['IN_PROGRESS', 'DRAFT', 'NOT_STARTED']
    if (!submittableStatuses.includes(review.status)) {
      return NextResponse.json(
        { error: `Cannot submit: review is in ${review.status} status` },
        { status: 400 }
      )
    }

    // Validate required fields are filled
    const validationErrors: string[] = []

    if (!review.overallRating || review.overallRating < 1 || review.overallRating > 5) {
      validationErrors.push('Overall rating must be between 1 and 5')
    }

    // For quarterly reviews, require category ratings
    if (review.reviewType === 'QUARTERLY') {
      if (!review.qualityOfWork) validationErrors.push('Quality of Work rating is required')
      if (!review.productivity) validationErrors.push('Productivity rating is required')
      if (!review.communication) validationErrors.push('Communication rating is required')
      if (!review.teamwork) validationErrors.push('Teamwork rating is required')
      if (!review.initiative) validationErrors.push('Initiative rating is required')
      if (!review.attendance) validationErrors.push('Attendance rating is required')
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      )
    }

    // Transition to PENDING_HR_REVIEW
    const updated = await prisma.performanceReview.update({
      where: { id },
      data: {
        status: 'PENDING_HR_REVIEW',
        submittedAt: new Date(),
        // If it wasn't started yet, set startedAt now
        startedAt: review.startedAt || new Date(),
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

    // Update cycle stats if this is a quarterly review
    if (review.quarterlyCycleId) {
      await updateCycleStats(review.quarterlyCycleId)
    }

    // Notify HR about new review to process
    const hrEmployees = await getHREmployees()
    for (const hr of hrEmployees) {
      await prisma.notification.create({
        data: {
          type: 'REVIEW_PENDING_HR',
          title: 'Performance Review Submitted',
          message: `${review.reviewerName} has submitted a performance review for ${updated.employee.firstName} ${updated.employee.lastName}. Please review.`,
          link: `/performance/reviews/${id}`,
          employeeId: hr.id,
          relatedId: id,
          relatedType: 'REVIEW',
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
