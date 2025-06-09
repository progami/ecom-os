import { prisma } from '@/lib/prisma'
import { addDays, startOfWeek, endOfWeek, eachWeekOfInterval, isMonday, startOfDay } from 'date-fns'

/**
 * Calculate cubic feet from dimensions in centimeters
 */
function calculateCubicFeetFromCm(dimensionsCm: string): number {
  // Parse dimensions string (expected format: "LxWxH cm")
  const matches = dimensionsCm.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i)
  if (!matches) {
    return 1.5 // Default if can't parse
  }
  
  const [_, length, width, height] = matches
  const volumeCubicCm = parseFloat(length) * parseFloat(width) * parseFloat(height)
  
  // Convert cubic cm to cubic feet (1 cubic foot = 28,316.8 cubic cm)
  const volumeCubicFeet = volumeCubicCm / 28316.8
  
  return Math.max(0.1, volumeCubicFeet) // Minimum 0.1 cubic feet
}

/**
 * Calculate storage ledger entries based on inventory snapshots
 * - Regular warehouses: Weekly snapshots taken every Monday
 * - Amazon FBA: Monthly fees fetched from API
 */
export async function calculateStorageLedger(
  billingPeriodStart: Date,
  billingPeriodEnd: Date,
  warehouseId?: string
) {
  console.log('📊 Calculating storage ledger entries...')
  
  // For regular warehouses, get all Mondays in the billing period
  const mondays = getMondays(billingPeriodStart, billingPeriodEnd)
  
  // Get warehouse filter
  const warehouseFilter = warehouseId ? { warehouseId } : {}
  
  // Get all active inventory combinations
  const activeCombinations = await prisma.inventoryBalance.findMany({
    where: {
      ...warehouseFilter,
      currentCartons: { gt: 0 }
    },
    include: {
      warehouse: true,
      sku: true,
    }
  })
  
  let created = 0
  
  for (const monday of mondays) {
    const weekEndingDate = endOfWeek(monday, { weekStartsOn: 1 }) // Week ends on Sunday
    
    for (const combo of activeCombinations) {
      // Get inventory balance as of Monday
      const balanceAsOfMonday = await getInventoryBalanceAsOfDate(
        combo.warehouseId,
        combo.skuId,
        combo.batchLot,
        monday
      )
      
      if (balanceAsOfMonday === 0) continue
      
      // Check if this is an Amazon warehouse
      const isAmazonWarehouse = combo.warehouse.code?.includes('AMZN') || combo.warehouse.name.toLowerCase().includes('amazon')
      
      let quantityCharged: number
      let storageUnit: string
      
      if (isAmazonWarehouse) {
        // For Amazon, calculate cubic feet instead of pallets
        // Assume standard carton dimensions if not specified
        const cartonVolumeCubicFeet = combo.sku.cartonDimensionsCm ? 
          calculateCubicFeetFromCm(combo.sku.cartonDimensionsCm) : 
          1.5 // Default cubic feet per carton
        
        quantityCharged = Math.ceil(balanceAsOfMonday * cartonVolumeCubicFeet)
        storageUnit = 'cubic foot/month'
      } else {
        // Get batch-specific pallet configuration for non-Amazon warehouses
        const { storageCartonsPerPallet } = await getBatchPalletConfig(
          combo.warehouseId,
          combo.skuId,
          combo.batchLot,
          monday
        )
        
        if (!storageCartonsPerPallet) {
          console.warn(`No pallet config found for ${combo.warehouse.name} - ${combo.sku.skuCode} - Batch: ${combo.batchLot}`)
          continue
        }
        
        // Calculate pallets (round up)
        quantityCharged = Math.ceil(balanceAsOfMonday / storageCartonsPerPallet)
        storageUnit = 'pallet'
      }
      
      // Get applicable storage rate
      let storageRate = null
      let weeklyRate = 0
      
      if (isAmazonWarehouse) {
        // For Amazon, find the appropriate monthly rate based on the date
        const month = monday.getMonth() // 0-11
        const isPeakSeason = month >= 9 // October (9) through December (11)
        const sizeType = 'Standard Size' // TODO: Determine from SKU attributes
        const seasonText = isPeakSeason ? 'Oct-Dec' : 'Jan-Sep'
        
        storageRate = await prisma.costRate.findFirst({
          where: {
            warehouseId: combo.warehouseId,
            costCategory: 'Storage',
            costName: { contains: `${sizeType} (${seasonText})` },
            effectiveDate: { lte: monday },
            OR: [
              { endDate: null },
              { endDate: { gte: monday } }
            ]
          }
        })
        
        if (storageRate) {
          // Convert monthly rate to weekly (divide by 4.33 weeks per month)
          weeklyRate = storageRate.costValue.toNumber() / 4.33
        }
      } else {
        // Regular warehouse - weekly rates
        storageRate = await prisma.costRate.findFirst({
          where: {
            warehouseId: combo.warehouseId,
            costCategory: 'Storage',
            costName: { contains: storageUnit },
            effectiveDate: { lte: monday },
            OR: [
              { endDate: null },
              { endDate: { gte: monday } }
            ]
          }
        })
        
        if (storageRate) {
          weeklyRate = storageRate.costValue.toNumber()
        }
      }
      
      if (!storageRate) {
        console.warn(`No storage rate found for ${combo.warehouse.name} (${storageUnit})`)
        continue
      }
      
      // Create storage ledger entry
      const slId = `SL-${monday.toISOString().split('T')[0]}-${combo.warehouse.code}-${combo.sku.skuCode}-${combo.batchLot}`
      
      try {
        await prisma.storageLedger.upsert({
          where: { slId },
          update: {
            cartonsEndOfMonday: balanceAsOfMonday,
            storagePalletsCharged: isAmazonWarehouse ? 0 : quantityCharged, // For Amazon, store as 0 pallets
            applicableWeeklyRate: weeklyRate,
            calculatedWeeklyCost: quantityCharged * weeklyRate,
          },
          create: {
            slId,
            weekEndingDate,
            warehouseId: combo.warehouseId,
            skuId: combo.skuId,
            batchLot: combo.batchLot,
            cartonsEndOfMonday: balanceAsOfMonday,
            storagePalletsCharged: isAmazonWarehouse ? 0 : quantityCharged, // For Amazon, store as 0 pallets
            applicableWeeklyRate: weeklyRate,
            calculatedWeeklyCost: quantityCharged * weeklyRate,
            billingPeriodStart,
            billingPeriodEnd,
          }
        })
        created++
      } catch (error) {
        console.error(`Error creating storage ledger entry ${slId}:`, error)
      }
    }
  }
  
  console.log(`✅ Created/updated ${created} storage ledger entries`)
  return created
}

