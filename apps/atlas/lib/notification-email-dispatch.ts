import { prisma } from '@/lib/prisma'
import { getAtlasUrl, sendAtlasNotificationEmail } from '@/lib/email-service'
import { runWithCronLock } from '@/lib/cron-lock'
import { getNotificationCatalogEntry } from '@/lib/domain/notifications/catalog'

type DispatchRunResult = {
  claimed: number
  sent: number
  failed: number
  skipped: number
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim()
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

function buildActionUrl(link: string | null | undefined): string {
  const base = normalizeBaseUrl(getAtlasUrl())
  if (!link) return base
  const trimmed = link.trim()
  if (!trimmed) return base
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `${base}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`
}

function backoffMs(attempts: number): number {
  const base = 60_000 // 1 min
  const max = 6 * 60 * 60_000 // 6 hours
  const exp = Math.min(max, base * 2 ** Math.max(0, attempts - 1))
  const jitter = Math.floor(Math.random() * 10_000)
  return exp + jitter
}

export async function processPendingNotificationEmailDispatches(options?: { take?: number }): Promise<DispatchRunResult> {
  const take = options?.take ?? 50
  const now = new Date()

  const pending = await prisma.notificationEmailDispatch.findMany({
    where: {
      status: 'PENDING',
      nextAttemptAt: { lte: now },
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take,
    include: {
      notification: { select: { id: true, type: true, title: true, link: true, relatedType: true, relatedId: true } },
      employee: { select: { id: true, email: true, firstName: true } },
    },
  })

  const result: DispatchRunResult = { claimed: 0, sent: 0, failed: 0, skipped: 0 }

  for (const dispatch of pending) {
    const claimed = await prisma.notificationEmailDispatch.updateMany({
      where: { id: dispatch.id, status: 'PENDING' },
      data: { status: 'SENDING', lastAttemptAt: now },
    })
    if (claimed.count === 0) {
      result.skipped += 1
      continue
    }

    result.claimed += 1

    const catalog = getNotificationCatalogEntry({
      type: dispatch.notification.type,
      title: dispatch.notification.title,
      link: dispatch.notification.link,
      relatedType: dispatch.notification.relatedType,
      relatedId: dispatch.notification.relatedId,
    })

    const actionUrl = buildActionUrl(catalog.deepLink)

    try {
      const send = await sendAtlasNotificationEmail({
        to: dispatch.employee.email,
        firstName: dispatch.employee.firstName,
        category: catalog.category,
        title: dispatch.notification.title,
        actionUrl,
        actionRequired: catalog.actionRequired,
        subject: catalog.emailSubject,
      })

      if (send.success) {
        await prisma.notificationEmailDispatch.update({
          where: { id: dispatch.id },
          data: {
            status: 'SENT',
            sentAt: now,
            lastError: null,
          },
        })
        result.sent += 1
        continue
      }

      const nextAttempts = dispatch.attempts + 1
      const exhausted = nextAttempts >= 6
      await prisma.notificationEmailDispatch.update({
        where: { id: dispatch.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          attempts: nextAttempts,
          lastError: send.error?.slice(0, 2000) ?? 'Unknown error',
          nextAttemptAt: exhausted ? now : new Date(now.getTime() + backoffMs(nextAttempts)),
        },
      })
      result.failed += 1
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      const nextAttempts = dispatch.attempts + 1
      const exhausted = nextAttempts >= 6
      await prisma.notificationEmailDispatch.update({
        where: { id: dispatch.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          attempts: nextAttempts,
          lastError: message.slice(0, 2000),
          nextAttemptAt: exhausted ? now : new Date(now.getTime() + backoffMs(nextAttempts)),
        },
      })
      result.failed += 1
    }
  }

  return result
}

/**
 * Ensures broadcast notifications (employeeId = null) create dispatch rows for all active employees.
 * Normally handled by the Prisma middleware, but this covers edge cases (e.g. transactional creates).
 *
 * The lookback window is intentionally small to avoid retroactively emailing historical notifications.
 */
export async function backfillRecentBroadcastDispatches(options?: { lookbackMinutes?: number; take?: number }): Promise<number> {
  const lookbackMinutes = options?.lookbackMinutes ?? 10
  const take = options?.take ?? 25
  const since = new Date(Date.now() - lookbackMinutes * 60_000)

  const recentBroadcast = await prisma.notification.findMany({
    where: {
      employeeId: null,
      createdAt: { gte: since },
      emailDispatches: { none: {} },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take,
  })

  if (recentBroadcast.length === 0) return 0

  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
    take: 10000,
  })

  const chunkSize = 500
  let created = 0

  for (const n of recentBroadcast) {
    for (let i = 0; i < employees.length; i += chunkSize) {
      const batch = employees.slice(i, i + chunkSize)
      const res = await prisma.notificationEmailDispatch.createMany({
        data: batch.map((e) => ({ notificationId: n.id, employeeId: e.id })),
        skipDuplicates: true,
      })
      created += res.count
    }
  }

  return created
}

export async function runNotificationEmailDispatchOnce(): Promise<{
  ran: boolean
  dispatchesCreated: number
  result: DispatchRunResult | null
}> {
  const lock = await runWithCronLock('notification-email-dispatch', 55_000, async () => {
    const dispatchesCreated = await backfillRecentBroadcastDispatches()
    const result = await processPendingNotificationEmailDispatches()
    return { dispatchesCreated, result }
  })

  return {
    ran: lock.ran,
    dispatchesCreated: lock.result?.dispatchesCreated ?? 0,
    result: lock.result?.result ?? null,
  }
}
