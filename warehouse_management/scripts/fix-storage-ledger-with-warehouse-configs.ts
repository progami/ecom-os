import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const prisma = new PrismaClient()

async function fixStorageLedgerWithWarehouseConfigs() {
  console.log('🔧 Fixing storage ledger entries using warehouse SKU configurations...')
  console.log('=====================================================================')
  
  try {
    // Get all entries where we suspect default 1:1 was used
    const suspiciousEntries = await prisma.storageLedger.findMany({
      where: {
        AND: [
          { cartonsEndOfMonday: { equals: prisma.storageLedger.fields.storagePalletsCharged } },
          { cartonsEndOfMonday: { lte: 10 } } // Focus on low quantities
        ]
      },
      include: {
        sku: true,
        warehouse: true
      }
    })
    
    // Manual filter since Prisma doesn't support field comparison
    const entries = await prisma.storageLedger.findMany({
      where: {
        cartonsEndOfMonday: { lte: 10 },
        cartonsEndOfMonday: { gte: 1 }
      },
      include: {
        sku: true,
        warehouse: true
      }
    })
    
    const oneToOneEntries = entries.filter(e => e.cartonsEndOfMonday === e.storagePalletsCharged)
    
    console.log(`Found ${oneToOneEntries.length} entries with 1:1 carton/pallet ratio`)
    
    let fixed = 0
    let skipped = 0
    
    for (const entry of oneToOneEntries) {
      // Get warehouse SKU configuration for the time period
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
      
      if (warehouseConfig && warehouseConfig.storageCartonsPerPallet > 1) {
        const correctPallets = Math.ceil(entry.cartonsEndOfMonday / warehouseConfig.storageCartonsPerPallet)
        
        // Only fix if it would result in fewer pallets (more realistic)
        if (correctPallets < entry.storagePalletsCharged) {
          console.log(`\n📦 Fixing ${entry.sku.skuCode} batch ${entry.batchLot} at ${entry.warehouse.code}:`)
          console.log(`   Week: ${entry.weekEndingDate.toISOString().split('T')[0]}`)
          console.log(`   Cartons: ${entry.cartonsEndOfMonday}`)
          console.log(`   Current: ${entry.storagePalletsCharged} pallets (1:1 ratio)`)
          console.log(`   Config: ${warehouseConfig.storageCartonsPerPallet} cartons/pallet`)
          console.log(`   Fixed: ${correctPallets} pallets`)
          
          // Recalculate cost
          const newCost = correctPallets * Number(entry.applicableWeeklyRate)
          
          await prisma.storageLedger.update({
            where: { id: entry.id },
            data: {
              storagePalletsCharged: correctPallets,
              calculatedWeeklyCost: newCost
            }
          })
          
          fixed++
        } else {
          skipped++
        }
      } else if (!warehouseConfig) {
        console.log(`\n⚠️ No config found for ${entry.sku.skuCode} at ${entry.warehouse.code}`)
      }
    }
    
    console.log(`\n✅ Fixed ${fixed} entries`)
    console.log(`⏭️ Skipped ${skipped} entries (config wouldn't improve pallet count)`)
    
    // Update inventory balances to store the config
    console.log('\n📝 Updating inventory balances with warehouse configs...')
    
    const balancesWithoutConfig = await prisma.inventoryBalance.findMany({
      where: {
        OR: [
          { storageCartonsPerPallet: null },
          { shippingCartonsPerPallet: null }
        ]
      }
    })
    
    let balancesUpdated = 0
    
    for (const balance of balancesWithoutConfig) {
      const warehouseConfig = await prisma.warehouseSkuConfig.findFirst({
        where: {
          warehouseId: balance.warehouseId,
          skuId: balance.skuId,
          OR: [
            { endDate: null },
            { endDate: { gte: new Date() } }
          ]
        }
      })
      
      if (warehouseConfig) {
        await prisma.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            storageCartonsPerPallet: balance.storageCartonsPerPallet || warehouseConfig.storageCartonsPerPallet,
            shippingCartonsPerPallet: balance.shippingCartonsPerPallet || warehouseConfig.shippingCartonsPerPallet
          }
        })
        balancesUpdated++
      }
    }
    
    console.log(`✅ Updated ${balancesUpdated} inventory balances with warehouse configs`)
    
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the fix
fixStorageLedgerWithWarehouseConfigs()
  .then(() => {
    console.log('\n🎉 Storage ledger fix completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Fix failed:', error)
    process.exit(1)
  })