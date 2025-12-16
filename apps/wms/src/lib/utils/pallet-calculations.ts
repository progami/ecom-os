/**
 * Pallet calculation utilities for inventory transactions.
 * These functions handle the logic for calculating storage and shipping pallet counts.
 */

export type TransactionTypeForPallets = 'RECEIVE' | 'SHIP' | 'ADJUST_IN' | 'ADJUST_OUT'

export interface PalletCalculationInput {
  transactionType: TransactionTypeForPallets
  cartons: number
  storageCartonsPerPallet?: number | null
  shippingCartonsPerPallet?: number | null
  providedStoragePallets?: number
  providedShippingPallets?: number
  providedPallets?: number
}

export interface PalletCalculationResult {
  storagePalletsIn: number
  shippingPalletsOut: number
}

/**
 * Calculate the number of storage pallets based on cartons and cartons per pallet
 */
export function calculateStoragePallets(
  cartons: number,
  cartonsPerPallet: number | null | undefined
): number {
  if (!cartonsPerPallet || cartonsPerPallet <= 0) {
    return 0
  }
  return Math.ceil(cartons / Math.max(1, cartonsPerPallet))
}

/**
 * Calculate the number of shipping pallets based on cartons and cartons per pallet
 */
export function calculateShippingPallets(
  cartons: number,
  cartonsPerPallet: number | null | undefined
): number {
  if (!cartonsPerPallet || cartonsPerPallet <= 0) {
    return 0
  }
  return Math.ceil(cartons / Math.max(1, cartonsPerPallet))
}

/**
 * Determine if a transaction type is inbound (RECEIVE or ADJUST_IN)
 */
export function isInboundTransaction(transactionType: TransactionTypeForPallets): boolean {
  return transactionType === 'RECEIVE' || transactionType === 'ADJUST_IN'
}

/**
 * Determine if a transaction type is outbound (SHIP or ADJUST_OUT)
 */
export function isOutboundTransaction(transactionType: TransactionTypeForPallets): boolean {
  return transactionType === 'SHIP' || transactionType === 'ADJUST_OUT'
}

/**
 * Calculate final pallet values for a transaction, considering overrides and calculated values.
 *
 * For inbound transactions (RECEIVE, ADJUST_IN):
 * - Uses storagePalletsIn (or provided override)
 * - Sets shippingPalletsOut to 0
 *
 * For outbound transactions (SHIP, ADJUST_OUT):
 * - Uses shippingPalletsOut (or provided override)
 * - Sets storagePalletsIn to 0
 */
export function calculatePalletValues(input: PalletCalculationInput): PalletCalculationResult {
  const {
    transactionType,
    cartons,
    storageCartonsPerPallet,
    shippingCartonsPerPallet,
    providedStoragePallets,
    providedShippingPallets,
    providedPallets,
  } = input

  const isInbound = isInboundTransaction(transactionType)
  const isOutbound = isOutboundTransaction(transactionType)

  // Storage pallets (for inbound)
  let storagePalletsIn = 0
  if (isInbound) {
    const calculatedStorage = calculateStoragePallets(cartons, storageCartonsPerPallet)
    const hasStorageOverride = providedStoragePallets !== undefined || providedPallets !== undefined
    const overrideValue = Number(providedStoragePallets ?? providedPallets ?? 0)
    storagePalletsIn = hasStorageOverride ? overrideValue : calculatedStorage
  }

  // Shipping pallets (for outbound)
  let shippingPalletsOut = 0
  if (isOutbound) {
    const calculatedShipping = calculateShippingPallets(cartons, shippingCartonsPerPallet)
    const hasShippingOverride = providedShippingPallets !== undefined || providedPallets !== undefined
    const overrideValue = Number(providedShippingPallets ?? providedPallets ?? 0)
    shippingPalletsOut = hasShippingOverride ? overrideValue : calculatedShipping
  }

  return {
    storagePalletsIn,
    shippingPalletsOut,
  }
}
