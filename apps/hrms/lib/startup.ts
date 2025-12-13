import { syncGoogleAdminUsers } from './google-admin-sync'
import { isAdminConfigured } from './google-admin'
import { runProfileCompletionCheckForAll } from './notification-service'

let syncInitialized = false

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
