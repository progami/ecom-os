import { prisma } from '@/lib/prisma'

function getLockOwner(): string | null {
  const hostname = process.env.HOSTNAME
  if (hostname) return hostname
  return null
}

export async function tryAcquireCronLock(key: string, ttlMs: number): Promise<boolean> {
  const now = new Date()
  const lockedUntil = new Date(now.getTime() + ttlMs)
  const lockedBy = getLockOwner()

  const updated = await prisma.cronLock.updateMany({
    where: {
      key,
      lockedUntil: { lt: now },
    },
    data: {
      lockedUntil,
      lockedBy,
    },
  })

  if (updated.count > 0) {
    return true
  }

  try {
    const created = await prisma.cronLock.createMany({
      data: [
        {
          key,
          lockedUntil,
          lockedBy,
        },
      ],
      skipDuplicates: true,
    })
    return created.count > 0
  } catch (e) {
    return false
  }
}

export async function runWithCronLock<T>(
  key: string,
  ttlMs: number,
  runner: () => Promise<T>
): Promise<{ ran: boolean; result: T | null }> {
  const acquired = await tryAcquireCronLock(key, ttlMs)
  if (!acquired) {
    return { ran: false, result: null }
  }

  const result = await runner()
  return { ran: true, result }
}
