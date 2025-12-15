import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId, getCurrentUser } from '@/lib/current-user'
import { z } from 'zod'

const CreateLeaveRequestSchema = z.object({
  employeeId: z.string().min(1).max(100),
  leaveType: z.enum(['PTO', 'MATERNITY', 'PATERNITY', 'PARENTAL', 'BEREAVEMENT_IMMEDIATE', 'BEREAVEMENT_EXTENDED', 'JURY_DUTY', 'UNPAID']),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start date' }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid end date' }),
  totalDays: z.number().min(0.5).max(365),
  reason: z.string().max(2000).optional(),
})

/**
 * GET /api/leaves
 * List leave requests with filters
 */
export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const take = Math.min(parseInt(searchParams.get('take') || '50', 10), 100)
    const skip = parseInt(searchParams.get('skip') || '0', 10)

    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user's permission level
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: { isSuperAdmin: true, permissionLevel: true },
    })

    // Build where clause
    const where: any = {}

    // If specific employee requested
    if (employeeId) {
      // Check if current user can view this employee's leaves
      const canView = currentEmployee?.isSuperAdmin ||
                     (currentEmployee?.permissionLevel ?? 0) >= 50 ||
                     employeeId === currentEmployeeId

      if (!canView) {
        // Check if manager of the employee
        const targetEmployee = await prisma.employee.findUnique({
          where: { id: employeeId },
          select: { reportsToId: true },
        })
        if (targetEmployee?.reportsToId !== currentEmployeeId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
      where.employeeId = employeeId
    } else {
      // If not super admin or HR, only show own leaves or direct reports
      if (!currentEmployee?.isSuperAdmin && (currentEmployee?.permissionLevel ?? 0) < 50) {
        const directReportIds = await prisma.employee.findMany({
          where: { reportsToId: currentEmployeeId },
          select: { id: true },
        })
        where.employeeId = {
          in: [currentEmployeeId, ...directReportIds.map(d => d.id)],
        }
      }
    }

    if (status) {
      where.status = status
    }

    if (startDate) {
      where.startDate = { gte: new Date(startDate) }
    }

    if (endDate) {
      where.endDate = { lte: new Date(endDate) }
    }

    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
              position: true,
              avatar: true,
              reportsToId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.leaveRequest.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch leave requests')
  }
}

/**
 * POST /api/leaves
 * Create a new leave request
 */
export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const currentEmployeeId = await getCurrentEmployeeId()
    if (!currentEmployeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validation = validateBody(CreateLeaveRequestSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { employeeId, leaveType, startDate, endDate, totalDays, reason } = validation.data

    // Check if current user can create leave for this employee
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: currentEmployeeId },
      select: { isSuperAdmin: true, permissionLevel: true },
    })

    const canCreate = currentEmployee?.isSuperAdmin ||
                     (currentEmployee?.permissionLevel ?? 0) >= 50 ||
                     employeeId === currentEmployeeId

    if (!canCreate) {
      return NextResponse.json({ error: 'Cannot create leave for other employees' }, { status: 403 })
    }

    // Get the employee and their region
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, region: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Check if leave type is valid for employee's region
    const policy = await prisma.leavePolicy.findUnique({
      where: {
        region_leaveType: {
          region: employee.region,
          leaveType: leaveType as any,
        },
      },
    })

    if (!policy) {
      return NextResponse.json(
        { error: `Leave type ${leaveType} is not available for your region` },
        { status: 400 }
      )
    }

    // Get or create current year balance
    const year = new Date().getFullYear()
    let balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveType_year: {
          employeeId,
          leaveType: leaveType as any,
          year,
        },
      },
    })

    if (!balance) {
      // Create balance based on policy
      balance = await prisma.leaveBalance.create({
        data: {
          employeeId,
          leaveType: leaveType as any,
          year,
          allocated: policy.daysPerYear,
          used: 0,
          pending: 0,
          carriedOver: 0,
        },
      })
    }

    // Check if enough balance
    const available = balance.allocated + balance.carriedOver - balance.used - balance.pending
    if (totalDays > available && leaveType !== 'UNPAID') {
      return NextResponse.json(
        { error: `Insufficient leave balance. Available: ${available} days, Requested: ${totalDays} days` },
        { status: 400 }
      )
    }

    // Create the leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveType: leaveType as any,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalDays,
        reason,
        status: 'PENDING',
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: true,
            position: true,
          },
        },
      },
    })

    // Update pending balance
    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { pending: { increment: Math.ceil(totalDays) } },
    })

    return NextResponse.json(leaveRequest, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create leave request')
  }
}
