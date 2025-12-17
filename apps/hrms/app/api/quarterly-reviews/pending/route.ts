import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'

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
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: {
        isSuperAdmin: true,
        permissionLevel: true,
        firstName: true,
        lastName: true,
      },
    })

    const isHROrAdmin = currentEmployee?.isSuperAdmin || (currentEmployee?.permissionLevel ?? 0) >= 50
    const reviewerName = `${currentEmployee?.firstName} ${currentEmployee?.lastName}`

    // Get direct reports for this manager
    const directReports = await prisma.employee.findMany({
      where: { reportsToId: currentEmployeeId },
      select: { id: true },
    })
    const directReportIds = directReports.map(r => r.id)

    // Build where clause
    const where: Record<string, unknown> = {
      status: 'DRAFT',
      quarterlyCycleId: { not: null },
    }

    // If viewing all (HR/Admin) or just own reports
    const viewAll = searchParams.get('all') === 'true' && isHROrAdmin

    if (!viewAll) {
      // Show only reviews where current user is the reviewer (their direct reports)
      // OR reviews assigned to "HR" if they're HR
      if (directReportIds.length > 0) {
        if (isHROrAdmin) {
          where.OR = [
            { employeeId: { in: directReportIds } },
            { reviewerName: 'HR' },
          ]
        } else {
          where.employeeId = { in: directReportIds }
        }
      } else if (isHROrAdmin) {
        // HR with no direct reports - show HR-assigned reviews
        where.reviewerName = 'HR'
      } else {
        // Manager with no direct reports
        return NextResponse.json({ items: [], total: 0 })
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
