import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyAmazonExclusion() {
  try {
    console.log('=== Verifying Amazon FBA UK Exclusion ===\n')
    
    // 1. Check if Amazon warehouse exists
    const amazonWarehouse = await prisma.warehouse.findFirst({
      where: {
        OR: [
          { code: 'AMZN' },
          { code: 'AMZN-UK' }
        ]
      }
    })
    
    if (amazonWarehouse) {
      console.log('✓ Amazon warehouse found:')
      console.log(`  Name: ${amazonWarehouse.name}`)
      console.log(`  Code: ${amazonWarehouse.code}`)
      console.log(`  ID: ${amazonWarehouse.id}\n`)
    } else {
      console.log('✗ No Amazon warehouse found\n')
      return
    }
    
    // 2. Check inventory balances
    console.log('2. Checking inventory balances:')
    const amazonBalances = await prisma.inventoryBalance.findMany({
      where: { warehouseId: amazonWarehouse.id },
      include: { sku: true }
    })
    
    console.log(`  Amazon has ${amazonBalances.length} SKUs with inventory`)
    
    const totalAmazonCartons = amazonBalances.reduce((sum, b) => sum + b.currentCartons, 0)
    console.log(`  Total Amazon cartons: ${totalAmazonCartons}\n`)
    
    // 3. Check regular warehouse queries (simulating API calls)
    console.log('3. Testing warehouse queries (excluding Amazon):')
    
    // Query without Amazon filter (simulating old behavior)
    const allWarehouses = await prisma.warehouse.findMany({
      where: { isActive: true }
    })
    console.log(`  All active warehouses: ${allWarehouses.length}`)
    allWarehouses.forEach(w => console.log(`    - ${w.name} (${w.code})`))
    
    // Query with Amazon filter (new behavior)
    const nonAmazonWarehouses = await prisma.warehouse.findMany({
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
    console.log(`\n  Non-Amazon warehouses: ${nonAmazonWarehouses.length}`)
    nonAmazonWarehouses.forEach(w => console.log(`    - ${w.name} (${w.code})`))
    
    // 4. Check inventory balance queries
    console.log('\n4. Testing inventory balance queries:')
    
    const allBalances = await prisma.inventoryBalance.findMany({
      where: { currentCartons: { gt: 0 } }
    })
    console.log(`  All inventory balances: ${allBalances.length} items`)
    
    const nonAmazonBalances = await prisma.inventoryBalance.findMany({
      where: {
        currentCartons: { gt: 0 },
        warehouse: {
          NOT: {
            OR: [
              { code: 'AMZN' },
              { code: 'AMZN-UK' }
            ]
          }
        }
      }
    })
    console.log(`  Non-Amazon inventory balances: ${nonAmazonBalances.length} items`)
    console.log(`  Amazon items excluded: ${allBalances.length - nonAmazonBalances.length}`)
    
    // 5. Check storage costs
    console.log('\n5. Checking storage costs:')
    
    const allStorageCosts = await prisma.calculatedCost.findMany({
      where: { transactionType: 'STORAGE' }
    })
    console.log(`  Total storage cost records: ${allStorageCosts.length}`)
    
    const amazonStorageCosts = await prisma.calculatedCost.findMany({
      where: {
        transactionType: 'STORAGE',
        warehouseId: amazonWarehouse.id
      }
    })
    console.log(`  Amazon storage cost records: ${amazonStorageCosts.length}`)
    
    if (amazonStorageCosts.length > 0) {
      console.log('  ⚠️  Warning: Amazon has storage cost records. These should be handled separately.')
    }
    
    console.log('\n=== Summary ===')
    console.log('Amazon FBA UK warehouse exists in the system but should be:')
    console.log('✓ Excluded from general warehouse dropdowns and lists')
    console.log('✓ Excluded from storage ledger calculations')
    console.log('✓ Excluded from inventory balance views (except Amazon integration)')
    console.log('✓ Available only in the Amazon integration page')
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

verifyAmazonExclusion()