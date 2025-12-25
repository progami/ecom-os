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
      startNotificationEmailDispatch,
      initializeSlaReminders,
      startSlaReminders,
      initializeWorkflowBackfills,
      startWorkflowBackfills
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

      // Workflow SLA reminders (approvals/acks)
      await initializeSlaReminders()
      startSlaReminders() // Every 6 hours

      // Data backfills for unified workflow IA (safe + idempotent)
      await initializeWorkflowBackfills()
      startWorkflowBackfills() // Every 30 minutes

      // Notification email dispatch (near-real-time)
      await initializeNotificationEmailDispatch()
      startNotificationEmailDispatch() // Every 60s
    }, 5000)
  }
}
