import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import {
  CreateLeaveRequestSchema,
  PaginationSchema,
  MAX_PAGINATION_LIMIT,
  LeaveRequestStatusEnum,
  LeaveTypeEnum,
} from '@/lib/validations'
import { withRateLimit, validateBody, safeErrorResponse } from '@/lib/api-helpers'

// Helper to calculate working days between two dates (excludes weekends)
function calculateWorkingDays(startDate: Date, endDate: Date, holidays: Date[] = []): number {
  let count = 0
  const current = new Date(startDate)
  const holidaySet = new Set(holidays.map(h => h.toISOString().split('T')[0]))

  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    const dateStr = current.toISOString().split('T')[0]

    // Skip weekends (0 = Sunday, 6 = Saturday) and holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)

    const paginationResult = PaginationSchema.safeParse({
      take: searchParams.get('take') || undefined,
      skip: searchParams.get('skip') || undefined,
      q: searchParams.get('q') || undefined,
    })

    const take = paginationResult.success ? paginationResult.data.take : 50
    const skip = paginationResult.success ? paginationResult.data.skip : 0

    const where: Record<string, unknown> = {}

    // Filter by employee
    const employeeId = searchParams.get('employeeId')
    if (employeeId) {
      where.employeeId = employeeId
    }

    // Filter by approver (for manager view)
    const approverId = searchParams.get('approverId')
    if (approverId) {
      where.approverId = approverId
    }

    // Filter by status
    const statusParam = searchParams.get('status')
    if (statusParam) {
      const statusValidation = LeaveRequestStatusEnum.safeParse(statusParam.toUpperCase())
      if (statusValidation.success) {
        where.status = statusValidation.data
      }
    }

    // Filter by leave type
    const leaveTypeParam = searchParams.get('leaveType')
    if (leaveTypeParam) {
      const leaveTypeValidation = LeaveTypeEnum.safeParse(leaveTypeParam.toUpperCase())
      if (leaveTypeValidation.success) {
        where.leaveType = leaveTypeValidation.data
      }
    }

    // Filter for pending requests for a manager's team
    const pendingForManager = searchParams.get('pendingForManager')
    if (pendingForManager) {
      // Get all employees who report to this manager
      const directReports = await prisma.employee.findMany({
        where: { managerId: pendingForManager },
        select: { id: true },
      })
      const reportIds = directReports.map((r: { id: string }) => r.id)
      if (reportIds.length > 0) {
        where.employeeId = { in: reportIds }
        where.status = 'PENDING'
      }
    }

    const [items, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        take: Math.min(take, MAX_PAGINATION_LIMIT),
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              region: true,
            },
          },
          approver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.leaveRequest.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch leave requests')
  }
}

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const body = await req.json()

    const validation = validateBody(CreateLeaveRequestSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const data = validation.data

    // Get employee ID from body (in production, this would come from session)
    const employeeId = body.employeeId
    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    }

    // Get employee details including region and manager
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, region: true, managerId: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)

    // Validate dates
    if (endDate < startDate) {
      return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 })
    }

    // Get holidays for the employee's region
    const holidays = await prisma.holiday.findMany({
      where: {
        region: employee.region,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { date: true },
    })

    // Calculate working days
    let workingDays = calculateWorkingDays(startDate, endDate, holidays.map((h: { date: Date }) => h.date))
    if (data.isHalfDay) {
      workingDays = 0.5
    }

    // Check leave balance
    const currentYear = new Date().getFullYear()
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveType_year: {
          employeeId: employee.id,
          leaveType: data.leaveType,
          year: currentYear,
        },
      },
    })

    if (!balance) {
      return NextResponse.json(
        { error: `No leave balance found for ${data.leaveType}` },
        { status: 400 }
      )
    }

    const remaining = balance.entitled + balance.carryover + balance.adjustment - balance.used
    if (workingDays > remaining) {
      return NextResponse.json(
        { error: `Insufficient balance. You have ${remaining} days remaining for ${data.leaveType}` },
        { status: 400 }
      )
    }

    // Check for overlapping requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    })

    if (overlapping) {
      return NextResponse.json(
        { error: 'You already have a leave request for this period' },
        { status: 400 }
      )
    }

    // Get leave policy for notice validation
    const policy = await prisma.leavePolicy.findUnique({
      where: {
        region_leaveType: {
          region: employee.region,
          leaveType: data.leaveType,
        },
      },
    })

    if (policy && policy.minNoticeDays > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilStart < policy.minNoticeDays) {
        return NextResponse.json(
          { error: `${data.leaveType} requires ${policy.minNoticeDays} days notice` },
          { status: 400 }
        )
      }
    }

    // Create the leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveType: data.leaveType,
        startDate,
        endDate,
        workingDays,
        isHalfDay: data.isHalfDay,
        halfDayType: data.halfDayType ?? null,
        reason: data.reason ?? null,
        status: 'PENDING',
        approverId: employee.managerId,
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(leaveRequest, { status: 201 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to create leave request')
  }
}
