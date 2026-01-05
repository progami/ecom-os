export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const {
      initializeTaskReminders,
      startTaskReminders,
      initializeNotificationEmailDispatch,
      startNotificationEmailDispatch,
    } = await import('./lib/startup')

    // Run initial setup after a short delay to let the server fully start
    setTimeout(async () => {
      // Task reminders - notify about due/overdue tasks
      await initializeTaskReminders()
      startTaskReminders() // Every 6 hours

      // Notification email dispatch - sends email notifications
      await initializeNotificationEmailDispatch()
      startNotificationEmailDispatch() // Every 60s
    }, 5000)
  }
}
