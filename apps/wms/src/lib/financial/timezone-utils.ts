import { format, toZonedTime, fromZonedTime } from 'date-fns-tz'
import { parseISO, isValid } from 'date-fns'

// Default timezone for the application
export const DEFAULT_TIMEZONE = 'America/New_York'

// Common warehouse timezones
export const WAREHOUSE_TIMEZONES = {
 'US-EAST': 'America/New_York',
 'US-CENTRAL': 'America/Chicago',
 'US-WEST': 'America/Los_Angeles',
 'UK': 'Europe/London',
 'EU': 'Europe/Berlin',
 'ASIA': 'Asia/Shanghai',
} as const

/**
 * Get current date/time in a specific timezone
 */
export function getCurrentDateTimeInTimezone(timezone: string = DEFAULT_TIMEZONE): Date {
 const now = new Date()
 return toZonedTime(now, timezone)
}

/**
 * Convert a date from one timezone to another
 */
export function convertTimezone(
 date: Date | string,
 fromTimezone: string,
 toTimezone: string
): Date {
 const dateObj = typeof date === 'string' ? parseISO(date) : date
 
 if (!isValid(dateObj)) {
 throw new Error('Invalid date provided')
 }
 
 // Convert to UTC first
 const utcDate = fromZonedTime(dateObj, fromTimezone)
 
 // Then convert to target timezone
 return toZonedTime(utcDate, toTimezone)
}

/**
 * Format a date in a specific timezone
 */
export function formatInTimezone(
 date: Date | string,
 timezone: string,
 formatString: string = 'yyyy-MM-dd HH:mm:ss zzz'
): string {
 const dateObj = typeof date === 'string' ? parseISO(date) : date
 
 if (!isValid(dateObj)) {
 throw new Error('Invalid date provided')
 }
 
 return format(toZonedTime(dateObj, timezone), formatString, { timeZone: timezone })
}

/**
 * Get the start of day in a specific timezone
 */
export function getStartOfDayInTimezone(date: Date, timezone: string): Date {
 const zonedDate = toZonedTime(date, timezone)
 zonedDate.setHours(0, 0, 0, 0)
 return fromZonedTime(zonedDate, timezone)
}

/**
 * Get the end of day in a specific timezone
 */
export function getEndOfDayInTimezone(date: Date, timezone: string): Date {
 const zonedDate = toZonedTime(date, timezone)
 zonedDate.setHours(23, 59, 59, 999)
 return fromZonedTime(zonedDate, timezone)
}

/**
 * Get the billing period dates for a given month/year in a specific timezone
 */
export function getBillingPeriodDates(
 year: number,
 month: number,
 timezone: string = DEFAULT_TIMEZONE
): { start: Date; end: Date } {
 // Create dates in the target timezone
 const startDate = new Date(year, month - 1, 1)
 const endDate = new Date(year, month, 0) // Last day of month
 
 return {
 start: getStartOfDayInTimezone(startDate, timezone),
 end: getEndOfDayInTimezone(endDate, timezone),
 }
}

/**
 * Calculate business days between two dates considering timezone
 */
export function calculateBusinessDays(
 startDate: Date,
 endDate: Date,
 timezone: string = DEFAULT_TIMEZONE
): number {
 let count = 0
 const start = toZonedTime(startDate, timezone)
 const end = toZonedTime(endDate, timezone)
 
 const current = new Date(start)
 while (current <= end) {
 const dayOfWeek = current.getDay()
 if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
 count++
 }
 current.setDate(current.getDate() + 1)
 }
 
 return count
}

/**
 * Get timezone offset in hours
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): number {
 const utcDate = fromZonedTime(date, 'UTC')
 const zonedDate = toZonedTime(utcDate, timezone)
 return (zonedDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60)
}

/**
 * Validate if a timezone string is valid
 */
export function isValidTimezone(timezone: string): boolean {
 try {
 Intl.DateTimeFormat(undefined, { timeZone: timezone })
 return true
 } catch {
 return false
 }
}

/**
 * Get warehouse timezone from warehouse code
 */
export function getWarehouseTimezone(warehouseCode: string): string {
 // Map warehouse codes to timezones
 const warehouseTimezoneMap: Record<string, string> = {
 'NYC': WAREHOUSE_TIMEZONES['US-EAST'],
 'CHI': WAREHOUSE_TIMEZONES['US-CENTRAL'],
 'LAX': WAREHOUSE_TIMEZONES['US-WEST'],
 'LON': WAREHOUSE_TIMEZONES['UK'],
 'BER': WAREHOUSE_TIMEZONES['EU'],
 'SHA': WAREHOUSE_TIMEZONES['ASIA'],
 }
 
 return warehouseTimezoneMap[warehouseCode] || DEFAULT_TIMEZONE
}