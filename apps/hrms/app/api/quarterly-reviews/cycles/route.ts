import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'

// GET /api/quarterly-reviews/cycles - List all cycles with stats (HR/Admin only)
export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has HR-level access
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: { isSuperAdmin: true, permissionLevel: true },
    })

    if (!currentEmployee?.isSuperAdmin && (currentEmployee?.permissionLevel ?? 0) < 50) {
      return NextResponse.json({ error: 'Forbidden - HR access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')?.toUpperCase()

    const where: Record<string, unknown> = {}
    if (status && ['ACTIVE', 'COMPLETED', 'CLOSED'].includes(status)) {
      where.status = status
    }

    const cycles = await prisma.quarterlyReviewCycle.findMany({
      where,
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
      include: {
        _count: {
          select: { reviews: true }
        }
      }
    })

    // Enrich with completion stats
    const enrichedCycles = await Promise.all(cycles.map(async (cycle) => {
      const [completed, pending, escalated] = await Promise.all([
        prisma.performanceReview.count({
          where: { quarterlyCycleId: cycle.id, status: { not: 'DRAFT' } }
        }),
        prisma.performanceReview.count({
          where: { quarterlyCycleId: cycle.id, status: 'DRAFT' }
        }),
        prisma.performanceReview.count({
          where: { quarterlyCycleId: cycle.id, escalatedToHR: true }
        }),
      ])

      return {
        ...cycle,
        stats: {
          total: cycle._count.reviews,
          completed,
          pending,
          escalated,
          completionRate: cycle._count.reviews > 0
            ? Math.round((completed / cycle._count.reviews) * 100)
            : 0
        }
      }
    }))

    return NextResponse.json({ items: enrichedCycles })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch quarterly review cycles')
  }
}
