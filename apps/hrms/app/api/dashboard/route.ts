import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentUser } from '@/lib/current-user'

export async function GET(req: Request) {
  // Rate limiting
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  // Default fallback data when database is unavailable
  const fallbackData = {
    user: null,
    directReports: [],
    notifications: [],
    unreadNotificationCount: 0,
    pendingReviews: [],
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
    const [directReports, notifications, pendingReviews] = await Promise.all([
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

    return NextResponse.json({
      user: currentUser?.employee,
      directReports,
      notifications,
      unreadNotificationCount,
      pendingReviews,
      stats,
    })
  } catch (e) {
    // Log error server-side but return fallback data to keep UI functional
    console.error('[HRMS Dashboard] Database error:', e instanceof Error ? e.message : e)

    // Return fallback data instead of error so UI renders
    return NextResponse.json(fallbackData)
  }
}
