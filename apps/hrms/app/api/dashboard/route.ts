import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { withRateLimit } from '@/lib/api-helpers'
import { getCurrentUser } from '@/lib/current-user'
import { checkAndNotifyMissingFields } from '@/lib/notification-service'

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
    pendingQuarterlyReviews: [],
    pendingLeaveRequests: [],
    leaveApprovalHistory: [],
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
      pendingQuarterlyReviewsRaw,
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
      // Get pending quarterly reviews for direct reports
      prisma.performanceReview.findMany({
        where: {
          employee: { reportsToId: employeeId },
          status: 'DRAFT',
          quarterlyCycleId: { not: null },
        },
        select: {
          id: true,
          reviewType: true,
          reviewPeriod: true,
          reviewDate: true,
          status: true,
          deadline: true,
          escalatedToHR: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              avatar: true,
            },
          },
          quarterlyCycle: {
            select: {
              id: true,
              reviewPeriod: true,
              deadline: true,
            },
          },
        },
        orderBy: { deadline: 'asc' },
        take: 10,
      }),
    ])

    // Determine if user is a manager (has direct reports)
    const isManager = directReports.length > 0

    // Enrich quarterly reviews with deadline info
    const now = new Date()
    const pendingQuarterlyReviews = pendingQuarterlyReviewsRaw.map(review => {
      const deadline = review.deadline || review.quarterlyCycle?.deadline
      let daysUntilDeadline: number | null = null
      let isOverdue = false

      if (deadline) {
        daysUntilDeadline = Math.ceil(
          (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        isOverdue = daysUntilDeadline < 0
      }

      return {
        ...review,
        daysUntilDeadline,
        isOverdue,
      }
    })

    // Self-healing: re-check profile completion to clean up stale notifications
    // This ensures PROFILE_INCOMPLETE notifications are deleted if profile is complete
    await checkAndNotifyMissingFields(employeeId)

    // Re-fetch notifications after potential cleanup
    const freshNotifications = await prisma.notification.findMany({
      where: {
        OR: [{ employeeId }, { employeeId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
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

    // Fetch leave data
    const year = new Date().getFullYear()
    const [leaveBalances, pendingLeaveRequestsData, upcomingLeavesData, leaveApprovalHistoryData] = await Promise.all([
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
              avatar: true,
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
      // Get leave requests reviewed by current employee (approval history)
      isManager ? prisma.leaveRequest.findMany({
        where: {
          reviewedById: employeeId,
          status: { in: ['APPROVED', 'REJECTED'] },
        },
        include: {
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
        orderBy: { reviewedAt: 'desc' },
        take: 10,
      }) : [],
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
      notifications: freshNotifications,
      unreadNotificationCount,
      pendingReviews,
      pendingQuarterlyReviews,
      pendingLeaveRequests: pendingLeaveRequestsData,
      leaveApprovalHistory: leaveApprovalHistoryData,
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
