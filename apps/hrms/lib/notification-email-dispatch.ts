import { prisma } from '@/lib/prisma'
import { getHrmsUrl, sendHrmsNotificationEmail } from '@/lib/email-service'
import { runWithCronLock } from '@/lib/cron-lock'

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
  const base = normalizeBaseUrl(getHrmsUrl())
  if (!link) return base
  const trimmed = link.trim()
  if (!trimmed) return base
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `${base}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`
}

function deriveCategory(notification: { type: string; relatedType: string | null; title: string }): string {
  const byRelated: Record<string, string> = {
    POLICY: 'Policy',
    REVIEW: 'Performance Review',
    QUARTERLY_CYCLE: 'Quarterly Review',
    DISCIPLINARY: 'Violation',
    LEAVE: 'Leave',
    TASK: 'Task',
    RESOURCE: 'Resource',
    EMPLOYEE: 'Org',
    STANDING: 'Standing',
    CASE: 'Case',
  }

  if (notification.relatedType && byRelated[notification.relatedType]) {
    return byRelated[notification.relatedType]!
  }

  const t = notification.type
  if (t.startsWith('POLICY_')) return 'Policy'
  if (t.startsWith('REVIEW_')) return 'Performance Review'
  if (t.startsWith('QUARTERLY_REVIEW_')) return 'Quarterly Review'
  if (t.startsWith('VIOLATION_') || t.startsWith('DISCIPLINARY_') || t.startsWith('APPEAL_')) return 'Violation'
  if (t.startsWith('LEAVE_')) return 'Leave'
  if (t.startsWith('RESOURCE_')) return 'Resource'
  if (t === 'PROFILE_INCOMPLETE') return 'Profile'
  if (t === 'HIERARCHY_CHANGED') return 'Org'
  if (t === 'ANNOUNCEMENT') return 'Announcement'
  if (t === 'SYSTEM') return 'System'

  const title = notification.title.toLowerCase()
  if (title.includes('task')) return 'Task'
  if (title.includes('leave')) return 'Leave'
  if (title.includes('policy')) return 'Policy'
  if (title.includes('review')) return 'Performance Review'
  if (title.includes('appeal') || title.includes('violation')) return 'Violation'

  return 'Notification'
}

function isActionRequired(notification: { type: string; title: string }): boolean {
  const t = notification.type
  if (t === 'PROFILE_INCOMPLETE') return true
  if (t.includes('PENDING') || t.includes('OVERDUE') || t.includes('ESCALATED')) return true
  if (t.includes('ACK') || t.includes('APPROVAL')) return true
  if (t === 'SYSTEM') {
    const title = notification.title.toLowerCase()
    if (title.includes('assigned') || title.includes('due') || title.includes('overdue')) return true
  }

  const title = notification.title.toLowerCase()
  return (
    title.includes('pending') ||
    title.includes('required') ||
    title.includes('overdue') ||
    title.includes('acknowledge') ||
    title.includes('approval')
  )
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
      notification: { select: { id: true, type: true, title: true, link: true, relatedType: true } },
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

    const category = deriveCategory(dispatch.notification)
    const actionUrl = buildActionUrl(dispatch.notification.link)
    const actionRequired = isActionRequired(dispatch.notification)

    try {
      const send = await sendHrmsNotificationEmail({
        to: dispatch.employee.email,
        firstName: dispatch.employee.firstName,
        category,
        title: dispatch.notification.title,
        actionUrl,
        actionRequired,
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
