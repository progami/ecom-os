import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { withRateLimit } from '@/lib/api-helpers'
import { getCurrentUser } from '@/lib/current-user'
import { DEFAULT_LEAVE_ALLOCATIONS, BALANCE_TRACKED_TYPES } from '@/lib/leave-config'
import { LeaveType, LeaveBalance } from '@prisma/client'

export async function GET(req: Request) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  // Default fallback data when database is unavailable
  const fallbackData = {
    user: null,
    isManager: false,
    currentEmployee: null,
    directReports: [],
    notifications: [],
    unreadNotificationCount: 0,
    pendingReviews: [],
    pendingLeaveRequests: [],
    myLeaveBalance: [],
    upcomingLeaves: [],
    stats: [
      { label: 'Direct Reports', value: 0 },
      { label: 'Pending Reviews', value: 0 },
      { label: 'Unread Notifications', value: 0 },
    ],
  }

  try {
    const currentUser = await getCurrentUser()
    const employeeId = currentUser?.employee?.id

    if (!employeeId) {
      return NextResponse.json(fallbackData)
    }

    const currentYear = new Date().getFullYear()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Fetch personalized data
    const [
      currentEmployee,
      directReports,
      notifications,
      pendingReviews,
      existingBalances,
      pendingLeaveRequests,
      upcomingLeaves,
    ] = await Promise.all([
      // Get current employee's full profile
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          department: true,
          position: true,
          avatar: true,
          status: true,
          employmentType: true,
          joinDate: true,
          reportsToId: true,
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      // Get direct reports
      prisma.employee.findMany({
        where: {
          reportsToId: employeeId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          position: true,
          avatar: true,
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: 10,
      }),
      // Get user's notifications (personal + broadcast)
      prisma.notification.findMany({
        where: {
          OR: [{ employeeId }, { employeeId: null }],
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Get pending reviews for direct reports
      prisma.performanceReview.findMany({
        where: {
          employee: { reportsToId: employeeId },
          status: { in: ['DRAFT', 'PENDING_REVIEW'] },
        },
        select: {
          id: true,
          reviewType: true,
          reviewPeriod: true,
          reviewDate: true,
          status: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
            },
          },
        },
        orderBy: { reviewDate: 'asc' },
        take: 5,
      }),
      // Get current user's leave balances
      prisma.leaveBalance.findMany({
        where: {
          employeeId,
          year: currentYear,
        },
      }),
      // Get pending leave requests from direct reports (for managers)
      prisma.leaveRequest.findMany({
        where: {
          employee: { reportsToId: employeeId },
          status: 'PENDING',
        },
        select: {
          id: true,
          leaveType: true,
          startDate: true,
          endDate: true,
          totalDays: true,
          reason: true,
          status: true,
          createdAt: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
      }),
      // Get upcoming approved leaves for direct reports (for managers)
      prisma.leaveRequest.findMany({
        where: {
          employee: { reportsToId: employeeId },
          status: 'APPROVED',
          startDate: { gte: today },
        },
        select: {
          id: true,
          leaveType: true,
          startDate: true,
          endDate: true,
          totalDays: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: { startDate: 'asc' },
        take: 10,
      }),
    ])

    // Determine if user is a manager (has direct reports)
    const isManager = directReports.length > 0

    // Build leave balance response with defaults for missing types
    const balanceMap = new Map<LeaveType, LeaveBalance>(
      existingBalances.map((b: LeaveBalance) => [b.leaveType, b])
    )
    const myLeaveBalance = BALANCE_TRACKED_TYPES.map((leaveType) => {
      const existing = balanceMap.get(leaveType)
      if (existing) {
        return {
          leaveType,
          year: currentYear,
          allocated: existing.allocated,
          used: existing.used,
          pending: existing.pending,
          available: existing.allocated - existing.used - existing.pending,
        }
      }
      const defaultAllocation = DEFAULT_LEAVE_ALLOCATIONS[leaveType as LeaveType]
      return {
        leaveType,
        year: currentYear,
        allocated: defaultAllocation,
        used: 0,
        pending: 0,
        available: defaultAllocation,
      }
    })

    // Get unread notification count
    const unreadNotificationCount = await prisma.notification.count({
      where: {
        isRead: false,
        OR: [{ employeeId }, { employeeId: null }],
      },
    })

    const stats = [
      { label: 'Direct Reports', value: directReports.length },
      { label: 'Pending Reviews', value: pendingReviews.length },
      { label: 'Unread Notifications', value: unreadNotificationCount },
    ]

    // Map manager to reportsTo for frontend compatibility
    const currentEmployeeFormatted = currentEmployee ? {
      ...currentEmployee,
      reportsTo: (currentEmployee as any).manager || null,
    } : null

    return NextResponse.json({
      user: currentUser?.employee,
      isManager,
      currentEmployee: currentEmployeeFormatted,
      directReports,
      notifications,
      unreadNotificationCount,
      pendingReviews,
      pendingLeaveRequests,
      myLeaveBalance,
      upcomingLeaves,
      stats,
    })
  } catch (e) {
    // Log error server-side but return fallback data to keep UI functional
    console.error('[HRMS Dashboard] Database error:', e instanceof Error ? e.message : e)

    // Return fallback data instead of error so UI renders
    return NextResponse.json(fallbackData)
  }
}
