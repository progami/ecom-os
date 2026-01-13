import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentEmployeeId } from '@/lib/current-user'
import { z } from 'zod'
import { getSubtreeEmployeeIds, isHROrAbove, isManagerOf } from '@/lib/permissions'
import { calculateBusinessDaysUtc, parseDateOnlyToUtcNoon } from '@/lib/domain/leave/dates'

// Valid leave status values for filtering
const VALID_LEAVE_STATUSES = [
  'PENDING',
  'PENDING_MANAGER',
  'PENDING_HR',
  'PENDING_SUPER_ADMIN',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const

const CreateLeaveRequestSchema = z.object({
  employeeId: z.string().min(1).max(100),
  leaveType: z.enum(['PTO', 'MATERNITY', 'PATERNITY', 'PARENTAL', 'BEREAVEMENT_IMMEDIATE', 'BEREAVEMENT_EXTENDED', 'JURY_DUTY', 'UNPAID']),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start date' }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid end date' }),
  totalDays: z.number().min(0.5).max(365).optional(),
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

    const isHR = await isHROrAbove(currentEmployeeId)

    // Build where clause
    const where: any = {}

    // If specific employee requested
    if (employeeId) {
      // Check if current user can view this employee's leaves
      const isSelf = employeeId === currentEmployeeId
      if (!isSelf && !isHR) {
        const isManager = await isManagerOf(currentEmployeeId, employeeId)
        if (!isManager) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
      where.employeeId = employeeId
    } else {
      // If not HR, only show own leaves or direct reports
      if (!isHR) {
        const subtreeIds = await getSubtreeEmployeeIds(currentEmployeeId)
        where.employeeId = {
          in: [currentEmployeeId, ...subtreeIds],
        }
      }
    }

    // SECURITY FIX: Validate status parameter against allowed enum values
    if (status) {
      if (!VALID_LEAVE_STATUSES.includes(status as typeof VALID_LEAVE_STATUSES[number])) {
        return NextResponse.json(
          { error: `Invalid status value. Must be one of: ${VALID_LEAVE_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      where.status = status
    }

    if (startDate) {
      try {
        where.startDate = { gte: parseDateOnlyToUtcNoon(startDate) }
      } catch {
        // Ignore invalid date filter
      }
    }

    if (endDate) {
      try {
        where.endDate = { lte: parseDateOnlyToUtcNoon(endDate) }
      } catch {
        // Ignore invalid date filter
      }
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

    const { employeeId, leaveType, startDate, endDate, totalDays: providedTotalDays, reason } = validation.data

    const start = parseDateOnlyToUtcNoon(startDate)
    const end = parseDateOnlyToUtcNoon(endDate)
    const computedTotalDays = calculateBusinessDaysUtc(start, end)

    if (computedTotalDays <= 0) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    if (typeof providedTotalDays === 'number' && Math.abs(providedTotalDays - computedTotalDays) > 0.0001) {
      return NextResponse.json(
        { error: 'Total days does not match selected date range' },
        { status: 400 }
      )
    }

    const isHR = await isHROrAbove(currentEmployeeId)
    const isSelf = employeeId === currentEmployeeId

    // Only self (or HR) can create a leave request
    if (!isSelf && !isHR) {
      return NextResponse.json({ error: 'Cannot create leave for other employees' }, { status: 403 })
    }

    // Get the employee and their region
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, region: true, firstName: true, lastName: true, reportsToId: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Prevent overlapping pending/approved leave requests for the same employee
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: {
          in: [
            'PENDING',
            'PENDING_MANAGER',
            'PENDING_HR',
            'PENDING_SUPER_ADMIN',
            'APPROVED',
          ],
        },
        AND: [
          { startDate: { lte: end } },
          { endDate: { gte: start } },
        ],
      },
      select: { id: true },
    })

    if (overlapping) {
      return NextResponse.json(
        { error: 'Overlapping leave request already exists' },
        { status: 409 }
      )
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

    const skipBalanceCheck = leaveType === 'UNPAID' || leaveType === 'JURY_DUTY'

    // Check if enough balance
    const available = balance.allocated + balance.carriedOver - balance.used - balance.pending
    if (!skipBalanceCheck && computedTotalDays > available) {
      return NextResponse.json(
        { error: `Insufficient leave balance. Available: ${available} days, Requested: ${computedTotalDays} days` },
        { status: 400 }
      )
    }

    // Create the leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveType: leaveType as any,
        startDate: start,
        endDate: end,
        totalDays: computedTotalDays,
        reason,
        status: 'PENDING_MANAGER',
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
      data: { pending: { increment: computedTotalDays } },
    })

    // Notify the manager about the leave request
    if (employee.reportsToId) {
      const manager = await prisma.employee.findUnique({
        where: { id: employee.reportsToId },
        select: { id: true, email: true, firstName: true },
      })

      if (manager) {
        const startDateStr = start.toLocaleDateString()
        const endDateStr = end.toLocaleDateString()

        await prisma.notification.create({
          data: {
            type: 'LEAVE_REQUESTED',
            title: 'Leave Request Pending Approval',
            message: `${employee.firstName} ${employee.lastName} has requested ${leaveType.replace(/_/g, ' ')} leave from ${startDateStr} to ${endDateStr} (${computedTotalDays} days).`,
            link: `/leaves/${leaveRequest.id}`,
            employeeId: manager.id,
            relatedId: leaveRequest.id,
            relatedType: 'LEAVE',
          },
        })
      }
    }

    return NextResponse.json(leaveRequest, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create leave request')
  }
}
