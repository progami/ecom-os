import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { PaginationSchema, MAX_PAGINATION_LIMIT, LeaveTypeEnum } from '@/lib/validations'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)

    const paginationResult = PaginationSchema.safeParse({
      take: searchParams.get('take') || undefined,
      skip: searchParams.get('skip') || undefined,
    })

    const take = paginationResult.success ? paginationResult.data.take : 50
    const skip = paginationResult.success ? paginationResult.data.skip : 0

    const where: Record<string, unknown> = {}

    // Filter by employee
    const employeeId = searchParams.get('employeeId')
    if (employeeId) {
      where.employeeId = employeeId
    }

    // Filter by year
    const yearParam = searchParams.get('year')
    if (yearParam) {
      const year = parseInt(yearParam, 10)
      if (!isNaN(year)) {
        where.year = year
      }
    } else {
      // Default to current year
      where.year = new Date().getFullYear()
    }

    // Filter by leave type
    const leaveTypeParam = searchParams.get('leaveType')
    if (leaveTypeParam) {
      const leaveTypeValidation = LeaveTypeEnum.safeParse(leaveTypeParam.toUpperCase())
      if (leaveTypeValidation.success) {
        where.leaveType = leaveTypeValidation.data
      }
    }

    const [items, total] = await Promise.all([
      prisma.leaveBalance.findMany({
        where,
        take: Math.min(take, MAX_PAGINATION_LIMIT),
        skip,
        orderBy: [{ leaveType: 'asc' }],
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              region: true,
            },
          },
        },
      }),
      prisma.leaveBalance.count({ where }),
    ])

    // Add computed remaining field
    const itemsWithRemaining = items.map((item: typeof items[number]) => ({
      ...item,
      remaining: item.entitled + item.carryover + item.adjustment - item.used,
    }))

    return NextResponse.json({ items: itemsWithRemaining, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch leave balances')
  }
}
