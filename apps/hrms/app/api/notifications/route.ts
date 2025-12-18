import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentUser } from '@/lib/current-user'
import { checkAndNotifyMissingFields } from '@/lib/notification-service'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const employeeId = user.employee?.id

    // Security: If user has session but no employee record, only show broadcast notifications
    // This prevents data leaks when employeeId is undefined
    if (!employeeId) {
      const broadcastNotifications = await prisma.notification.findMany({
        where: {
          employeeId: null, // Only broadcast notifications
          ...(unreadOnly ? { isRead: false } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      const unreadCount = await prisma.notification.count({
        where: { employeeId: null, isRead: false },
      })
      return NextResponse.json({ items: broadcastNotifications, unreadCount })
    }

    // Self-healing: re-check profile completion to clean up stale notifications
    await checkAndNotifyMissingFields(employeeId)

    // Filter: show notifications targeted to this employee OR broadcast (employeeId = null)
    const whereClause = {
      AND: [
        unreadOnly ? { isRead: false } : {},
        {
          OR: [
            { employeeId: employeeId },
            { employeeId: null },
          ],
        },
      ],
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const unreadCount = await prisma.notification.count({
      where: {
        isRead: false,
        OR: [
          { employeeId: employeeId },
          { employeeId: null },
        ],
      },
    })

    return NextResponse.json({ items: notifications, unreadCount })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to fetch notifications')
  }
}

export async function PATCH(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const body = await req.json()
    const { markAllRead, ids } = body

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const employeeId = user.employee?.id

    // Security: Build proper where clause that doesn't leak data
    // If no employeeId, only allow marking broadcast notifications as read
    const accessFilter = employeeId
      ? { OR: [{ employeeId: employeeId }, { employeeId: null }] }
      : { employeeId: null }

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: {
          isRead: false,
          ...accessFilter,
        },
        data: { isRead: true },
      })
      return NextResponse.json({ ok: true })
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: ids },
          ...accessFilter,
        },
        data: { isRead: true },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update notifications')
  }
}
