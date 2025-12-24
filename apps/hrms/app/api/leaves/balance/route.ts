import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'

/**
 * GET /api/leaves/balance
 * Get leave balance for an employee
 *
 * Query params:
 * - employeeId: Employee to get balance for (defaults to current user)
 * - year: Year to get balance for (defaults to current year)
 */
export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)
    let employeeId = searchParams.get('employeeId')
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isHR = await isHROrAbove(currentEmployeeId)

    // Default to current employee
    if (!employeeId) {
      employeeId = currentEmployeeId
    }

    // Check access
    const isSelf = employeeId === currentEmployeeId

    if (!isSelf && !isHR) {
      // Check if manager
      const targetEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { reportsToId: true },
      })
      if (targetEmployee?.reportsToId !== currentEmployeeId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get employee with their region
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, region: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Get policies for this region
    const policies = await prisma.leavePolicy.findMany({
      where: { region: employee.region },
      orderBy: { leaveType: 'asc' },
    })

    // Get existing balances
    const existingBalances = await prisma.leaveBalance.findMany({
      where: { employeeId, year },
    })

    // Build balance response, creating missing balances as needed
    const balances = await Promise.all(
      policies.map(async (policy) => {
        let balance = existingBalances.find(b => b.leaveType === policy.leaveType)

        if (!balance) {
          // Create balance for this leave type
          balance = await prisma.leaveBalance.create({
            data: {
              employeeId,
              leaveType: policy.leaveType,
              year,
              allocated: policy.daysPerYear,
              used: 0,
              pending: 0,
              carriedOver: 0,
            },
          })
        }

        const available = balance.allocated + balance.carriedOver - balance.used - balance.pending

        return {
          leaveType: balance.leaveType,
          year: balance.year,
          allocated: balance.allocated,
          used: balance.used,
          pending: balance.pending,
          carriedOver: balance.carriedOver,
          available: Math.max(0, available),
          isPaid: policy.isPaid,
          description: policy.description,
        }
      })
    )

    return NextResponse.json({ balances })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch leave balance')
  }
}

/**
 * POST /api/leaves/balance
 * Initialize or adjust leave balance (admin only)
 */
export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isHR = await isHROrAbove(currentEmployeeId)
    if (!isHR) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await req.json()
    const { employeeId, leaveType, year, allocated, carriedOver } = body

    if (!employeeId || !leaveType) {
      return NextResponse.json({ error: 'employeeId and leaveType required' }, { status: 400 })
    }

    const targetYear = year || new Date().getFullYear()

    // Upsert the balance
    const balance = await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveType_year: {
          employeeId,
          leaveType,
          year: targetYear,
        },
      },
      update: {
        ...(allocated !== undefined && { allocated }),
        ...(carriedOver !== undefined && { carriedOver }),
      },
      create: {
        employeeId,
        leaveType,
        year: targetYear,
        allocated: allocated || 0,
        used: 0,
        pending: 0,
        carriedOver: carriedOver || 0,
      },
    })

    return NextResponse.json(balance)
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update leave balance')
  }
}