/**
 * Get batch-specific pallet configuration
 */
async function getBatchPalletConfig(
  warehouseId: string,
  skuId: string,
  batchLot: string,
  asOfDate: Date
): Promise<{ storageCartonsPerPallet: number | null; shippingCartonsPerPallet: number | null }> {
  // First check if we have the config in the inventory balance
  const balance = await prisma.inventoryBalance.findFirst({
    where: {
      warehouseId,
      skuId,
      batchLot
    }
  })
  
  if (balance?.storageCartonsPerPallet && balance?.shippingCartonsPerPallet) {
    return {
      storageCartonsPerPallet: balance.storageCartonsPerPallet,
      shippingCartonsPerPallet: balance.shippingCartonsPerPallet
    }
  }
  
  // If not in balance, look for the first RECEIVE transaction for this batch
  const firstReceive = await prisma.inventoryTransaction.findFirst({
    where: {
      warehouseId,
      skuId,
      batchLot,
      transactionType: 'RECEIVE',
      transactionDate: { lte: asOfDate }
    },
    orderBy: { transactionDate: 'asc' }
  })
  
  if (firstReceive?.storageCartonsPerPallet && firstReceive?.shippingCartonsPerPallet) {
    return {
      storageCartonsPerPallet: firstReceive.storageCartonsPerPallet,
      shippingCartonsPerPallet: firstReceive.shippingCartonsPerPallet
    }
  }
  
  // Fall back to warehouse config if no batch-specific config found
  const warehouseConfig = await prisma.warehouseSkuConfig.findFirst({
    where: {
      warehouseId,
      skuId,
      effectiveDate: { lte: asOfDate },
      OR: [
        { endDate: null },
        { endDate: { gte: asOfDate } }
      ]
    }
  })
  
  return {
    storageCartonsPerPallet: warehouseConfig?.storageCartonsPerPallet || null,
    shippingCartonsPerPallet: warehouseConfig?.shippingCartonsPerPallet || null
  }
}

/**
 * Get inventory balance as of a specific date
 */
async function getInventoryBalanceAsOfDate(
  warehouseId: string,
  skuId: string,
  batchLot: string,
  asOfDate: Date
): Promise<number> {
  // Get all transactions up to and including the date
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      warehouseId,
      skuId,
      batchLot,
      transactionDate: { lte: asOfDate }
    },
    orderBy: { transactionDate: 'asc' }
  })
  
  // Calculate running balance
  let balance = 0
  for (const transaction of transactions) {
    balance += transaction.cartonsIn - transaction.cartonsOut
  }
  
  return Math.max(0, balance) // Never return negative balance
}

/**
 * Get all Mondays between two dates
 */
function getMondays(startDate: Date, endDate: Date): Date[] {
  const start = startOfWeek(startDate, { weekStartsOn: 1 })
  const end = endOfWeek(endDate, { weekStartsOn: 1 })
  
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
  
  return weeks.map(week => {
    // Each week starts on Monday
    return startOfDay(week)
  })
}

/**
 * Generate storage ledger for a specific billing period
 */
export async function generateStorageLedgerForPeriod(
  year: number,
  month: number,
  warehouseId?: string
) {
  // Billing periods run from 16th to 15th
  const billingPeriodStart = new Date(year, month - 1, 16) // 16th of the month
  const billingPeriodEnd = new Date(year, month, 15) // 15th of next month
  
  return calculateStorageLedger(billingPeriodStart, billingPeriodEnd, warehouseId)
}