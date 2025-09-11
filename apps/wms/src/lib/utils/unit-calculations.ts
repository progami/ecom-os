/**
 * Utility functions for consistent unit calculations across the system
 */

/**
 * Calculate units from cartons using transaction-specific or SKU default units per carton
 * This ensures historical accuracy by preferring transaction-captured values
 */
export function calculateUnits(
  cartons: number,
  transaction?: { unitsPerCarton?: number | null },
  sku?: { unitsPerCarton?: number | null }
): number {
  // Priority: transaction value > SKU value > default of 1
  const unitsPerCarton = transaction?.unitsPerCarton ?? sku?.unitsPerCarton ?? 1
  return Math.max(0, cartons * unitsPerCarton)
}

/**
 * Calculate units for inventory transactions with proper fallback logic
 */
export function calculateTransactionUnits(
  transaction: {
    cartonsIn: number
    cartonsOut: number
    unitsPerCarton?: number | null
  },
  sku?: { unitsPerCarton?: number | null }
): {
  unitsIn: number
  unitsOut: number
  netUnits: number
} {
  const unitsPerCarton = transaction.unitsPerCarton ?? sku?.unitsPerCarton ?? 1
  const unitsIn = transaction.cartonsIn * unitsPerCarton
  const unitsOut = transaction.cartonsOut * unitsPerCarton
  
  return {
    unitsIn,
    unitsOut,
    netUnits: unitsIn - unitsOut
  }
}

/**
 * Get the effective units per carton for a transaction or SKU
 * Returns the value and its source for transparency
 */
export function getEffectiveUnitsPerCarton(
  transaction?: { unitsPerCarton?: number | null },
  sku?: { unitsPerCarton?: number | null }
): {
  value: number
  source: 'transaction' | 'sku' | 'default'
} {
  if (transaction?.unitsPerCarton) {
    return { value: transaction.unitsPerCarton, source: 'transaction' }
  }
  
  if (sku?.unitsPerCarton) {
    return { value: sku.unitsPerCarton, source: 'sku' }
  }
  
  return { value: 1, source: 'default' }
}

/**
 * Calculate pallet count from cartons
 */
export function calculatePallets(
  cartons: number,
  cartonsPerPallet: number | null | undefined
): number {
  if (!cartonsPerPallet || cartonsPerPallet <= 0 || cartons <= 0) {
    return 0
  }
  
  return Math.ceil(cartons / cartonsPerPallet)
}

/**
 * Validate units per carton value
 */
export function validateUnitsPerCarton(value: unknown): {
  valid: boolean
  value: number | null
  error?: string
} {
  if (value === null || value === undefined || value === '') {
    return { valid: true, value: null }
  }
  
  const numValue = Number(value)
  
  if (isNaN(numValue)) {
    return { valid: false, value: null, error: 'Units per carton must be a number' }
  }
  
  if (numValue <= 0) {
    return { valid: false, value: null, error: 'Units per carton must be greater than 0' }
  }
  
  if (!Number.isInteger(numValue)) {
    return { valid: false, value: null, error: 'Units per carton must be a whole number' }
  }
  
  if (numValue > 10000) {
    return { valid: false, value: null, error: 'Units per carton seems unreasonably high (max 10,000)' }
  }
  
  return { valid: true, value: numValue }
}