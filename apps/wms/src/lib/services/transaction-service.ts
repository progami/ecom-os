/**
 * Transaction Service
 * Centralizes all transaction creation logic including cost handling
 * This replaces the confusing "trigger" pattern with a clear service layer
 */

import { prisma } from '@/lib/prisma'
import { Prisma, TransactionType } from '@prisma/client'
import { handleTransactionCosts } from '@/lib/events/transaction-cost-handler'

interface TransactionCosts {
  handling?: number
  storage?: number
  custom?: Array<{
    name: string
    amount: number
  }>
}

interface CreateTransactionInput {
  data: Prisma.InventoryTransactionCreateInput
  costs?: TransactionCosts
}

/**
 * Creates an inventory transaction with automatic cost handling
 * This is the single entry point for all transaction creation
 */
export async function createTransaction(input: CreateTransactionInput) {
  const { data, costs } = input
  
  // Create the transaction
  const transaction = await prisma.inventoryTransaction.create({ data })
  
  // Handle costs if provided and transaction type supports them
  if (costs && shouldProcessCosts(transaction.transactionType)) {
    try {
      await handleTransactionCosts({
        transactionId: transaction.id,
        warehouseCode: transaction.warehouseCode,
        skuCode: transaction.skuCode,
        batchLot: transaction.batchLot,
        transactionType: transaction.transactionType,
        transactionDate: transaction.transactionDate,
        cartonsIn: transaction.cartonsIn,
        cartonsOut: transaction.cartonsOut,
        storagePalletsIn: transaction.storagePalletsIn,
        shippingPalletsOut: transaction.shippingPalletsOut,
        storageCartonsPerPallet: transaction.storageCartonsPerPallet,
        shippingCartonsPerPallet: transaction.shippingCartonsPerPallet,
        costs,
        createdByName: transaction.createdByName
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
      const transaction = await tx.inventoryTransaction.create({ 
        data: input.data 
      })
      
      // Handle costs if provided
      if (adjustedCosts && shouldProcessCosts(transaction.transactionType)) {
        // Since we're in a transaction context, we need to handle costs here
        // This would ideally be refactored to use tx instead of prisma
        await handleTransactionCosts({
          transactionId: transaction.id,
          warehouseCode: transaction.warehouseCode,
          skuCode: transaction.skuCode,
          batchLot: transaction.batchLot,
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