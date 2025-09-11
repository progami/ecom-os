// Transaction cost handler - automatically creates cost ledger entries when transactions include costs
import { prisma } from '@/lib/prisma'
import { TransactionType } from '@prisma/client'
import { getValidCostCategories, getCostRate } from '@/lib/cost-validation'

interface TransactionWithCosts {
  transactionId: string
  warehouseCode: string
  skuCode?: string
  batchLot?: string
  transactionType: TransactionType
  transactionDate: Date
  cartonsIn: number
  cartonsOut: number
  storagePalletsIn?: number
  shippingPalletsOut?: number
  storageCartonsPerPallet?: number
  shippingCartonsPerPallet?: number
  costs?: {
    handling?: number
    storage?: number
    custom?: Array<{
      name: string
      amount: number
    }>
  }
  createdByName?: string
}

/**
 * Handles cost calculation for a transaction
 * This is called automatically by Prisma middleware when a transaction is created with costs
 */
export async function handleTransactionCosts(transaction: TransactionWithCosts) {
  try {
    // Only process if costs are provided
    if (!transaction.costs) {
      return
    }

    // Get valid cost categories for this warehouse
    const validCategories = await getValidCostCategories(transaction.warehouseCode)
    if (validCategories.length === 0) {
      // console.warn(`No cost rates defined for warehouse ${transaction.warehouseCode}`)
    }

    const costEntries = []
    
    // Create handling cost entry if provided
    if (transaction.costs.handling && transaction.costs.handling > 0) {
      // Check if Carton category is valid for this warehouse
      if (!validCategories.includes('Carton')) {
        // console.warn(`Carton costs not configured for warehouse ${transaction.warehouseCode}`)
      } else {
        const costName = transaction.transactionType === 'RECEIVE' ? 'Inbound Handling' : 'Outbound Handling'
        // Try to get the actual rate
        const rate = await getCostRate(transaction.warehouseCode, 'Carton', costName)
        
        costEntries.push({
          transactionId: transaction.transactionId,
          costCategory: 'Carton' as const,
          costName: rate?.costName || costName,
          quantity: transaction.cartonsIn || transaction.cartonsOut,
          unitRate: transaction.costs.handling / (transaction.cartonsIn || transaction.cartonsOut || 1),
          totalCost: transaction.costs.handling,
          warehouseCode: transaction.warehouseCode,
          warehouseName: transaction.warehouseCode,
          createdByName: transaction.createdByName || 'System',
          createdAt: transaction.transactionDate
        })
      }
    }
    
    // Create storage cost entry if provided
    if (transaction.costs.storage && transaction.costs.storage > 0) {
      // Check if Storage category is valid for this warehouse
      if (!validCategories.includes('Storage')) {
        // console.warn(`Storage costs not configured for warehouse ${transaction.warehouseCode}`)
      } else {
        const rate = await getCostRate(transaction.warehouseCode, 'Storage', 'Monthly Storage')
        
        costEntries.push({
          transactionId: transaction.transactionId,
          costCategory: 'Storage' as const,
          costName: rate?.costName || 'Storage Fee',
          quantity: transaction.cartonsIn || transaction.cartonsOut,
          unitRate: transaction.costs.storage / (transaction.cartonsIn || transaction.cartonsOut || 1),
          totalCost: transaction.costs.storage,
          warehouseCode: transaction.warehouseCode,
          warehouseName: transaction.warehouseCode,
          createdByName: transaction.createdByName || 'System',
          createdAt: transaction.transactionDate
        })
      }
    }
    
    // Create custom cost entries if provided
    if (transaction.costs.custom && Array.isArray(transaction.costs.custom)) {
      for (const customCost of transaction.costs.custom) {
        if (customCost.amount && customCost.amount > 0) {
          // Custom costs should only be created if a matching cost rate exists
          // OR if Accessorial category is configured
          if (validCategories.includes('Accessorial')) {
            costEntries.push({
              transactionId: transaction.transactionId,
              costCategory: 'Accessorial' as const,
              costName: customCost.name || 'Custom Cost',
              quantity: transaction.cartonsIn || transaction.cartonsOut,
              unitRate: customCost.amount / (transaction.cartonsIn || transaction.cartonsOut || 1),
              totalCost: customCost.amount,
              warehouseCode: transaction.warehouseCode,
              warehouseName: transaction.warehouseCode,
              createdByName: transaction.createdByName || 'System',
              createdAt: transaction.transactionDate
            })
          } else {
            // console.warn(`Cannot add custom cost "${customCost.name}" - Accessorial category not configured for warehouse ${transaction.warehouseCode}`)
          }
        }
      }
    }
    
    // Create all cost ledger entries
    // Note: We use individual creates instead of createMany to ensure createdAt is set correctly
    if (costEntries.length > 0) {
      for (const entry of costEntries) {
        await prisma.costLedger.create({
          data: entry
        })
      }
    }
    
    return Promise.resolve()
  } catch (_error) {
    // console.error('Error creating cost ledger entries:', _error)
    throw _error
  }
}

/**
 * Determines if costs should be calculated for a transaction type
 */
export function shouldHandleCosts(transactionType: TransactionType): boolean {
  // Calculate costs for RECEIVE and SHIP transactions
  return transactionType === 'RECEIVE' || transactionType === 'SHIP'
}

/**
 * Validates that a transaction has required fields for cost calculation
 */
export function isValidForCostCalculation(transaction: unknown): boolean {
  const tx = transaction as Record<string, unknown>
  return !!(
    tx.transactionId &&
    tx.warehouseCode &&
    (Number(tx.cartonsIn) > 0 || Number(tx.cartonsOut) > 0)
  )
}