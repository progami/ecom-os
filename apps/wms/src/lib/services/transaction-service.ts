/**
 * Transaction Service
 * Centralizes all transaction creation logic including cost handling
 * This replaces the confusing "trigger" pattern with a clear service layer
 */

import { prisma } from '@/lib/prisma'
import { Prisma, TransactionType } from '@ecom-os/prisma-wms'
import { addMinutes } from 'date-fns'
import { handleTransactionCosts } from '@/lib/events/transaction-cost-handler'
import {
 ensurePurchaseOrderForTransaction,
 EnsurePurchaseOrderForTransactionInput,
} from '@/lib/services/purchase-order-service'

interface TransactionCosts {
 handling?: number
 storage?: number
 custom?: Array<{
 name: string
 amount: number
 }>
}

interface CreateTransactionInput {
 data: Prisma.InventoryTransactionUncheckedCreateInput
 costs?: TransactionCosts
 purchaseOrder?: EnsurePurchaseOrderForTransactionInput
}

function hasLinkedPurchaseOrder(data: Prisma.InventoryTransactionUncheckedCreateInput): boolean {
 return data.purchaseOrderId != null || data.purchaseOrderLineId != null
}

/**
 * Creates an inventory transaction with automatic cost handling
 * This is the single entry point for all transaction creation
 */
export async function createTransaction(input: CreateTransactionInput) {
 const { data, costs, purchaseOrder } = input

 const transaction = await prisma.$transaction(async (tx) => {
 const hasPurchaseOrderId = hasLinkedPurchaseOrder(data)

 const poDetails = purchaseOrder
 ? await ensurePurchaseOrderForTransaction(tx, purchaseOrder)
 : null

 if (!poDetails && !hasPurchaseOrderId) {
 throw new Error('Purchase order metadata is required when creating inventory transactions.')
 }

 const transactionData: Prisma.InventoryTransactionUncheckedCreateInput = {
 ...data,
 ...(poDetails
 ? {
 purchaseOrderId: poDetails.purchaseOrderId,
 purchaseOrderLineId: poDetails.purchaseOrderLineId,
 }
 : {}),
 }

 return createInventoryTransactionWithUniqueMinute(tx, transactionData)
 })

 if (costs && shouldProcessCosts(transaction.transactionType)) {
    try {
      await handleTransactionCosts({
        transactionId: transaction.id,
        warehouseCode: transaction.warehouseCode,
        warehouseName: transaction.warehouseName,
        skuCode: transaction.skuCode,
        batchLot: transaction.batchLot,
        purchaseOrderId: transaction.purchaseOrderId,
        transactionType: transaction.transactionType,
        transactionDate: transaction.transactionDate,
        cartonsIn: transaction.cartonsIn,
        cartonsOut: transaction.cartonsOut,
        storagePalletsIn: transaction.storagePalletsIn,
        shippingPalletsOut: transaction.shippingPalletsOut,
        storageCartonsPerPallet: transaction.storageCartonsPerPallet,
        shippingCartonsPerPallet: transaction.shippingCartonsPerPallet,
        costs,
        createdByName: transaction.createdByName,
      })
    } catch (_error) {
      // console.error(`Failed to process costs for transaction ${transaction.id}:`, _error)
      // Don't fail the transaction if cost processing fails
      // This could be sent to an error tracking service
 }
 }

 return transaction
}

/**
 * Creates multiple transactions in a single database transaction
 * with automatic cost handling for each
 */
export async function createTransactionBatch(
 inputs: CreateTransactionInput[],
 splitCosts?: boolean
) {
 return await prisma.$transaction(async (tx) => {
 const results = []
 
 for (const input of inputs) {
 // If splitting costs across multiple items
 let adjustedCosts = input.costs
 if (splitCosts && input.costs && inputs.length > 1) {
 adjustedCosts = {
 handling: input.costs.handling ? input.costs.handling / inputs.length : undefined,
 storage: input.costs.storage ? input.costs.storage / inputs.length : undefined,
 custom: input.costs.custom?.map(c => ({
 name: c.name,
 amount: c.amount / inputs.length
 }))
 }
 }
 
 // Create transaction using the transaction context
 const hasPurchaseOrderId = hasLinkedPurchaseOrder(input.data)

 const poDetails = input.purchaseOrder
 ? await ensurePurchaseOrderForTransaction(tx, input.purchaseOrder)
 : null

 if (!poDetails && !hasPurchaseOrderId) {
 throw new Error('Purchase order metadata is required when creating inventory transactions.')
 }

 const transactionData: Prisma.InventoryTransactionUncheckedCreateInput = {
 ...input.data,
 ...(poDetails
 ? {
 purchaseOrderId: poDetails.purchaseOrderId,
 purchaseOrderLineId: poDetails.purchaseOrderLineId,
 }
 : {}),
 }

 const transaction = await createInventoryTransactionWithUniqueMinute(tx, transactionData)
 
 // Handle costs if provided
 if (adjustedCosts && shouldProcessCosts(transaction.transactionType)) {
 // Since we're in a transaction context, we need to handle costs here
 // This would ideally be refactored to use tx instead of prisma
      await handleTransactionCosts({
        transactionId: transaction.id,
        warehouseCode: transaction.warehouseCode,
        warehouseName: transaction.warehouseName,
        skuCode: transaction.skuCode,
        batchLot: transaction.batchLot,
        purchaseOrderId: transaction.purchaseOrderId,
        transactionType: transaction.transactionType,
        transactionDate: transaction.transactionDate,
        cartonsIn: transaction.cartonsIn,
        cartonsOut: transaction.cartonsOut,
        storagePalletsIn: transaction.storagePalletsIn,
        shippingPalletsOut: transaction.shippingPalletsOut,
        storageCartonsPerPallet: transaction.storageCartonsPerPallet,
        shippingCartonsPerPallet: transaction.shippingCartonsPerPallet,
        costs: adjustedCosts,
        createdByName: transaction.createdByName
      })
    }
 
 results.push(transaction)
 }
 
 return results
 })
}

/**
 * Determines if costs should be processed for a transaction type
 */
function shouldProcessCosts(type: TransactionType): boolean {
 return type === 'RECEIVE' || type === 'SHIP'
}

type TransactionClient = typeof prisma | Prisma.TransactionClient

async function createInventoryTransactionWithUniqueMinute(
 client: TransactionClient,
 data: Prisma.InventoryTransactionUncheckedCreateInput,
 maxAttempts = 30
) {
 const baseDate = normalizeTransactionDate(data.transactionDate)

 for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
 const candidate = addMinutes(baseDate, attempt)
 try {
 return await client.inventoryTransaction.create({
 data: {
 ...data,
 transactionDate: candidate,
 },
 })
 } catch (error) {
 if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
 const target = error.meta?.target
 const isTransactionDateTarget = Array.isArray(target)
 ? target.includes('transaction_date')
 : target === 'transaction_date'

 if (isTransactionDateTarget) {
 continue
 }
 }

 throw error
 }
 }

 throw new Error('Unable to assign a unique transactionDate minute after multiple attempts')
}

function normalizeTransactionDate(value: Date | string | null | undefined) {
 const date = value ? new Date(value) : new Date()
 if (Number.isNaN(date.getTime())) {
 throw new Error('Invalid transactionDate value')
 }
 date.setSeconds(0, 0)
 return date
}
