import { prisma } from '@/lib/prisma'

/**
 * Update inventory balances based on transactions
 * This is the equivalent of the "inventory balance" calculated sheet in Excel
 */
export async function updateInventoryBalances(warehouseId?: string) {
  console.log('🔄 Updating inventory balances...')
  
  // Get warehouse filter
  const warehouseFilter = warehouseId ? { warehouseId } : {}
  
  // Get all unique combinations from transactions
  const combinations = await prisma.inventoryTransaction.groupBy({
    by: ['warehouseId', 'skuId', 'batchLot'],
    where: warehouseFilter,
  })
  
  let updated = 0
  
  for (const combo of combinations) {
    // Calculate current balance from all transactions
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        warehouseId: combo.warehouseId,
        skuId: combo.skuId,
        batchLot: combo.batchLot,
      },
      orderBy: { transactionDate: 'asc' }
    })
    
    // Calculate running balance and get batch config from first receive
    let balance = 0
    let lastTransactionDate: Date | null = null
    let storageCartonsPerPallet: number | null = null
    let shippingCartonsPerPallet: number | null = null
    
    for (const transaction of transactions) {
      balance += transaction.cartonsIn - transaction.cartonsOut
      lastTransactionDate = transaction.transactionDate
      
      // Capture batch-specific config from first RECEIVE transaction
      if (transaction.transactionType === 'RECEIVE' && 
          transaction.storageCartonsPerPallet && 
          transaction.shippingCartonsPerPallet &&
          !storageCartonsPerPallet) {
        storageCartonsPerPallet = transaction.storageCartonsPerPallet
        shippingCartonsPerPallet = transaction.shippingCartonsPerPallet
      }
    }
    
    // Never allow negative balance
    balance = Math.max(0, balance)
    
    // Get SKU info for unit calculation
    const sku = await prisma.sku.findUnique({
      where: { id: combo.skuId }
    })
    
    // If no batch config found, fall back to warehouse config
    if (!storageCartonsPerPallet || !shippingCartonsPerPallet) {
      const warehouseConfig = await prisma.warehouseSkuConfig.findFirst({
        where: {
          warehouseId: combo.warehouseId,
          skuId: combo.skuId,
          OR: [
            { endDate: null },
            { endDate: { gte: new Date() } }
          ]
        },
        orderBy: { effectiveDate: 'desc' }
      })
      
      storageCartonsPerPallet = warehouseConfig?.storageCartonsPerPallet || null
      shippingCartonsPerPallet = warehouseConfig?.shippingCartonsPerPallet || null
    }
    
    const currentPallets = storageCartonsPerPallet && balance > 0
      ? Math.ceil(balance / storageCartonsPerPallet)
      : 0
    
    // Update or create balance record
    await prisma.inventoryBalance.upsert({
      where: {
        warehouseId_skuId_batchLot: {
          warehouseId: combo.warehouseId,
          skuId: combo.skuId,
          batchLot: combo.batchLot,
        }
      },
      update: {
        currentCartons: balance,
        currentPallets,
        currentUnits: balance * (sku?.unitsPerCarton || 1),
        storageCartonsPerPallet,
        shippingCartonsPerPallet,
        lastTransactionDate,
      },
      create: {
        warehouseId: combo.warehouseId,
        skuId: combo.skuId,
        batchLot: combo.batchLot,
        currentCartons: balance,
        currentPallets,
        currentUnits: balance * (sku?.unitsPerCarton || 1),
        storageCartonsPerPallet,
        shippingCartonsPerPallet,
        lastTransactionDate,
      }
    })
    
    updated++
  }
  
  // Remove zero-balance records (optional, depending on business requirements)
  await prisma.inventoryBalance.deleteMany({
    where: {
      ...warehouseFilter,
      currentCartons: 0
    }
  })
  
  console.log(`✅ Updated ${updated} inventory balance records`)
  return updated
}

/**
 * Get inventory balance summary by warehouse
 */
export async function getInventorySummary(warehouseId?: string) {
  const warehouseFilter = warehouseId ? { warehouseId } : {}
  
  const summary = await prisma.inventoryBalance.aggregate({
    where: warehouseFilter,
    _sum: {
      currentCartons: true,
      currentPallets: true,
      currentUnits: true,
    },
    _count: {
      skuId: true,
    }
  })
  
  const uniqueSkus = await prisma.inventoryBalance.groupBy({
    by: ['skuId'],
    where: warehouseFilter,
  })
  
  return {
    totalCartons: summary._sum.currentCartons || 0,
    totalPallets: summary._sum.currentPallets || 0,
    totalUnits: summary._sum.currentUnits || 0,
    uniqueSkus: uniqueSkus.length,
    totalItems: summary._count.skuId,
  }
}

/**
 * Get inventory movements for a period
 */
export async function getInventoryMovements(
  startDate: Date,
  endDate: Date,
  warehouseId?: string
) {
  const warehouseFilter = warehouseId ? { warehouseId } : {}
  
  const movements = await prisma.inventoryTransaction.findMany({
    where: {
      ...warehouseFilter,
      transactionDate: {
        gte: startDate,
        lte: endDate,
      }
    },
    include: {
      warehouse: true,
      sku: true,
      createdBy: true,
    },
    orderBy: { transactionDate: 'desc' }
  })
  
  // Calculate summary
  const summary = movements.reduce((acc, mov) => {
    acc.totalIn += mov.cartonsIn
    acc.totalOut += mov.cartonsOut
    return acc
  }, { totalIn: 0, totalOut: 0 })
  
  return {
    movements,
    summary: {
      ...summary,
      netChange: summary.totalIn - summary.totalOut,
      transactionCount: movements.length,
    }
  }
}