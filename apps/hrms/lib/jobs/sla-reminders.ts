import { runWithCronLock } from '@/lib/cron-lock'
import { processSlaReminders, type SlaReminderResult } from '@/lib/sla-reminders'

export async function runSlaRemindersWithLock(options?: {
  lockTtlMs?: number
  parameters?: Parameters<typeof processSlaReminders>[0]
}): Promise<{ ran: boolean; result: SlaReminderResult | null }> {
  const lockTtlMs = options?.lockTtlMs ?? 10 * 60 * 1000

  const lock = await runWithCronLock('sla-reminders', lockTtlMs, async () => {
    const result = await processSlaReminders(options?.parameters)
    return result
  })

  return { ran: lock.ran, result: lock.result ?? null }
}

