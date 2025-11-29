// Transaction cost handler - automatically creates cost ledger entries when transactions include costs
import { prisma } from '@/lib/prisma'
import { TransactionType, PurchaseOrderStatus } from '@ecom-os/prisma-wms'
import { getValidCostCategories } from '@/lib/cost-validation'

interface TransactionWithCosts {
  transactionId: string
  warehouseCode: string
  warehouseName?: string
  skuCode?: string
  batchLot?: string
  purchaseOrderId?: string | null
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

function resolveLedgerQuantity(transaction: TransactionWithCosts): number {
 const cartonsIn = Number(transaction.cartonsIn || 0)
 const cartonsOut = Number(transaction.cartonsOut || 0)
 const cartonQuantity = Math.max(cartonsIn, cartonsOut)
 if (cartonQuantity > 0) {
 return cartonQuantity
 }

 const palletsIn = Number(transaction.storagePalletsIn || 0)
 const palletsOut = Number(transaction.shippingPalletsOut || 0)
 const palletQuantity = Math.max(palletsIn, palletsOut)
 if (palletQuantity > 0) {
 const cartonsPerPallet = Math.max(
 Number(transaction.storageCartonsPerPallet || 0),
 Number(transaction.shippingCartonsPerPallet || 0)
 )

 if (cartonsPerPallet > 0) {
 return palletQuantity * cartonsPerPallet
 }

 return palletQuantity
 }

 return 1
}

async function resolveWarehouseName(transaction: TransactionWithCosts): Promise<string> {
 if (transaction.warehouseName && transaction.warehouseName.trim().length > 0) {
 return transaction.warehouseName
 }

 const warehouse = await prisma.warehouse.findUnique({
 where: { code: transaction.warehouseCode },
 select: { name: true }
 })

 return warehouse?.name ?? transaction.warehouseCode
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

    if (transaction.purchaseOrderId) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: transaction.purchaseOrderId },
        select: { status: true },
      })

      const isFinalized =
        po?.status === PurchaseOrderStatus.POSTED || po?.status === PurchaseOrderStatus.CLOSED

      if (!isFinalized) {
        await prisma.costLedger.deleteMany({ where: { transactionId: transaction.transactionId } })
        return
      }
    }

 // Get valid cost categories for this warehouse
 const validCategories = await getValidCostCategories(transaction.warehouseCode)
 if (validCategories.length === 0) {
 // console.warn(`No cost rates defined for warehouse ${transaction.warehouseCode}`)
 }

 const warehouseName = await resolveWarehouseName(transaction)
 const quantity = resolveLedgerQuantity(transaction)
 const safeQuantity = quantity > 0 ? quantity : 1
 const costEntries = []
 
 // Determine category based on transaction type
 const isInbound = transaction.transactionType === 'RECEIVE'
 const costCategory = isInbound ? 'Inbound' : 'Outbound'

 // Create handling cost entry if provided
 if (transaction.costs.handling && transaction.costs.handling > 0) {
 // Check if category is valid for this warehouse
 if (!validCategories.includes(costCategory)) {
 // console.warn(`${costCategory} costs not configured for warehouse ${transaction.warehouseCode}`)
 } else {
 costEntries.push({
 transactionId: transaction.transactionId,
 costCategory: costCategory as const,
 costName: isInbound ? 'Inbound Handling' : 'Outbound Handling',
 quantity: safeQuantity,
 unitRate: transaction.costs.handling / safeQuantity,
 totalCost: transaction.costs.handling,
 warehouseCode: transaction.warehouseCode,
 warehouseName,
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
 costEntries.push({
 transactionId: transaction.transactionId,
 costCategory: 'Storage' as const,
 costName: 'Storage Cost',
 quantity: safeQuantity,
 unitRate: transaction.costs.storage / safeQuantity,
 totalCost: transaction.costs.storage,
 warehouseCode: transaction.warehouseCode,
 warehouseName,
 createdByName: transaction.createdByName || 'System',
 createdAt: transaction.transactionDate
 })
 }
 }
 
 // Create custom cost entries if provided
 if (transaction.costs.custom && Array.isArray(transaction.costs.custom)) {
 for (const customCost of transaction.costs.custom) {
 if (customCost.amount && customCost.amount > 0) {
 // Custom costs use the same category as the transaction type (Inbound/Outbound)
 if (validCategories.includes(costCategory)) {
 costEntries.push({
 transactionId: transaction.transactionId,
 costCategory: costCategory as const,
 costName: customCost.name || 'Additional Cost',
 quantity: safeQuantity,
 unitRate: customCost.amount / safeQuantity,
 totalCost: customCost.amount,
 warehouseCode: transaction.warehouseCode,
 warehouseName,
 createdByName: transaction.createdByName || 'System',
 createdAt: transaction.transactionDate
 })
 } else {
 // console.warn(`Cannot add custom cost "${customCost.name}" - ${costCategory} category not configured for warehouse ${transaction.warehouseCode}`)
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
