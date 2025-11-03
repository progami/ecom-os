/**
 * Date utility functions for consistent UTC/GMT handling
 * All dates are stored and processed in UTC
 * Display can be configured for different timezones later
 */

/**
 * Format a date for display in GMT/UTC
 * @param date - Date to format (can be string or Date object)
 * @param includeTime - Whether to include time in the output
 * @returns Formatted date string in GMT
 */
export function formatDateGMT(date: Date | string | null | undefined, includeTime = false): string {
 if (!date) return ''
 
 const d = typeof date === 'string' ? new Date(date) : date
 
 if (isNaN(d.getTime())) return ''
 
 if (includeTime) {
 // Format: "Jan 10, 2025 15:30 GMT"
 return d.toLocaleString('en-US', {
 timeZone: 'UTC',
 month: 'short',
 day: 'numeric',
 year: 'numeric',
 hour: '2-digit',
 minute: '2-digit',
 hour12: false
 }) + ' GMT'
 } else {
 // Format: "Jan 10, 2025"
 return d.toLocaleDateString('en-US', {
 timeZone: 'UTC',
 month: 'short',
 day: 'numeric',
 year: 'numeric'
 })
 }
}

/**
 * Format a date for input fields (datetime-local)
 * @param date - Date to format
 * @returns ISO string suitable for datetime-local input (YYYY-MM-DDTHH:mm)
 */
export function formatForDateTimeInput(date: Date | string | null | undefined): string {
 if (!date) return ''
 
 const d = typeof date === 'string' ? new Date(date) : date
 
 if (isNaN(d.getTime())) return ''
 
 // Return UTC time in the format needed for datetime-local input
 return d.toISOString().slice(0, 16)
}

/**
 * Parse a datetime-local input value to a Date object
 * @param value - Value from datetime-local input
 * @returns Date object in UTC
 */
export function parseDateTimeInput(value: string): Date {
 // The datetime-local input gives us a value like "2025-01-10T15:30"
 // We treat this as UTC time
 return new Date(value + ':00.000Z')
}

/**
 * Get current datetime for default form values (in UTC)
 * @returns ISO string suitable for datetime-local input
 */
export function getCurrentDateTimeUTC(): string {
 return new Date().toISOString().slice(0, 16)
}

/**
 * Get max date for form validation (14 days from now in UTC)
 * @param daysAhead - Number of days ahead (default 14)
 * @returns ISO string suitable for datetime-local input max attribute
 */
export function getMaxDateTimeUTC(daysAhead = 14): string {
 const maxDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
 return maxDate.toISOString().slice(0, 16)
}

/**
 * Check if a date is in the future
 * @param date - Date to check
 * @returns True if date is in the future
 */
export function isFutureDate(date: Date | string): boolean {
 const d = typeof date === 'string' ? new Date(date) : date
 return d.getTime() > Date.now()
}

/**
 * Check if a date is within allowed range (not too far in future)
 * @param date - Date to check
 * @param maxDaysAhead - Maximum days ahead allowed (default 14)
 * @returns True if date is within range
 */
export function isDateInAllowedRange(date: Date | string, maxDaysAhead = 14): boolean {
 const d = typeof date === 'string' ? new Date(date) : date
 const maxDate = new Date(Date.now() + maxDaysAhead * 24 * 60 * 60 * 1000)
 return d.getTime() <= maxDate.getTime()
}

/**
 * Get timezone display suffix
 * For now always returns GMT, but can be extended for user preferences
 */
export function getTimezoneDisplay(): string {
 return 'GMT'
}