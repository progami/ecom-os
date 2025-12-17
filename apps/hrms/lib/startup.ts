import { syncGoogleAdminUsers } from './google-admin-sync'
import { isAdminConfigured } from './google-admin'
import { runProfileCompletionCheckForAll } from './notification-service'
import {
  checkAndCreateQuarterlyReviews,
  processRemindersAndEscalations
} from './quarterly-review-automation'

let syncInitialized = false
let quarterlyReviewsInitialized = false

export async function initializeGoogleAdminSync() {
  if (syncInitialized) return
  syncInitialized = true

  if (!isAdminConfigured()) {
    console.log('[Startup] Google Admin not configured, skipping sync')
    return
  }

  console.log('[Startup] Running initial Google Admin sync...')
  try {
    const result = await syncGoogleAdminUsers()
    console.log(`[Startup] Sync complete - Created: ${result.created}, Updated: ${result.updated}, Deactivated: ${result.deactivated}`)

    // Run profile completion check after sync (wrapped to handle errors gracefully)
    runProfileCompletionCheckForAll()
      .then((result) => console.log(`[Profile Check] Checked: ${result.checked}, Notified: ${result.notified}`))
      .catch((err) => console.error('[Profile Check] Failed:', err))
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
      const result = await syncGoogleAdminUsers()
      console.log(`[Periodic Sync] Sync complete - Created: ${result.created}, Updated: ${result.updated}, Deactivated: ${result.deactivated}`)

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
    const result = await checkAndCreateQuarterlyReviews()
    if (result.cycleCreated) {
      console.log(`[Startup] Created quarterly cycle with ${result.reviewsCreated} reviews`)
    } else {
      console.log('[Startup] No new quarterly cycle needed')
    }
    if (result.errors.length > 0) {
      console.error('[Startup] Quarterly review errors:', result.errors)
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
