import { NextResponse } from 'next/server'
import prisma from '../../../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { createQuarterlyReviewsForPeriod, getCurrentQuarter } from '@/lib/quarterly-review-automation'

// POST /api/quarterly-reviews/cycles/trigger - Manually trigger cycle creation (Super Admin only)
export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Super Admin
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: { isSuperAdmin: true },
    })

    if (!currentEmployee?.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden - Super Admin access required' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { year, quarter, force } = body

    // If year/quarter not provided, use previous quarter
    let targetYear = year
    let targetQuarter = quarter

    if (!targetYear || !targetQuarter) {
      const current = getCurrentQuarter()
      // Default to previous quarter
      if (current.quarter === 1) {
        targetYear = current.year - 1
        targetQuarter = 4
      } else {
        targetYear = current.year
        targetQuarter = current.quarter - 1
      }
    }

    // Validate quarter
    if (targetQuarter < 1 || targetQuarter > 4) {
      return NextResponse.json({ error: 'Invalid quarter - must be 1, 2, 3, or 4' }, { status: 400 })
    }

    const result = await createQuarterlyReviewsForPeriod(targetYear, targetQuarter, force === true)

    if (result.errors.length > 0 && !result.cycleCreated) {
      return NextResponse.json({
        error: result.errors[0],
        details: result.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: result.cycleCreated
        ? `Created Q${targetQuarter} ${targetYear} cycle with ${result.reviewsCreated} reviews`
        : 'Cycle already exists',
      ...result
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to trigger quarterly review cycle')
  }
}
