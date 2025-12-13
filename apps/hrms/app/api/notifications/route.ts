import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'
import { getCurrentUser } from '@/lib/current-user'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const user = await getCurrentUser()
    const employeeId = user?.employee?.id

    // Filter: show notifications targeted to this employee OR broadcast (employeeId = null)
    const whereClause = {
      AND: [
        unreadOnly ? { isRead: false } : {},
        {
          OR: [
            { employeeId: employeeId ?? undefined },
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
          { employeeId: employeeId ?? undefined },
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
    const employeeId = user?.employee?.id

    if (markAllRead) {
      // Only mark as read notifications that belong to this user or are broadcast
      await prisma.notification.updateMany({
        where: {
          isRead: false,
          OR: [
            { employeeId: employeeId ?? undefined },
            { employeeId: null },
          ],
        },
        data: { isRead: true },
      })
      return NextResponse.json({ ok: true })
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Only update notifications the user has access to
      await prisma.notification.updateMany({
        where: {
          id: { in: ids },
          OR: [
            { employeeId: employeeId ?? undefined },
            { employeeId: null },
          ],
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
