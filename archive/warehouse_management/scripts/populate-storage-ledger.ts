import { PrismaClient } from '@prisma/client'
import { addDays, startOfWeek, endOfWeek, eachWeekOfInterval, startOfDay, format } from 'date-fns'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const prisma = new PrismaClient()

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

async function populateStorageLedger() {
  console.log('🚀 Starting storage ledger population...')
  
  try {
    // Get date range - last 2 years or from first transaction
    const firstTransaction = await prisma.inventoryTransaction.findFirst({
      orderBy: { transactionDate: 'asc' }
    })
    
    const startDate = firstTransaction 
      ? new Date(firstTransaction.transactionDate)
      : new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
    
    const endDate = new Date()
    
    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    
    // Get all warehouses (excluding Amazon)
    const warehouses = await prisma.warehouse.findMany({
      where: {
        isActive: true,
        NOT: {
          OR: [
            { code: 'AMZN' },
            { code: 'AMZN-UK' }
          ]
        }
      }
    })
    
    console.log(`🏭 Found ${warehouses.length} warehouses`)
    
    // Get all transactions
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        transactionDate: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        sku: true,
        warehouse: true
      },
      orderBy: {
        transactionDate: 'asc'
      }
    })
    
    console.log(`📦 Found ${transactions.length} transactions`)
    
    // Get all cost rates
    const rates = await prisma.costRate.findMany({
      where: {
        costCategory: 'Storage'
      }
    })
    
    console.log(`💰 Found ${rates.length} storage rates`)
    
    // Find all Mondays in the date range
    const mondays = []
    const current = new Date(startDate)
    
    // Move to next Monday if start date is not Monday
    const daysUntilMonday = (8 - current.getDay()) % 7
    if (daysUntilMonday > 0) {
      current.setDate(current.getDate() + daysUntilMonday)
    }
    
    while (current <= endDate) {
      mondays.push(new Date(current))
      current.setDate(current.getDate() + 7)
    }
    
    console.log(`📅 Processing ${mondays.length} Monday snapshots`)
    
    let totalCreated = 0
    let totalUpdated = 0
    
    // Process each Monday
    for (const monday of mondays) {
      const mondayEnd = new Date(monday)
      mondayEnd.setHours(23, 59, 59, 999)
      
      const weekNumber = getWeekNumber(monday)
      const weekEndingDate = endOfWeek(monday, { weekStartsOn: 1 })
      
      console.log(`\n🗓️ Processing Week ${weekNumber} - ${monday.toISOString().split('T')[0]}`)
      
      // Calculate inventory for each warehouse
      for (const warehouse of warehouses) {
        // Get all unique SKU/batch combinations for this warehouse
        const warehouseTransactions = transactions.filter(t => 
          t.warehouseId === warehouse.id && 
          new Date(t.transactionDate) <= mondayEnd
        )
        
        // Create a map of unique SKU/batch combinations
        const skuBatchMap = new Map<string, { skuId: string, batchLot: string, sku: any }>()
        
        for (const t of warehouseTransactions) {
          const key = `${t.skuId}-${t.batchLot}`
          if (!skuBatchMap.has(key)) {
            skuBatchMap.set(key, {
              skuId: t.skuId,
              batchLot: t.batchLot,
              sku: t.sku
            })
          }
        }
        
        let warehousePallets = 0
        let warehouseEntries = 0
        
        // For each unique SKU/batch, calculate the balance at Monday
        for (const [key, { skuId, batchLot, sku }] of skuBatchMap) {
          // Get all transactions for this SKU/batch up to Monday
          const skuBatchTransactions = warehouseTransactions.filter(t => 
            t.skuId === skuId &&
            t.batchLot === batchLot
          )
          
          // Calculate cartons at Monday end
          let cartonsAtMonday = 0
          for (const t of skuBatchTransactions) {
            cartonsAtMonday += t.cartonsIn - t.cartonsOut
          }
          
          if (cartonsAtMonday > 0) {
            // Get the current inventory balance to find storage configuration
            const balance = await prisma.inventoryBalance.findFirst({
              where: {
                warehouseId: warehouse.id,
                skuId: skuId,
                batchLot: batchLot
              }
            })
            
            // Use storage configuration from balance, or warehouse config, or default
            let cartonsPerPallet = 1
            
            if (balance?.storageCartonsPerPallet) {
              cartonsPerPallet = balance.storageCartonsPerPallet
            } else {
              // Try to get from warehouse SKU config
              const warehouseConfig = await prisma.warehouseSkuConfig.findFirst({
                where: {
                  warehouseId: warehouse.id,
                  skuId: skuId,
                  effectiveDate: { lte: monday },
                  OR: [
                    { endDate: null },
                    { endDate: { gte: monday } }
                  ]
                }
              })
              
              if (warehouseConfig?.storageCartonsPerPallet) {
                cartonsPerPallet = warehouseConfig.storageCartonsPerPallet
              }
            }
            
            const pallets = Math.ceil(cartonsAtMonday / cartonsPerPallet)
            warehousePallets += pallets
            
            // Find applicable rate
            const applicableRate = rates.find(r => 
              r.warehouseId === warehouse.id &&
              new Date(r.effectiveDate) <= monday &&
              (!r.endDate || new Date(r.endDate) >= monday)
            )
            
            const rate = applicableRate ? Number(applicableRate.costValue) : 0
            const cost = pallets * rate
            
            // Get billing period
            const billingPeriodStart = new Date(monday.getFullYear(), monday.getMonth(), 16)
            if (monday.getDate() < 16) {
              billingPeriodStart.setMonth(billingPeriodStart.getMonth() - 1)
            }
            const billingPeriodEnd = new Date(billingPeriodStart)
            billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1)
            billingPeriodEnd.setDate(15)
            
            // Create unique ID
            const slId = `SL-${monday.toISOString().split('T')[0]}-${warehouse.code}-${sku.skuCode}-${batchLot}`
            
            try {
              const result = await prisma.storageLedger.upsert({
                where: { slId },
                update: {
                  cartonsEndOfMonday: cartonsAtMonday,
                  storagePalletsCharged: pallets,
                  applicableWeeklyRate: rate,
                  calculatedWeeklyCost: cost,
                },
                create: {
                  slId,
                  weekEndingDate,
                  warehouseId: warehouse.id,
                  skuId: skuId,
                  batchLot: batchLot,
                  cartonsEndOfMonday: cartonsAtMonday,
                  storagePalletsCharged: pallets,
                  applicableWeeklyRate: rate,
                  calculatedWeeklyCost: cost,
                  billingPeriodStart,
                  billingPeriodEnd,
                }
              })
              
              if (result.createdAt.getTime() === result.createdAt.getTime()) {
                totalCreated++
              } else {
                totalUpdated++
              }
              warehouseEntries++
            } catch (error) {
              console.error(`❌ Error creating entry ${slId}:`, error)
            }
          }
        }
        
        if (warehouseEntries > 0) {
          console.log(`  ✅ ${warehouse.name}: ${warehouseEntries} entries, ${warehousePallets} total pallets`)
        }
      }
    }
    
    console.log(`\n✅ Storage ledger population complete!`)
    console.log(`📊 Created: ${totalCreated} new entries`)
    console.log(`📊 Updated: ${totalUpdated} existing entries`)
    console.log(`📊 Total: ${totalCreated + totalUpdated} entries`)
    
    // Verify data
    const totalEntries = await prisma.storageLedger.count()
    console.log(`\n🔍 Verification: ${totalEntries} total entries in storage_ledger table`)
    
  } catch (error) {
    console.error('❌ Error populating storage ledger:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the population
populateStorageLedger()
  .then(() => {
    console.log('\n🎉 Storage ledger population completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Storage ledger population failed:', error)
    process.exit(1)
  })