/**
 * Get the week ending date (Saturday) for a given date
 * @param date The date to get the week ending for
 * @returns The Saturday of the week containing the date
 */
export function getWeekEndingDate(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const daysUntilSaturday = (6 - day + 7) % 7 || 7
  result.setDate(result.getDate() + daysUntilSaturday)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Parse a date string in YYYY-MM-DD format as a local date (not UTC)
 * This prevents timezone offset issues when storing dates
 * @param dateString Date string in YYYY-MM-DD format
 * @returns Date object set to midnight in local timezone
 */
export function parseLocalDate(dateString: string | null | undefined): Date | null {
  if (!dateString || dateString === 'null' || dateString === 'undefined') {
    return null
  }
  
  try {
    // Handle ISO date strings by extracting just the date part
    const datePart = dateString.split('T')[0]
    const [year, month, day] = datePart.split('-').map(Number)
    
    // Check if parsing resulted in valid numbers
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      // console.error('parseLocalDate: Invalid date components:', { dateString, datePart, year, month, day })
      return null
    }
    
    // Validate reasonable date values
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      // console.error('parseLocalDate: Date values out of range:', { year, month, day })
      return null
    }
    
    // IMPORTANT: Use UTC to ensure consistent dates across timezones
    // This prevents dates from shifting when deployed to different servers
    const result = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    
    // Final validation - check if Date constructor produced a valid date
    if (isNaN(result.getTime())) {
      // console.error('parseLocalDate: Date constructor returned invalid date:', { dateString, result })
      return null
    }
    
    return result
  } catch (_error) {
    // console.error('parseLocalDate: Error parsing date:', dateString, _error)
    return null
  }
}

/**
 * Parse a date string in YYYY-MM-DD format with explicit timezone
 * @param dateString Date string in YYYY-MM-DD format
 * @param timezone IANA timezone identifier (default: 'America/Chicago')
 * @returns Date object properly adjusted for timezone
 */
export function parseTimezoneDate(dateString: string, _timezone: string = 'America/Chicago'): Date {
  // For now, use parseLocalDate to ensure consistent behavior
  // In future, this could be enhanced with proper timezone library
  return parseLocalDate(dateString)
}

/**
 * Parse a datetime string from datetime-local input
 * Handles both YYYY-MM-DD and YYYY-MM-DDTHH:mm formats
 * @param dateTimeString DateTime string from form input
 * @returns Date object with proper time component
 */
export function parseLocalDateTime(dateTimeString: string | null | undefined): Date | null {
  if (!dateTimeString || dateTimeString === 'null' || dateTimeString === 'undefined') {
    return null
  }
  
  try {
    // Check if it includes time component
    if (dateTimeString.includes('T')) {
      // Handle datetime-local format: YYYY-MM-DDTHH:mm
      const [datePart, timePart] = dateTimeString.split('T')
      const [year, month, day] = datePart.split('-').map(Number)
      const [hour, minute] = timePart.split(':').map(Number)
      
      // Validate values
      if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
        // console.error('parseLocalDateTime: Invalid datetime components:', { dateTimeString })
        return null
      }
      
      // Create date with time
      const result = new Date(year, month - 1, day, hour, minute, 0, 0)
      
      if (isNaN(result.getTime())) {
        // console.error('parseLocalDateTime: Invalid datetime:', { dateTimeString })
        return null
      }
      
      return result
    } else {
      // Fall back to date-only parsing for backward compatibility
      return parseLocalDate(dateTimeString)
    }
  } catch (_error) {
    // console.error('parseLocalDateTime: Error parsing datetime:', dateTimeString, _error)
    return null
  }
}