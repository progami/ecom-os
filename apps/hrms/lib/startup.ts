import { syncGoogleAdminUsers } from './google-admin-sync'
import { isAdminConfigured } from './google-admin'
import { runProfileCompletionCheckForAll } from './notification-service'
import { processTaskDueReminders } from './task-reminders'
import { runNotificationEmailDispatchOnce } from './notification-email-dispatch'
import { processSlaReminders } from './sla-reminders'
import { backfillDisciplinaryCases } from './disciplinary-case-backfill'
import {
  checkAndCreateQuarterlyReviews,
  processRemindersAndEscalations
} from './quarterly-review-automation'
import { runWithCronLock } from './cron-lock'

let syncInitialized = false
let quarterlyReviewsInitialized = false
let taskRemindersInitialized = false
let notificationEmailDispatchInitialized = false
let slaRemindersInitialized = false
let workflowBackfillsInitialized = false

export async function initializeGoogleAdminSync() {
  if (syncInitialized) return
  syncInitialized = true

  if (!isAdminConfigured()) {
    console.log('[Startup] Google Admin not configured, skipping sync')
    return
  }

  console.log('[Startup] Running initial Google Admin sync...')
  try {
    const lock = await runWithCronLock('google-admin-sync', 10 * 60 * 1000, async () => {
      const result = await syncGoogleAdminUsers()
      console.log(`[Startup] Sync complete - Created: ${result.created}, Updated: ${result.updated}, Deactivated: ${result.deactivated}`)

      // Run profile completion check after sync (wrapped to handle errors gracefully)
      runProfileCompletionCheckForAll()
        .then((profileResult) => console.log(`[Profile Check] Checked: ${profileResult.checked}, Notified: ${profileResult.notified}`))
        .catch((err) => console.error('[Profile Check] Failed:', err))

      return result
    })

    if (!lock.ran) {
      console.log('[Startup] Skipping initial Google Admin sync (lock not acquired)')
    }
  } catch (e) {
    console.error('[Startup] Google Admin sync failed:', e)
  }
}

// Auto-sync every 30 minutes
let syncInterval: NodeJS.Timeout | null = null

export function startPeriodicSync(intervalMs = 30 * 60 * 1000) {
  if (syncInterval) return

  syncInterval = setInterval(async () => {
    if (!isAdminConfigured()) return
    console.log('[Periodic Sync] Running Google Admin sync...')
    try {
      const lock = await runWithCronLock('google-admin-sync', 25 * 60 * 1000, async () => {
        const result = await syncGoogleAdminUsers()
        console.log(`[Periodic Sync] Sync complete - Created: ${result.created}, Updated: ${result.updated}, Deactivated: ${result.deactivated}`)
        return result
      })

      if (!lock.ran) {
        console.log('[Periodic Sync] Skipping sync (lock not acquired)')
        return
      }

      // Run profile completion check after sync
      runProfileCompletionCheckForAll()
        .then((profileResult) => console.log(`[Periodic Sync] Profile check - Checked: ${profileResult.checked}, Notified: ${profileResult.notified}`))
        .catch((err) => console.error('[Periodic Sync] Profile check failed:', err))
    } catch (e) {
      console.error('[Periodic Sync] Google Admin sync failed:', e)
    }
  }, intervalMs)

  console.log(`[Startup] Periodic sync scheduled every ${intervalMs / 60000} minutes`)
}

export function stopPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

// ============ QUARTERLY REVIEW AUTOMATION ============

export async function initializeQuarterlyReviewAutomation() {
  if (quarterlyReviewsInitialized) return
  quarterlyReviewsInitialized = true

  console.log('[Startup] Checking quarterly reviews...')
  try {
    const lock = await runWithCronLock('quarterly-review-automation', 10 * 60 * 1000, async () => {
      const result = await checkAndCreateQuarterlyReviews()
      if (result.cycleCreated) {
        console.log(`[Startup] Created quarterly cycle with ${result.reviewsCreated} reviews`)
      } else {
        console.log('[Startup] No new quarterly cycle needed')
      }
      if (result.errors.length > 0) {
        console.error('[Startup] Quarterly review errors:', result.errors)
      }
      return result
    })

    if (!lock.ran) {
      console.log('[Startup] Skipping quarterly review check (lock not acquired)')
    }
  } catch (e) {
    console.error('[Startup] Quarterly review check failed:', e)
  }
}

// Check reminders and escalations every 6 hours
let quarterlyReviewInterval: NodeJS.Timeout | null = null

export function startQuarterlyReviewReminders(intervalMs = 6 * 60 * 60 * 1000) {
  if (quarterlyReviewInterval) return

  quarterlyReviewInterval = setInterval(async () => {
    console.log('[Quarterly Reviews] Running periodic check...')
    try {
      const lock = await runWithCronLock('quarterly-review-reminders', 5 * 60 * 60 * 1000, async () => {
        // Check if new quarter started (creates new cycle if needed)
        const cycleResult = await checkAndCreateQuarterlyReviews()
        if (cycleResult.cycleCreated) {
          console.log(`[Quarterly Reviews] Created new cycle with ${cycleResult.reviewsCreated} reviews`)
        }

        // Process reminders and escalations
        const reminderResult = await processRemindersAndEscalations()
        if (reminderResult.remindersSent > 0 || reminderResult.escalations > 0) {
          console.log(`[Quarterly Reviews] Reminders: ${reminderResult.remindersSent}, Escalations: ${reminderResult.escalations}`)
        }

        return { cycleResult, reminderResult }
      })

      if (!lock.ran) {
        console.log('[Quarterly Reviews] Skipping periodic check (lock not acquired)')
      }
    } catch (e) {
      console.error('[Quarterly Reviews] Periodic check failed:', e)
    }
  }, intervalMs)

  console.log(`[Startup] Quarterly review reminders scheduled every ${intervalMs / 3600000} hours`)
}

