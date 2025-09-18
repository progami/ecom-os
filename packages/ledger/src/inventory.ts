import {
  InventoryAggregationResult,
  InventoryBalanceSnapshot,
  InventoryTransactionRecord
} from './types'
import { calculatePallets, calculateUnits } from './utils/units'

export interface AggregateInventoryOptions {
  includeZeroStock?: boolean
  sort?: boolean
}

interface BalanceAccumulator extends Omit<InventoryBalanceSnapshot, 'currentUnits' | 'currentPallets'> {
  currentUnits: number
  currentPallets: number
  unitsPerCarton: number
  storageCartonsPerPallet: number | null
  shippingCartonsPerPallet: number | null
  firstReceive?: InventoryBalanceSnapshot['firstReceive']
}

export function aggregateInventoryTransactions(
  transactions: readonly InventoryTransactionRecord[],
  options: AggregateInventoryOptions = {}
): InventoryAggregationResult {
  const balances = new Map<string, BalanceAccumulator>()

  for (const transaction of transactions) {
    const key = [transaction.warehouseCode, transaction.skuCode, transaction.batchLot].join('::')
    let current = balances.get(key)

    if (!current) {
      current = {
        id: key,
        warehouseCode: transaction.warehouseCode,
        warehouseName: transaction.warehouseName,
        skuCode: transaction.skuCode,
        skuDescription: transaction.skuDescription,
        batchLot: transaction.batchLot,
        currentCartons: 0,
        currentUnits: 0,
        currentPallets: 0,
        unitsPerCarton: transaction.unitsPerCarton ?? 1,
        storageCartonsPerPallet: transaction.storageCartonsPerPallet ?? null,
        shippingCartonsPerPallet: transaction.shippingCartonsPerPallet ?? null,
        lastTransactionDate: null,
        firstReceive: undefined
      }
      balances.set(key, current)
    }

    // Update units-per-carton if the transaction provides a more specific value
    if (transaction.unitsPerCarton && transaction.unitsPerCarton > 0) {
      current.unitsPerCarton = transaction.unitsPerCarton
    }

    current.currentCartons += (transaction.cartonsIn || 0) - (transaction.cartonsOut || 0)
    current.currentUnits = calculateUnits(current.currentCartons, current.unitsPerCarton)

    if (!current.lastTransactionDate || current.lastTransactionDate < transaction.transactionDate) {
      current.lastTransactionDate = transaction.transactionDate
    }

    if (transaction.storageCartonsPerPallet && transaction.storageCartonsPerPallet > 0) {
      current.storageCartonsPerPallet = transaction.storageCartonsPerPallet
    }

    if (transaction.shippingCartonsPerPallet && transaction.shippingCartonsPerPallet > 0) {
      current.shippingCartonsPerPallet = transaction.shippingCartonsPerPallet
    }

    if (transaction.transactionType === 'RECEIVE') {
      const shouldUpdateFirstReceive = !current.firstReceive ||
        transaction.transactionDate < current.firstReceive.transactionDate

      if (shouldUpdateFirstReceive) {
        current.firstReceive = {
          transactionDate: transaction.transactionDate,
          createdByName: transaction.createdByName,
          createdById: transaction.createdById
        }
      }
    }
  }

  let balanceArray: InventoryBalanceSnapshot[] = Array.from(balances.values()).map((balance) => {
    const effectiveCartonsPerPallet = resolveCartonsPerPallet(balance)

    const currentPallets = balance.currentCartons > 0
      ? calculatePallets(balance.currentCartons, effectiveCartonsPerPallet)
      : 0

    return {
      ...balance,
      currentUnits: Math.max(0, balance.currentUnits),
      currentPallets,
      storageCartonsPerPallet: balance.storageCartonsPerPallet ?? effectiveCartonsPerPallet,
      shippingCartonsPerPallet: balance.shippingCartonsPerPallet ?? effectiveCartonsPerPallet
    }
  })

  if (!options.includeZeroStock) {
    balanceArray = balanceArray.filter(balance => balance.currentCartons > 0)
  }

  if (options.sort !== false) {
    balanceArray.sort((a, b) => {
      if (a.skuCode !== b.skuCode) {
        return a.skuCode.localeCompare(b.skuCode)
      }
      if (a.batchLot !== b.batchLot) {
        return a.batchLot.localeCompare(b.batchLot)
      }
      return a.warehouseCode.localeCompare(b.warehouseCode)
    })
  }

  const batchesWithInventory = balanceArray.filter(balance => balance.currentCartons > 0).length

  return {
    balances: balanceArray,
    summary: {
      totalSkuCount: new Set(balanceArray.map(balance => balance.skuCode)).size,
      totalBatchCount: balanceArray.length,
      batchesWithInventory,
      batchesOutOfStock: balanceArray.length - batchesWithInventory
    }
  }
}

function resolveCartonsPerPallet(balance: BalanceAccumulator): number {
  if (balance.storageCartonsPerPallet && balance.storageCartonsPerPallet > 0) {
    return balance.storageCartonsPerPallet
  }
  if (balance.shippingCartonsPerPallet && balance.shippingCartonsPerPallet > 0) {
    return balance.shippingCartonsPerPallet
  }
  return 1
}
