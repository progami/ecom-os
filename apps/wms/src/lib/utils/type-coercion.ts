/**
 * Type coercion utilities for safely converting unknown values to typed values.
 * Used primarily in API routes for parsing request bodies.
 */

/**
 * Type guard to check if a value is a record (non-null object)
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Coerce unknown value to string, returns undefined if not a non-empty string
 */
export const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined

/**
 * Coerce unknown value to number, returns undefined if not a finite number
 */
export const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

/**
 * Coerce unknown value to boolean, handles string 'true'/'false'
 */
export const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return undefined
}

/**
 * Coerce unknown value to number, handles both number and string input
 */
export const asNumeric = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/**
 * Parse a date string and return Date or null if invalid
 */
export const parseDateValue = (value?: string | null): Date | null => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Coerce unknown value to array, returns empty array if not an array
 */
export const asArray = <T = unknown>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[]
  }
  return []
}

/**
 * Coerce unknown value to integer, returns undefined if not a valid integer
 */
export const asInteger = (value: unknown): number | undefined => {
  const num = asNumeric(value)
  if (num === undefined) return undefined
  return Number.isInteger(num) ? num : undefined
}

/**
 * Coerce unknown value to positive number, returns undefined if not positive
 */
export const asPositiveNumber = (value: unknown): number | undefined => {
  const num = asNumeric(value)
  if (num === undefined || num <= 0) return undefined
  return num
}

/**
 * Coerce unknown value to non-negative number, returns undefined if negative
 */
export const asNonNegativeNumber = (value: unknown): number | undefined => {
  const num = asNumeric(value)
  if (num === undefined || num < 0) return undefined
  return num
}

/**
 * Parse a string value to ISO date string, returns null if invalid
 */
export const asIsoDateString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}
