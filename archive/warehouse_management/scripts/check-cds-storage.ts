import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const prisma = new PrismaClient()

async function checkCDSStorage() {
  try {
    // Check CDS-001 entries in storage ledger
    const cdsEntries = await prisma.storageLedger.findMany({
      where: {
        batchLot: 'CDS-001'
      },
      include: {
        sku: true,
        warehouse: true
      },
      orderBy: {
        weekEndingDate: 'desc'
      },
      take: 10
    })
    
    console.log('🔍 CDS-001 Storage Ledger Entries:')
    console.log('=====================================')
    cdsEntries.forEach(entry => {
      const cartonsPerPallet = entry.storagePalletsCharged > 0 
        ? Math.ceil(entry.cartonsEndOfMonday / entry.storagePalletsCharged)
        : 0
      console.log(`📦 ${entry.sku.skuCode} at ${entry.warehouse.code}:`)
      console.log(`   - Week ending: ${entry.weekEndingDate.toISOString().split('T')[0]}`)
      console.log(`   - Cartons: ${entry.cartonsEndOfMonday}`)
      console.log(`   - Pallets charged: ${entry.storagePalletsCharged}`)
      console.log(`   - Implied cartons/pallet: ${cartonsPerPallet}`)
      console.log(`   - Weekly cost: £${entry.calculatedWeeklyCost}`)
      console.log('')
    })
    
    // Check inventory balance for CDS-001
    const balances = await prisma.inventoryBalance.findMany({
      where: {
        batchLot: 'CDS-001'
      },
      include: {
        sku: true,
        warehouse: true
      }
    })
    
    console.log('\n📊 CDS-001 Inventory Balances:')
    console.log('================================')
    balances.forEach(b => {
      console.log(`📦 ${b.sku.skuCode} at ${b.warehouse.code}:`)
      console.log(`   - Current cartons: ${b.currentCartons}`)
      console.log(`   - Storage config: ${b.storageCartonsPerPallet || 'NULL'} cartons/pallet`)
      console.log(`   - Shipping config: ${b.shippingCartonsPerPallet || 'NULL'} cartons/pallet`)
      console.log('')
    })
    
    // Check transactions for CDS-001
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        batchLot: 'CDS-001',
        transactionType: 'RECEIVE'
      },
      include: {
        sku: true,
        warehouse: true
      },
      orderBy: {
        transactionDate: 'desc'
      },
      take: 5
    })
    
    console.log('\n📥 CDS-001 RECEIVE Transactions:')
    console.log('==================================')
    transactions.forEach(t => {
      console.log(`📦 ${t.sku.skuCode} at ${t.warehouse.code}:`)
      console.log(`   - Date: ${t.transactionDate.toISOString().split('T')[0]}`)
      console.log(`   - Cartons received: ${t.cartonsIn}`)
      console.log(`   - Storage config: ${t.storageCartonsPerPallet || 'NULL'} cartons/pallet`)
      console.log(`   - Shipping config: ${t.shippingCartonsPerPallet || 'NULL'} cartons/pallet`)
      console.log('')
    })
    
    // Check warehouse SKU configs
    const warehouseConfigs = await prisma.warehouseSkuConfig.findMany({
      where: {
        sku: {
          skuCode: {
            in: ['MP4', 'MP6', 'TGR4', 'TGR6'] // Common SKUs with CDS-001
          }
        }
      },
      include: {
        sku: true,
        warehouse: true
      }
    })
    
    console.log('\n⚙️ Warehouse SKU Configurations:')
    console.log('==================================')
    warehouseConfigs.forEach(c => {
      console.log(`📦 ${c.sku.skuCode} at ${c.warehouse.code}:`)
      console.log(`   - Storage: ${c.storageCartonsPerPallet} cartons/pallet`)
      console.log(`   - Shipping: ${c.shippingCartonsPerPallet} cartons/pallet`)
      console.log('')
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCDSStorage()