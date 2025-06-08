import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const prisma = new PrismaClient()

async function fixStorageLedgerConfigs() {
  console.log('🔧 Fixing storage ledger entries with 1:1 carton/pallet ratio...')
  
  try {
    // Find entries where cartons = pallets (likely using default config)
    const entries = await prisma.storageLedger.findMany({
      where: {
        cartonsEndOfMonday: { lte: 20 }, // Focus on low carton counts
        cartonsEndOfMonday: { gte: 1 }
      },
      include: {
        sku: true,
        warehouse: true
      }
    })
    
    // Filter to find 1:1 ratios
    const oneToOneEntries = entries.filter(e => 
      e.cartonsEndOfMonday === e.storagePalletsCharged && 
      e.cartonsEndOfMonday <= 5 // Unlikely to have real 1:1 config for more than 5
    )
    
    console.log(`Found ${oneToOneEntries.length} entries with suspicious 1:1 ratio`)
    
    let fixed = 0
    
    for (const entry of oneToOneEntries) {
      // First check current inventory balance for config
      const balance = await prisma.inventoryBalance.findFirst({
        where: {
          warehouseId: entry.warehouseId,
          skuId: entry.skuId,
          batchLot: entry.batchLot
        }
      })
      
      let correctCartonsPerPallet = null
      
      if (balance?.storageCartonsPerPallet) {
        correctCartonsPerPallet = balance.storageCartonsPerPallet
      } else {
        // Check warehouse SKU config
        const warehouseConfig = await prisma.warehouseSkuConfig.findFirst({
          where: {
            warehouseId: entry.warehouseId,
            skuId: entry.skuId,
            effectiveDate: { lte: entry.weekEndingDate },
            OR: [
              { endDate: null },
              { endDate: { gte: entry.weekEndingDate } }
            ]
          }
        })
        
        if (warehouseConfig?.storageCartonsPerPallet) {
          correctCartonsPerPallet = warehouseConfig.storageCartonsPerPallet
        }
      }
      
      // If we found a proper config and it's different from 1
      if (correctCartonsPerPallet && correctCartonsPerPallet > 1) {
        const correctPallets = Math.ceil(entry.cartonsEndOfMonday / correctCartonsPerPallet)
        
        if (correctPallets !== entry.storagePalletsCharged) {
          console.log(`\nFixing ${entry.sku.skuCode} batch ${entry.batchLot} at ${entry.warehouse.code}:`)
          console.log(`  - Cartons: ${entry.cartonsEndOfMonday}`)
          console.log(`  - Old pallets: ${entry.storagePalletsCharged} (implied ${entry.cartonsEndOfMonday} cartons/pallet)`)
          console.log(`  - Correct config: ${correctCartonsPerPallet} cartons/pallet`)
          console.log(`  - New pallets: ${correctPallets}`)
          
          // Find applicable rate
          const rate = await prisma.costRate.findFirst({
            where: {
              warehouseId: entry.warehouseId,
              costCategory: 'Storage',
              effectiveDate: { lte: entry.weekEndingDate },
              OR: [
                { endDate: null },
                { endDate: { gte: entry.weekEndingDate } }
              ]
            }
          })
          
          const rateValue = rate ? Number(rate.costValue) : Number(entry.applicableWeeklyRate)
          const newCost = correctPallets * rateValue
          
          // Update the entry
          await prisma.storageLedger.update({
            where: { id: entry.id },
            data: {
              storagePalletsCharged: correctPallets,
              calculatedWeeklyCost: newCost
            }
          })
          
          fixed++
        }
      }
    }
    
    console.log(`\n✅ Fixed ${fixed} entries`)
    
    // Verify the fixes
    const stillOneToOne = await prisma.storageLedger.findMany({
      where: {
        cartonsEndOfMonday: { equals: 1 },
        storagePalletsCharged: { equals: 1 }
      },
      include: {
        sku: true,
        warehouse: true
      }
    })
    
    console.log(`\n📊 Remaining 1 carton = 1 pallet entries: ${stillOneToOne.length}`)
    if (stillOneToOne.length > 0) {
      console.log('These may be SKUs with genuinely no configuration or actual 1:1 configs')
      
      // Show a few examples
      stillOneToOne.slice(0, 5).forEach(e => {
        console.log(`  - ${e.sku.skuCode} batch ${e.batchLot} at ${e.warehouse.code}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error fixing storage ledger:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the fix
fixStorageLedgerConfigs()
  .then(() => {
    console.log('\n🎉 Storage ledger fix completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Storage ledger fix failed:', error)
    process.exit(1)
  })