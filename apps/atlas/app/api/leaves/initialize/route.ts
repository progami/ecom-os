import { NextResponse } from 'next/server'
import prisma from '../../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { isHROrAbove } from '@/lib/permissions'

/**
 * POST /api/leaves/initialize
 * Initialize leave balances for all employees based on their region's policies
 * Admin only - run after migration or when new employees are added
 */
export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    const isHR = await isHROrAbove(currentEmployeeId)
    if (!isHR) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const year = new Date().getFullYear()

    // Get all employees with their regions
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, region: true },
    })

    // Get all policies
    const policies = await prisma.leavePolicy.findMany()

    let created = 0
    let skipped = 0

    for (const employee of employees) {
      // Get policies for this employee's region
      const regionPolicies = policies.filter(p => p.region === employee.region)

      for (const policy of regionPolicies) {
        // Check if balance already exists
        const existing = await prisma.leaveBalance.findUnique({
          where: {
            employeeId_leaveType_year: {
              employeeId: employee.id,
              leaveType: policy.leaveType,
              year,
            },
          },
        })

        if (existing) {
          skipped++
          continue
        }

        // Create new balance
        await prisma.leaveBalance.create({
          data: {
            employeeId: employee.id,
            leaveType: policy.leaveType,
            year,
            allocated: policy.daysPerYear,
            used: 0,
            pending: 0,
            carriedOver: 0,
          },
        })
        created++
      }
    }

    return NextResponse.json({
      success: true,
      year,
      employeesProcessed: employees.length,
      balancesCreated: created,
      balancesSkipped: skipped,
    })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to initialize leave balances')
  }
}
