import { Decimal } from '@prisma/client/runtime/library'

/**
 * Converts Prisma Decimal to number
 */
export function decimalToNumber(value: Decimal | null | undefined): number | null {
  return value ? Number(value) : null
}

/**
 * Safely converts Decimal to number with default value
 */
export function decimalToNumberSafe(value: Decimal | null | undefined, defaultValue: number = 0): number {
  return value ? Number(value) : defaultValue
}

/**
 * Formats currency value with proper decimal places
 */
export function formatCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  })
  return formatter.format(amount)
}

/**
 * Converts weight between units
 */
export function convertWeight(value: number, from: 'g' | 'kg' | 'lb', to: 'g' | 'kg' | 'lb'): number {
  // First convert to grams
  let grams = value
  if (from === 'kg') grams = value * 1000
  else if (from === 'lb') grams = value * 453.592
  
  // Then convert to target unit
  if (to === 'g') return grams
  else if (to === 'kg') return grams / 1000
  else if (to === 'lb') return grams / 453.592
  return grams
}

/**
 * Converts dimensions between units
 */
export function convertDimension(value: number, from: 'cm' | 'in' | 'ft', to: 'cm' | 'in' | 'ft'): number {
  // First convert to cm
  let cm = value
  if (from === 'in') cm = value * 2.54
  else if (from === 'ft') cm = value * 30.48
  
  // Then convert to target unit
  if (to === 'cm') return cm
  else if (to === 'in') return cm / 2.54
  else if (to === 'ft') return cm / 30.48
  return cm
}

/**
 * Calculate volume
 */
export function calculateVolume(length: number, width: number, height: number, unit: 'cm³' | 'in³' | 'ft³' = 'cm³'): number {
  const volume = length * width * height
  
  if (unit === 'cm³') return volume
  else if (unit === 'in³') return volume / 16.387
  else if (unit === 'ft³') return volume / 28316.8
  return volume
}

/**
 * Build date filter for Prisma queries
 */
export function buildDateFilter(includeHistorical: boolean = false) {
  if (includeHistorical) {
    return {}
  }
  
  return {
    AND: [
      { effectiveDate: { lte: new Date() } },
      {
        OR: [
          { endDate: null },
          { endDate: { gt: new Date() } }
        ]
      }
    ]
  }
}

/**
 * Category mapping for referral fees
 */
export const CATEGORY_MAPPINGS: Record<string, string[]> = {
  'electronics': ['Consumer Electronics', 'Computers', 'Electronics', 'PC', 'Wireless'],
  'home-garden': ['Home & Garden', 'Home', 'Garden', 'DIY & Tools', 'Kitchen', 'Furniture'],
  'clothing': ['Clothing', 'Clothing, Eyewear, Shoes and Bags', 'Apparel', 'Shoes', 'Jewelry'],
  'toys': ['Toys & Games', 'Toys', 'Games', 'Baby Products'],
  'sports': ['Sports & Outdoors', 'Sports', 'Outdoors', 'Athletic'],
  'beauty': ['Beauty', 'Beauty & Personal Care', 'Health & Beauty', 'Personal Care'],
  'books': ['Books', 'Media', 'Kindle', 'Audible'],
  'automotive': ['Automotive', 'Car & Motorbike', 'Tools & Equipment'],
  'grocery': ['Grocery', 'Food & Beverage', 'Health & Household'],
  'other': ['Everything Else', 'Other', 'Miscellaneous']
}

/**
 * Get category patterns for a given category key
 */
export function getCategoryPatterns(categoryKey: string): string[] {
  return CATEGORY_MAPPINGS[categoryKey.toLowerCase()] || CATEGORY_MAPPINGS['other']
}

/**
 * Error response helper
 */
export function errorResponse(message: string, status: number = 500) {
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

/**
 * Validate required fields
 */
export function validateRequiredFields<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T)[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(String(field))
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * Parse comma-separated values from query string
 */
export function parseCommaSeparated(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map(v => v.trim()).filter(Boolean)
}

/**
 * Safe number parsing with default
 */
export function parseNumberSafe(value: string | null, defaultValue: number | null = null): number | null {
  if (!value) return defaultValue
  const parsed = parseFloat(value)
  return isNaN(parsed) ? defaultValue : parsed
}