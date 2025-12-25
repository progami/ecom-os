import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRateLimit, safeErrorResponse, validateBody } from '@/lib/api-helpers'
import { getCurrentUser } from '@/lib/current-user'
import { prisma } from '@/lib/prisma'

type BulkOperation = 'notifications.markRead' | 'notifications.markAllRead'

const BulkSchema = z.object({
  operation: z.enum(['notifications.markRead', 'notifications.markAllRead']),
  ids: z.array(z.string().min(1)).optional(),
})

export async function POST(req: Request) {
  const rateLimitError = withRateLimit(req)
  if (rateLimitError) return rateLimitError

  try {
    const body = await req.json()
    const validation = validateBody(BulkSchema, body)
    if (!validation.success) return validation.error

    const { operation, ids } = validation.data as { operation: BulkOperation; ids?: string[] }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const employeeId = user.employee?.id
    if (!employeeId) {
      return NextResponse.json({ error: 'Employee record required' }, { status: 400 })
    }

    if (operation === 'notifications.markAllRead') {
      await prisma.notification.updateMany({
        where: { isRead: false, employeeId },
        data: { isRead: true },
      })

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

    if (operation === 'notifications.markRead') {
      if (!ids || ids.length === 0) {
        return NextResponse.json({ error: 'ids is required' }, { status: 400 })
      }

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

    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
  } catch (e) {
    return safeErrorResponse(e, 'Failed to process bulk work items action')
  }
}