export function stopQuarterlyReviewReminders() {
  if (quarterlyReviewInterval) {
    clearInterval(quarterlyReviewInterval)
    quarterlyReviewInterval = null
  }
}

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

// ============ SLA REMINDERS (WORKFLOW) ============

export async function initializeSlaReminders() {
  if (slaRemindersInitialized) return
  slaRemindersInitialized = true

  console.log('[Startup] Running initial SLA reminders...')
  try {
    const lock = await runWithCronLock('sla-reminders', 10 * 60 * 1000, async () => {
      const result = await processSlaReminders()
      const created =
        result.leaveApprovalRemindersCreated +
        result.reviewRemindersCreated +
        result.disciplinaryRemindersCreated +
        result.acknowledgmentRemindersCreated +
        result.checklistTaskRemindersCreated
      if (created > 0) {
        console.log(
          `[SLA Reminders] leave=${result.leaveApprovalRemindersCreated} review=${result.reviewRemindersCreated} disciplinary=${result.disciplinaryRemindersCreated} ack=${result.acknowledgmentRemindersCreated} checklist=${result.checklistTaskRemindersCreated}`
        )
      }
      return result
    })

    if (!lock.ran) {
      console.log('[Startup] Skipping initial SLA reminders (lock not acquired)')
    }
  } catch (e) {
    console.error('[Startup] SLA reminders failed:', e)
  }
}

let slaReminderInterval: NodeJS.Timeout | null = null

export function startSlaReminders(intervalMs = 6 * 60 * 60 * 1000) {
  if (slaReminderInterval) return

  slaReminderInterval = setInterval(async () => {
    console.log('[SLA Reminders] Running periodic check...')
    try {
      const lock = await runWithCronLock('sla-reminders', 5 * 60 * 60 * 1000, async () => {
        const result = await processSlaReminders()
        const created =
          result.leaveApprovalRemindersCreated +
          result.reviewRemindersCreated +
          result.disciplinaryRemindersCreated +
          result.acknowledgmentRemindersCreated +
          result.checklistTaskRemindersCreated
        if (created > 0) {
          console.log(
            `[SLA Reminders] leave=${result.leaveApprovalRemindersCreated} review=${result.reviewRemindersCreated} disciplinary=${result.disciplinaryRemindersCreated} ack=${result.acknowledgmentRemindersCreated} checklist=${result.checklistTaskRemindersCreated}`
          )
        }
        return result
      })

      if (!lock.ran) {
        console.log('[SLA Reminders] Skipping periodic check (lock not acquired)')
      }
    } catch (e) {
      console.error('[SLA Reminders] Periodic check failed:', e)
    }
  }, intervalMs)

  console.log(`[Startup] SLA reminders scheduled every ${intervalMs / 3600000} hours`)
}

export function stopSlaReminders() {
  if (slaReminderInterval) {
    clearInterval(slaReminderInterval)
    slaReminderInterval = null
  }
}

// ============ WORKFLOW BACKFILLS (DATA) ============

export async function initializeWorkflowBackfills() {
  if (workflowBackfillsInitialized) return
  workflowBackfillsInitialized = true

  console.log('[Startup] Running initial workflow backfills...')
  try {
    const lock = await runWithCronLock('workflow-backfills', 10 * 60 * 1000, async () => {
      const result = await backfillDisciplinaryCases({ take: 50 })
      if (result.linked > 0 || result.skipped > 0) {
        console.log(`[Backfill] disciplinary cases linked=${result.linked}/${result.scanned} skipped=${result.skipped}`)
      }
      return result
    })

    if (!lock.ran) {
      console.log('[Startup] Skipping initial workflow backfills (lock not acquired)')
    }
  } catch (e) {
    console.error('[Startup] Workflow backfills failed:', e)
  }
}

let workflowBackfillInterval: NodeJS.Timeout | null = null

export function startWorkflowBackfills(intervalMs = 30 * 60 * 1000) {
  if (workflowBackfillInterval) return

  workflowBackfillInterval = setInterval(async () => {
    try {
      const lock = await runWithCronLock('workflow-backfills', 25 * 60 * 1000, async () => {
        const result = await backfillDisciplinaryCases({ take: 50 })
        if (result.linked > 0 || result.skipped > 0) {
          console.log(`[Backfill] disciplinary cases linked=${result.linked}/${result.scanned} skipped=${result.skipped}`)
        }
        return result
      })

      if (!lock.ran) {
        return
      }
    } catch (e) {
      console.error('[Backfill] periodic run failed:', e)
    }
  }, intervalMs)

  console.log(`[Startup] Workflow backfills scheduled every ${Math.round(intervalMs / 60000)} minutes`)
}

export function stopWorkflowBackfills() {
  if (workflowBackfillInterval) {
    clearInterval(workflowBackfillInterval)
    workflowBackfillInterval = null
  }
}
