import { prisma } from '@/lib/prisma'
import { endOfWeek } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { getStorageRate, calculateStorageCost, type StorageRateResult } from './storageRate.service'

interface RecordStorageCostParams {
  warehouseCode: string
  warehouseName: string
  skuCode: string
  skuDescription: string
  batchLot: string
  transactionDate: Date
}

/**
 * Record a storage cost entry for a specific batch in a given week
 * This function is called on every inventory transaction to ensure
 * storage costs are captured when inventory first appears in a week
 */
export async function recordStorageCostEntry({
  warehouseCode,
  warehouseName,
  skuCode,
  skuDescription,
  batchLot,
  transactionDate
}: RecordStorageCostParams) {
  const weekEndingDate = endOfWeek(transactionDate, { weekStartsOn: 1 })

  // Check if entry already exists for this week
  const existing = await prisma.storageLedger.findUnique({
    where: {
      warehouseCode_skuCode_batchLot_weekEndingDate: {
        warehouseCode,
        skuCode,
        batchLot,
        weekEndingDate
      }
    }
  })

  if (existing) {
    return existing
  }

  // Calculate current inventory balance for this batch
  const aggregate = await prisma.inventoryTransaction.aggregate({
    _sum: {
      cartonsIn: true,
      cartonsOut: true
    },
    where: {
      warehouseCode,
      skuCode,
      batchLot,
      transactionDate: { lte: transactionDate }
    }
  })

  const closingBalance = 
    Number(aggregate._sum.cartonsIn || 0) - Number(aggregate._sum.cartonsOut || 0)

  // Skip if no inventory (batch was completely shipped out)
  if (closingBalance <= 0) {
    return null
  }

  // Attempt to get storage rate and calculate cost
  let storageRate: StorageRateResult | null = null
  let totalCost: number = 0
  let isCostCalculated = false

  try {
    storageRate = await getStorageRate(warehouseCode, weekEndingDate)
    if (storageRate) {
      totalCost = await calculateStorageCost(closingBalance, storageRate.ratePerCarton)
      isCostCalculated = true
    }
  } catch (error) {
    console.warn(`Storage rate lookup failed for ${warehouseCode}:`, error.message)
    // Continue without cost calculation - entry will be marked as pending
  }

  // Create storage ledger entry with or without cost calculation
  return prisma.storageLedger.create({
    data: {
      storageLedgerId: uuidv4(),
      warehouseCode,
      warehouseName,
      skuCode,
      skuDescription,
      batchLot,
      weekEndingDate,
      openingBalance: closingBalance,
      weeklyReceive: 0,
      weeklyShip: 0,
      weeklyAdjust: 0,
      closingBalance,
      averageBalance: closingBalance,
      dailyBalanceData: null,
      // Storage cost fields
      storageRatePerCarton: storageRate?.ratePerCarton || null,
      totalStorageCost: totalCost || null,
      rateEffectiveDate: storageRate?.effectiveDate || null,
      costRateId: storageRate?.costRateId || null,
      isCostCalculated,
      createdByName: 'System'
    }
  })
}

/**
 * Ensure all batches with positive inventory have storage ledger entries for a given week
 * This is run as a weekly batch process to catch any missed entries
 */
