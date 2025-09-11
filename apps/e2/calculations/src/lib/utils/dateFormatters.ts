/**
 * Format date as "DD MMM YY" (e.g., "25 Jul 25")
 */
export function formatDateShort(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  
  // Use UTC methods to ensure consistent date display
  const month = months[dateObj.getUTCMonth()]
  const day = dateObj.getUTCDate().toString().padStart(2, '0')
  const year = dateObj.getUTCFullYear().toString().slice(-2)
  
  return `${day} ${month} ${year}`
}

/**
 * Format date for exports and formal displays
 */
export function formatDateFull(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}