import { NextResponse } from 'next/server'
import prisma from '../../../lib/prisma'
import { withRateLimit, safeErrorResponse } from '@/lib/api-helpers'

export async function GET(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const notifications = await prisma.notification.findMany({
      where: unreadOnly ? { isRead: false } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const unreadCount = await prisma.notification.count({
      where: { isRead: false },
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

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ ok: true })
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: ids } },
        data: { isRead: true },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to update notifications')
  }
}
