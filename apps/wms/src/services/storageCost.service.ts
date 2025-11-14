import { prisma } from '@/lib/prisma'
import { Prisma, TransactionType } from '@prisma/client'
import { endOfWeek, startOfWeek } from 'date-fns'
import { randomUUID } from 'crypto'
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
 transactionDate,
}: RecordStorageCostParams) {
 const weekEndingDate = endOfWeek(transactionDate, { weekStartsOn: 1 })
 const weekStartingDate = startOfWeek(transactionDate, { weekStartsOn: 1 })

 // Calculate opening balance (inventory prior to the start of the week)
 const openingAggregate = await prisma.inventoryTransaction.aggregate({
 _sum: {
 cartonsIn: true,
 cartonsOut: true,
 },
 where: {
 warehouseCode,
 skuCode,
 batchLot,
 transactionDate: { lt: weekStartingDate },
 },
 })

 const openingBalance =
 Number(openingAggregate._sum.cartonsIn || 0) - Number(openingAggregate._sum.cartonsOut || 0)

 // Gather all transactions for the week to understand weekly movement
 const weeklyTransactions = await prisma.inventoryTransaction.findMany({
 where: {
 warehouseCode,
 skuCode,
 batchLot,
 transactionDate: {
 gte: weekStartingDate,
 lte: weekEndingDate,
 },
 },
 select: {
 transactionType: true,
 cartonsIn: true,
 cartonsOut: true,
 },
 })

 let weeklyReceive = 0
 let weeklyShip = 0
 let weeklyAdjust = 0

 for (const movement of weeklyTransactions) {
 const inValue = Number(movement.cartonsIn || 0)
 const outValue = Number(movement.cartonsOut || 0)

 switch (movement.transactionType) {
 case TransactionType.RECEIVE:
 weeklyReceive += inValue
 break
 case TransactionType.SHIP:
 weeklyShip += outValue
 break
 case TransactionType.ADJUST_IN:
 weeklyAdjust += inValue
 break
 case TransactionType.ADJUST_OUT:
 weeklyAdjust -= outValue
 break
 default:
 weeklyAdjust += inValue - outValue
 break
 }
 }

 const closingBalance = openingBalance + weeklyReceive - weeklyShip + weeklyAdjust
 const normalizedClosingBalance = Math.max(0, closingBalance)
 const averageBalance = Math.max(0, (openingBalance + normalizedClosingBalance) / 2)

 const hasMovement =
 openingBalance !== 0 || weeklyReceive !== 0 || weeklyShip !== 0 || weeklyAdjust !== 0

 if (!hasMovement) {
 return null
 }

 const existing = await prisma.storageLedger.findUnique({
 where: {
 warehouseCode_skuCode_batchLot_weekEndingDate: {
 warehouseCode,
 skuCode,
 batchLot,
 weekEndingDate,
 },
 },
 })

 let storageRate: StorageRateResult | null = null
 let ratePerCarton: number | null = existing?.storageRatePerCarton
 ? Number(existing.storageRatePerCarton)
 : null
 let rateEffectiveDate = existing?.rateEffectiveDate ?? null
 let costRateId = existing?.costRateId ?? null
 let isCostCalculated = existing?.isCostCalculated ?? false

 if (ratePerCarton === null) {
 try {
 storageRate = await getStorageRate(warehouseCode, weekEndingDate)
 if (storageRate) {
 ratePerCarton = storageRate.ratePerCarton
 rateEffectiveDate = storageRate.effectiveDate
 costRateId = storageRate.costRateId ?? null
 }
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Unknown error'
 console.warn(`Storage rate lookup failed for ${warehouseCode}:`, message)
 }
 }

 let totalCost: number | null = null
 if (ratePerCarton !== null) {
 totalCost = await calculateStorageCost(averageBalance, ratePerCarton)
 isCostCalculated = true
 }

 if (existing) {
 return prisma.storageLedger.update({
 where: { id: existing.id },
 data: {
 warehouseName,
 skuDescription,
 openingBalance,
 weeklyReceive,
 weeklyShip,
 weeklyAdjust,
 closingBalance: normalizedClosingBalance,
 averageBalance,
 storageRatePerCarton: ratePerCarton,
 totalStorageCost: totalCost,
 rateEffectiveDate,
 costRateId,
 isCostCalculated,
 },
 })
 }

 return prisma.storageLedger.create({
 data: {
 storageLedgerId: randomUUID(),
 warehouseCode,
 warehouseName,
 skuCode,
 skuDescription,
 batchLot,
 weekEndingDate,
 openingBalance,
 weeklyReceive,
 weeklyShip,
 weeklyAdjust,
 closingBalance: normalizedClosingBalance,
 averageBalance,
 dailyBalanceData: null,
 storageRatePerCarton: ratePerCarton,
 totalStorageCost: totalCost,
 rateEffectiveDate,
 costRateId,
 isCostCalculated,
 createdByName: 'System',
 },
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
 const errors: string[] = []

  for (const agg of aggregates) {
    try {
      const totalIn = Number(agg._sum?.cartonsIn ?? 0)
      const totalOut = Number(agg._sum?.cartonsOut ?? 0)
      const netBalance = totalIn - totalOut

      if (netBalance <= 0) {
        skipped++
        continue
      }

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
 transactionDate: date,
 })

 if (result) {
 processed++
 if (result.isCostCalculated) {
 costCalculated++
 }
 } else {
 skipped++
 }
 }
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Unknown error'
 const errorMsg = `${agg.warehouseCode}/${agg.skuCode}/${agg.batchLot}: ${message}`
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
 const where: Prisma.StorageLedgerWhereInput = {
 isCostCalculated: false,
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
 const message = error instanceof Error ? error.message : 'Unknown error'
 errors.push(`Entry ${entry.id}: ${message}`)
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
 const where: Prisma.StorageLedgerWhereInput = {
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
