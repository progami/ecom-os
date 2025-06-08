import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSystemImports() {
  try {
    console.log('=== Checking for System-Generated Transactions ===\n')
    
    // Find transactions that might be system-generated
    const systemTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        OR: [
          { createdBy: { email: 'system@warehouse.com' } },
          { notes: { contains: 'Sample' } },
          { notes: { contains: 'sample' } },
          { notes: { contains: 'Point-in-time test' } },
          { notes: { contains: 'TEST' } },
          { referenceId: { contains: 'CLEANUP' } },
          { referenceId: { contains: 'TEST' } },
          { referenceId: { contains: 'SAMPLE' } },
          { transactionId: { startsWith: 'TEST-' } },
          { transactionId: { startsWith: 'AMZN-' } },
          { batchLot: 'TEST-2025' }
        ]
      },
      include: {
        warehouse: true,
        sku: true,
        createdBy: true
      },
      orderBy: { transactionDate: 'desc' }
    })
    
    console.log(`Found ${systemTransactions.length} potential system-generated transactions:\n`)
    
    // Group by type
    const testTransactions = systemTransactions.filter(tx => 
      tx.batchLot === 'TEST-2025' || 
      tx.transactionId.startsWith('TEST-') ||
      tx.notes?.includes('Point-in-time test')
    )
    
    const amazonSampleTransactions = systemTransactions.filter(tx => 
      tx.transactionId.startsWith('AMZN-') && 
      (tx.notes?.includes('Sample') || tx.notes?.includes('sample'))
    )
    
    const adjustmentTransactions = systemTransactions.filter(tx => 
      tx.referenceId === 'CLEANUP-TEST-DATA' ||
      tx.notes?.includes('Adjustment to remove TEST')
    )
    
    if (testTransactions.length > 0) {
      console.log(`TEST-2025 Transactions (${testTransactions.length}):\n`)
      testTransactions.forEach(tx => {
        console.log(`  ${tx.transactionId}`)
        console.log(`    Date: ${tx.transactionDate.toISOString().split('T')[0]}`)
        console.log(`    Warehouse: ${tx.warehouse.name}`)
        console.log(`    SKU: ${tx.sku.skuCode} - Batch: ${tx.batchLot}`)
        console.log(`    Type: ${tx.transactionType} - In: ${tx.cartonsIn}, Out: ${tx.cartonsOut}`)
        console.log(`    Notes: ${tx.notes || 'N/A'}\n`)
      })
    }
    
    if (amazonSampleTransactions.length > 0) {
      console.log(`Amazon Sample Transactions (${amazonSampleTransactions.length}):\n`)
      amazonSampleTransactions.forEach(tx => {
        console.log(`  ${tx.transactionId}`)
        console.log(`    Date: ${tx.transactionDate.toISOString().split('T')[0]}`)
        console.log(`    SKU: ${tx.sku.skuCode} - Batch: ${tx.batchLot}`)
        console.log(`    Type: ${tx.transactionType} - In: ${tx.cartonsIn}, Out: ${tx.cartonsOut}`)
        console.log(`    Notes: ${tx.notes || 'N/A'}\n`)
      })
    }
    
    if (adjustmentTransactions.length > 0) {
      console.log(`Adjustment Transactions (${adjustmentTransactions.length}):\n`)
      adjustmentTransactions.forEach(tx => {
        console.log(`  ${tx.transactionId}`)
        console.log(`    Date: ${tx.transactionDate.toISOString().split('T')[0]}`)
        console.log(`    Reference: ${tx.referenceId}`)
        console.log(`    Notes: ${tx.notes || 'N/A'}\n`)
      })
    }
    
    // Check current inventory impact
    console.log('=== Current Inventory Impact ===\n')
    
    // Check TEST-2025 batch current balance
    const testBatchBalances = await prisma.inventoryBalance.findMany({
      where: { batchLot: 'TEST-2025' },
      include: {
        warehouse: true,
        sku: true
      }
    })
    
    if (testBatchBalances.length > 0) {
      console.log('TEST-2025 Batch Current Balances:')
      testBatchBalances.forEach(balance => {
        console.log(`  ${balance.warehouse.name} - ${balance.sku.skuCode}: ${balance.currentCartons} cartons`)
      })
    } else {
      console.log('✓ No current inventory for TEST-2025 batch (already adjusted to zero)')
    }
    
    // Check Amazon sample data
    const amazonWarehouse = await prisma.warehouse.findFirst({
      where: { code: 'AMZN-UK' }
    })
    
    if (amazonWarehouse) {
      const amazonBalances = await prisma.inventoryBalance.findMany({
        where: { 
          warehouseId: amazonWarehouse.id,
          batchLot: { startsWith: 'AMZN-' }
        },
        include: { sku: true }
      })
      
      if (amazonBalances.length > 0) {
        console.log('\nAmazon Sample Data Current Balances:')
        const totalCartons = amazonBalances.reduce((sum, b) => sum + b.currentCartons, 0)
        console.log(`  Total: ${totalCartons} cartons across ${amazonBalances.length} SKUs`)
      }
    }
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkSystemImports()