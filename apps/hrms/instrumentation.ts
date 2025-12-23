export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const {
      initializeGoogleAdminSync,
      startPeriodicSync,
      initializeQuarterlyReviewAutomation,
      startQuarterlyReviewReminders,
      initializeTaskReminders,
      startTaskReminders,
      initializeNotificationEmailDispatch,
      startNotificationEmailDispatch
    } = await import('./lib/startup')

    // Run initial sync after a short delay to let the server fully start
    setTimeout(async () => {
      await initializeGoogleAdminSync()
      startPeriodicSync() // Every 30 minutes

      // Initialize quarterly review automation
      await initializeQuarterlyReviewAutomation()
      startQuarterlyReviewReminders() // Every 6 hours

      // Task reminders
      await initializeTaskReminders()
      startTaskReminders() // Every 6 hours

      // Notification email dispatch (near-real-time)
      await initializeNotificationEmailDispatch()
      startNotificationEmailDispatch() // Every 60s
    }, 5000)
  }
}
