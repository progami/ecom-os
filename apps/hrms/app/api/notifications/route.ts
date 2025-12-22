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

    // Filter: show notifications targeted to this employee OR broadcast (employeeId = null).
    // Broadcast notifications use per-employee read receipts.
    const whereClause = unreadOnly
      ? {
          OR: [
            { employeeId, isRead: false },
            { employeeId: null, readReceipts: { none: { employeeId } } },
          ],
        }
      : {
          OR: [{ employeeId }, { employeeId: null }],
        }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        readReceipts: {
          where: { employeeId },
          select: { id: true },
        },
      },
    })

    const unreadCount = await prisma.notification.count({
      where: {
        OR: [
          { employeeId, isRead: false },
          { employeeId: null, readReceipts: { none: { employeeId } } },
        ],
      },
    })

    const items = notifications.map(({ readReceipts, ...n }) => ({
      ...n,
      isRead: n.employeeId === null ? readReceipts.length > 0 : n.isRead,
    }))

    return NextResponse.json({ items, unreadCount })
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

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee record required' }, { status: 400 })
    }

    if (markAllRead) {
      // Mark personal notifications as read
      await prisma.notification.updateMany({
        where: {
          isRead: false,
          employeeId,
        },
        data: { isRead: true },
      })

      // Mark broadcast notifications as read via read receipts (per-employee)
      const unreadBroadcast = await prisma.notification.findMany({
        where: {
          employeeId: null,
          readReceipts: { none: { employeeId } },
        },
        select: { id: true },
      })

      if (unreadBroadcast.length > 0) {
        await prisma.notificationReadReceipt.createMany({
          data: unreadBroadcast.map((n) => ({ notificationId: n.id, employeeId })),
          skipDuplicates: true,
        })
      }
      return NextResponse.json({ ok: true })
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const scoped = await prisma.notification.findMany({
        where: {
          id: { in: ids },
          OR: [{ employeeId }, { employeeId: null }],
        },
        select: { id: true, employeeId: true },
      })

      const personalIds = scoped.filter((n) => n.employeeId === employeeId).map((n) => n.id)
      const broadcastIds = scoped.filter((n) => n.employeeId === null).map((n) => n.id)

      if (personalIds.length > 0) {
        await prisma.notification.updateMany({
          where: {
            id: { in: personalIds },
            employeeId,
          },
          data: { isRead: true },
        })
      }

      if (broadcastIds.length > 0) {
        await prisma.notificationReadReceipt.createMany({
          data: broadcastIds.map((notificationId) => ({ notificationId, employeeId })),
          skipDuplicates: true,
        })
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update notifications')
  }
}
