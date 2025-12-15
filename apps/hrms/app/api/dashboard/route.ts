import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { withRateLimit } from '@/lib/api-helpers'
import { getCurrentUser } from '@/lib/current-user'

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

    // Fetch personalized data
    const [
      currentEmployee,
      directReports,
      notifications,
      pendingReviews,
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
    ])

    // Determine if user is a manager (has direct reports)
    const isManager = directReports.length > 0

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

    // Fetch leave data
    const year = new Date().getFullYear()
    const [leaveBalances, pendingLeaveRequestsData, upcomingLeavesData] = await Promise.all([
      // Get current employee's leave balances
      prisma.leaveBalance.findMany({
        where: { employeeId, year },
      }),
      // Get pending leave requests for direct reports (if manager)
      isManager ? prisma.leaveRequest.findMany({
        where: {
          employee: { reportsToId: employeeId },
          status: 'PENDING',
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }) : [],
      // Get upcoming approved leaves
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { gte: new Date() },
        },
        orderBy: { startDate: 'asc' },
        take: 5,
      }),
    ])

    // Format leave balances
    const myLeaveBalance = leaveBalances.map(b => ({
      leaveType: b.leaveType,
      year: b.year,
      allocated: b.allocated,
      used: b.used,
      pending: b.pending,
      available: Math.max(0, b.allocated + b.carriedOver - b.used - b.pending),
    }))

    return NextResponse.json({
      user: currentUser?.employee,
      isManager,
      currentEmployee: currentEmployeeFormatted,
      directReports,
      notifications,
      unreadNotificationCount,
      pendingReviews,
      pendingLeaveRequests: pendingLeaveRequestsData,
      myLeaveBalance,
      upcomingLeaves: upcomingLeavesData,
      stats,
    })
  } catch (e) {
    // Log error server-side but return fallback data to keep UI functional
    console.error('[HRMS Dashboard] Database error:', e instanceof Error ? e.message : e)

    // Return fallback data instead of error so UI renders
    return NextResponse.json(fallbackData)
  }
}