export async function ensureWeeklyStorageEntries(date: Date = new Date()) {
  const weekEndingDate = endOfWeek(date, { weekStartsOn: 1 })

  // Get all batches with positive inventory balances
  const aggregates = await prisma.inventoryTransaction.groupBy({
    by: ['warehouseCode', 'warehouseName', 'skuCode', 'skuDescription', 'batchLot'],
    _sum: { cartonsIn: true, cartonsOut: true },
    where: { transactionDate: { lte: date } }
  })

  let processed = 0
  let costCalculated = 0
  let skipped = 0
  let errors: string[] = []

  for (const agg of aggregates) {
    const closingBalance = 
      Number(agg._sum.cartonsIn || 0) - Number(agg._sum.cartonsOut || 0)
    
    // Skip batches with no inventory
    if (closingBalance <= 0) {
      skipped++
      continue
    }

    try {
      // Check if entry already exists
      const exists = await prisma.storageLedger.findUnique({
        where: {
          warehouseCode_skuCode_batchLot_weekEndingDate: {
            warehouseCode: agg.warehouseCode,
            skuCode: agg.skuCode,
            batchLot: agg.batchLot,
            weekEndingDate
          }
        }
      })

      if (!exists) {
        const result = await recordStorageCostEntry({
          warehouseCode: agg.warehouseCode,
          warehouseName: agg.warehouseName,
          skuCode: agg.skuCode,
          skuDescription: agg.skuDescription,
          batchLot: agg.batchLot,
          transactionDate: date
        })

        if (result) {
          processed++
          if (result.isCostCalculated) {
            costCalculated++
          }
        }
      }
    } catch (error) {
      const errorMsg = `${agg.warehouseCode}/${agg.skuCode}/${agg.batchLot}: ${error.message}`
      errors.push(errorMsg)
      console.error('Storage entry creation failed:', errorMsg)
    }
  }

  return { 
    processed, 
    costCalculated, 
    skipped, 
    errors,
    weekEndingDate: weekEndingDate.toISOString()
  }
}

/**
 * Recalculate storage costs for existing entries that don't have costs
 * This can be run after storage rates are updated
 */
export async function recalculateStorageCosts(
  weekEndingDate?: Date,
  warehouseCode?: string
): Promise<{
  recalculated: number
  errors: string[]
}> {
  const where: any = {
    isCostCalculated: false
  }
  
  if (weekEndingDate) {
    where.weekEndingDate = weekEndingDate
  }
  
  if (warehouseCode) {
    where.warehouseCode = warehouseCode
  }

  // Get all entries without costs
  const entriesWithoutCosts = await prisma.storageLedger.findMany({
    where,
    select: {
      id: true,
      warehouseCode: true,
      closingBalance: true,
      weekEndingDate: true
    }
  })

  let recalculated = 0
  const errors: string[] = []

  for (const entry of entriesWithoutCosts) {
    try {
      const storageRate = await getStorageRate(entry.warehouseCode, entry.weekEndingDate)
      
      if (storageRate) {
        const totalCost = await calculateStorageCost(entry.closingBalance, storageRate.ratePerCarton)
        
        await prisma.storageLedger.update({
          where: { id: entry.id },
          data: {
            storageRatePerCarton: storageRate.ratePerCarton,
            totalStorageCost: totalCost,
            rateEffectiveDate: storageRate.effectiveDate,
            costRateId: storageRate.costRateId,
            isCostCalculated: true
          }
        })
        
        recalculated++
      }
    } catch (error) {
      errors.push(`Entry ${entry.id}: ${error.message}`)
    }
  }

  return { recalculated, errors }
}

/**
 * Get storage cost summary for a date range
 */
export async function getStorageCostSummary(
  startDate: Date,
  endDate: Date,
  warehouseCode?: string
) {
  const where: any = {
    weekEndingDate: {
      gte: startDate,
      lte: endDate
    }
  }
  
  if (warehouseCode) {
    where.warehouseCode = warehouseCode
  }

  const summary = await prisma.storageLedger.aggregate({
    _count: {
      id: true,
      totalStorageCost: true
    },
    _sum: {
      closingBalance: true,
      totalStorageCost: true
    },
    where
  })

  return {
    totalEntries: summary._count.id || 0,
    entriesWithCosts: summary._count.totalStorageCost || 0,
    totalCartons: Number(summary._sum.closingBalance || 0),
    totalStorageCost: Number(summary._sum.totalStorageCost || 0),
    costCalculationRate: summary._count.id > 0 
      ? ((summary._count.totalStorageCost || 0) / summary._count.id * 100).toFixed(1)
      : '0'
  }
}