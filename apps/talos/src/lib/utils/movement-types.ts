/**
 * Movement type utilities for inventory transactions.
 * Determines whether a transaction is positive (inbound), negative (outbound), or net-zero.
 */

export type MovementType = 'positive' | 'negative' | 'netZero'

const NEGATIVE_MOVEMENT_TYPES = new Set([
  'SHIP',
  'TRANSFER_OUT',
  'ADJUST_OUT',
  'ADJUSTMENT_OUT',
  'WRITE_OFF',
])

const POSITIVE_MOVEMENT_TYPES = new Set([
  'RECEIVE',
  'TRANSFER_IN',
  'ADJUST_IN',
  'ADJUSTMENT_IN',
  'RETURN',
  'RETURN_IN',
])

/**
 * Determine the movement type from a transaction type string.
 */
export function getMovementTypeFromTransaction(type?: string | null): MovementType {
  if (!type) {
    return 'netZero'
  }
  const normalized = type.toUpperCase()
  if (NEGATIVE_MOVEMENT_TYPES.has(normalized)) {
    return 'negative'
  }
  if (POSITIVE_MOVEMENT_TYPES.has(normalized)) {
    return 'positive'
  }
  return 'netZero'
}

/**
 * Get the multiplier for a movement type (-1, 0, or 1).
 */
export function getMovementMultiplier(type?: string | null): number {
  const movement = getMovementTypeFromTransaction(type)
  if (movement === 'negative') return -1
  if (movement === 'positive') return 1
  return 0
}
