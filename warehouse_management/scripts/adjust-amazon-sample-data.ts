import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function adjustAmazonSampleData() {
  try {
    console.log('Creating adjustment transactions to remove Amazon sample data...\n')
    
    // Get system user
    const systemUser = await prisma.user.findFirst({
      where: { email: 'system@warehouse.com' }
    })
    
    if (!systemUser) {
      console.error('System user not found')
      return
    }
    
    // Find all Amazon warehouse balances with AMZN-2025 batch
    const amazonBalances = await prisma.inventoryBalance.findMany({
      where: {
        batchLot: 'AMZN-2025',
        currentCartons: { gt: 0 }
      },
      include: {
        warehouse: true,
        sku: true
      }
    })
    
    console.log(`Found ${amazonBalances.length} Amazon sample inventory balances to adjust\n`)
    
    for (const balance of amazonBalances) {
      console.log(`Creating adjustment for ${balance.sku.skuCode} in ${balance.warehouse.name}:`)
      console.log(`  Current balance: ${balance.currentCartons} cartons`)
      
      // Create ADJUST_OUT transaction to zero the balance
      const adjustmentId = `ADJ-OUT-${Date.now()}-${balance.sku.skuCode.replace(/ /g, '-')}`
      
      await prisma.inventoryTransaction.create({
        data: {
          transactionId: adjustmentId,
          warehouseId: balance.warehouseId,
          skuId: balance.skuId,
          batchLot: balance.batchLot,
          transactionType: 'ADJUST_OUT',
          referenceId: 'REMOVE-SAMPLE-DATA',
          cartonsIn: 0,
          cartonsOut: balance.currentCartons,
          storagePalletsIn: 0,
          shippingPalletsOut: balance.currentPallets,
          storageCartonsPerPallet: balance.storageCartonsPerPallet,
          shippingCartonsPerPallet: balance.shippingCartonsPerPallet,
          transactionDate: new Date(),
          createdById: systemUser.id,
          notes: 'Adjustment to remove Amazon sample data from inventory'
        }
      })
      
      // Update the inventory balance to zero
      await prisma.inventoryBalance.update({
        where: { id: balance.id },
        data: {
          currentCartons: 0,
          currentPallets: 0,
          currentUnits: 0,
          lastTransactionDate: new Date()
        }
      })
      
      console.log(`  Created adjustment: ${adjustmentId}`)
      console.log(`  New balance: 0 cartons\n`)
      
      // Small delay to ensure unique timestamps
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.log('Amazon sample data adjustment completed!')
    console.log('\nNote: The original transactions remain in the immutable ledger for audit purposes.')
    console.log('Current inventory balances have been corrected to zero.')
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

adjustAmazonSampleData()