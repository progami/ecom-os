export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeGoogleAdminSync, startPeriodicSync } = await import('./lib/startup')

    // Run initial sync after a short delay to let the server fully start
    setTimeout(async () => {
      await initializeGoogleAdminSync()
      startPeriodicSync() // Every 30 minutes
    }, 5000)
  }
}
