import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'

// GET /api/quarterly-reviews/overdue - Escalated reviews for HR
export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has HR-level access
    const isHR = await isHROrAbove(currentEmployeeId)
    if (!isHR) {
      return NextResponse.json({ error: 'Forbidden - HR access required' }, { status: 403 })
    }

    const now = new Date()

    // Get all escalated or overdue reviews
    const reviews = await prisma.performanceReview.findMany({
      where: {
        status: 'DRAFT',
        quarterlyCycleId: { not: null },
        OR: [
          { escalatedToHR: true },
          { deadline: { lt: now } },
        ],
      },
      orderBy: { deadline: 'asc' },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            position: true,
            department: true,
            avatar: true,
            manager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        quarterlyCycle: {
          select: {
            id: true,
            reviewPeriod: true,
            deadline: true,
          },
        },
      },
    })

    // Enrich with overdue info
    const enrichedReviews = reviews.map(review => {
      const deadline = review.deadline || review.quarterlyCycle?.deadline
      let daysOverdue = 0

      if (deadline) {
        daysOverdue = Math.max(0, Math.ceil(
          (now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)
        ))
      }

      return {
        ...review,
        daysOverdue,
        responsibleManager: review.employee.manager
          ? `${review.employee.manager.firstName} ${review.employee.manager.lastName}`
          : review.reviewerName,
      }
    })

    return NextResponse.json({
      items: enrichedReviews,
      total: enrichedReviews.length,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch overdue quarterly reviews')
  }
}
