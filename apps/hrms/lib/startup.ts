import { processTaskDueReminders } from './task-reminders'
import { runNotificationEmailDispatchOnce } from './notification-email-dispatch'
import { runWithCronLock } from './cron-lock'

let taskRemindersInitialized = false
let notificationEmailDispatchInitialized = false

// ============ TASK REMINDERS ============

export async function initializeTaskReminders() {
  if (taskRemindersInitialized) return
  taskRemindersInitialized = true

  console.log('[Startup] Running initial task reminders...')
  try {
    const lock = await runWithCronLock('task-reminders', 10 * 60 * 1000, async () => {
      const result = await processTaskDueReminders()
      if (result.dueSoonCreated > 0 || result.overdueCreated > 0) {
        console.log(`[Task Reminders] Due soon: ${result.dueSoonCreated}, Overdue: ${result.overdueCreated}`)
      }
      return result
    })

    if (!lock.ran) {
      console.log('[Startup] Skipping initial task reminders (lock not acquired)')
    }
  } catch (e) {
    console.error('[Startup] Task reminders failed:', e)
  }
}

let taskReminderInterval: NodeJS.Timeout | null = null

export function startTaskReminders(intervalMs = 6 * 60 * 60 * 1000) {
  if (taskReminderInterval) return

  taskReminderInterval = setInterval(async () => {
    console.log('[Task Reminders] Running periodic check...')
    try {
      const lock = await runWithCronLock('task-reminders', 5 * 60 * 60 * 1000, async () => {
        const result = await processTaskDueReminders()
        if (result.dueSoonCreated > 0 || result.overdueCreated > 0) {
          console.log(`[Task Reminders] Due soon: ${result.dueSoonCreated}, Overdue: ${result.overdueCreated}`)
        }
        return result
      })

      if (!lock.ran) {
        console.log('[Task Reminders] Skipping periodic check (lock not acquired)')
      }
    } catch (e) {
      console.error('[Task Reminders] Periodic check failed:', e)
    }
  }, intervalMs)

  console.log(`[Startup] Task reminders scheduled every ${intervalMs / 3600000} hours`)
}

export function stopTaskReminders() {
  if (taskReminderInterval) {
    clearInterval(taskReminderInterval)
    taskReminderInterval = null
  }
}

// ============ NOTIFICATION EMAIL DISPATCH ============

export async function initializeNotificationEmailDispatch() {
  if (notificationEmailDispatchInitialized) return
  notificationEmailDispatchInitialized = true

  console.log('[Startup] Running initial notification email dispatch...')
  try {
    const run = await runNotificationEmailDispatchOnce()
    if (!run.ran) {
      console.log('[Startup] Skipping initial notification email dispatch (lock not acquired)')
    }
  } catch (e) {
    console.error('[Startup] Notification email dispatch failed:', e)
  }
}

let notificationEmailDispatchInterval: NodeJS.Timeout | null = null

export function startNotificationEmailDispatch(intervalMs = 60_000) {
  if (notificationEmailDispatchInterval) return

  notificationEmailDispatchInterval = setInterval(async () => {
    try {
      const run = await runNotificationEmailDispatchOnce()
      if (run.ran && (run.dispatchesCreated > 0 || (run.result?.claimed ?? 0) > 0)) {
        console.log(
          `[Notification Email] created=${run.dispatchesCreated} claimed=${run.result?.claimed ?? 0} sent=${run.result?.sent ?? 0} failed=${run.result?.failed ?? 0}`
        )
      }
    } catch (e) {
      console.error('[Notification Email] Periodic dispatch failed:', e)
    }
  }, intervalMs)

  console.log(`[Startup] Notification email dispatch scheduled every ${Math.round(intervalMs / 1000)}s`)
}

export function stopNotificationEmailDispatch() {
  if (notificationEmailDispatchInterval) {
    clearInterval(notificationEmailDispatchInterval)
    notificationEmailDispatchInterval = null
  }
}
