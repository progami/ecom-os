import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'

// GET /api/quarterly-reviews/pending - Pending reviews for current manager
export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const isHR = await isHROrAbove(currentEmployeeId)

    // Build where clause - include NOT_STARTED and IN_PROGRESS
    const where: Record<string, unknown> = {
      status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'DRAFT'] },
      quarterlyCycleId: { not: null },
    }

    // If viewing all (HR/Admin) or just own assigned reviews
    const viewAll = searchParams.get('all') === 'true' && isHR

    if (!viewAll) {
      // Show only reviews assigned to this manager at cron time (immutable)
      // OR reviews assigned to "HR" if they're HR
      if (isHR) {
        where.OR = [
          { assignedReviewerId: currentEmployeeId },
          { reviewerName: 'HR' },
        ]
      } else {
        // Regular manager - only see reviews assigned to them
        where.assignedReviewerId = currentEmployeeId
      }
    }

    const now = new Date()

    const reviews = await prisma.performanceReview.findMany({
      where,
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

    // Enrich with deadline info
    const enrichedReviews = reviews.map(review => {
      const deadline = review.deadline || review.quarterlyCycle?.deadline
      let daysUntilDeadline: number | null = null
      let isOverdue = false

      if (deadline) {
        daysUntilDeadline = Math.ceil(
          (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        isOverdue = daysUntilDeadline < 0
      }

      return {
        ...review,
        daysUntilDeadline,
        isOverdue,
        escalatedToHR: review.escalatedToHR,
      }
    })

    return NextResponse.json({
      items: enrichedReviews,
      total: enrichedReviews.length,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch pending quarterly reviews')
  }
}
