import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteDummySKUs() {
  console.log('=== Delete Dummy/Test SKUs Script ===\n');

  try {
    // First, show current SKUs
    const allSKUsBefore = await prisma.sku.findMany({
      orderBy: { skuCode: 'asc' },
      select: {
        id: true,
        skuCode: true,
        description: true,
        createdAt: true
      }
    });

    console.log('Current SKUs in database:');
    console.log('========================');
    allSKUsBefore.forEach(sku => {
      console.log(`${sku.skuCode}: ${sku.description} (ID: ${sku.id})`);
    });
    console.log(`\nTotal SKUs before deletion: ${allSKUsBefore.length}`);

    // Define dummy SKU codes to delete
    const dummySKUCodes = ['SKU001', 'SKU002', 'SKU003', 'SKU004', 'SKU005', 'SKU006'];
    
    // Find the dummy SKUs
    const dummySKUs = await prisma.sku.findMany({
      where: {
        OR: [
          { skuCode: { in: dummySKUCodes } },
          { 
            description: { 
              in: [
                'Premium Widget',
                'Deluxe Gadget',
                'Standard Component',
                'Economy Part',
                'Luxury Item',
                'Basic Product'
              ] 
            } 
          }
        ]
      }
    });

    if (dummySKUs.length === 0) {
      console.log('\nNo dummy SKUs found to delete.');
      return;
    }

    console.log('\n\nDummy SKUs to be deleted:');
    console.log('=========================');
    dummySKUs.forEach(sku => {
      console.log(`${sku.skuCode}: ${sku.description} (ID: ${sku.id})`);
    });

    // Check for related data
    console.log('\n\nChecking for related data...');
    
    for (const sku of dummySKUs) {
      const transactions = await prisma.inventoryTransaction.count({
        where: { skuId: sku.id }
      });
      
      const rates = await prisma.calculatedCost.count({
        where: { skuId: sku.id }
      });

      const balances = await prisma.inventoryBalance.count({
        where: { skuId: sku.id }
      });

      const storageLedger = await prisma.storageLedger.count({
        where: { skuId: sku.id }
      });

      if (transactions > 0 || rates > 0 || balances > 0 || storageLedger > 0) {
        console.log(`\nSKU ${sku.skuCode} has related data:`);
        if (transactions > 0) console.log(`  - ${transactions} inventory transactions`);
        if (rates > 0) console.log(`  - ${rates} calculated costs`);
        if (balances > 0) console.log(`  - ${balances} inventory balances`);
        if (storageLedger > 0) console.log(`  - ${storageLedger} storage ledger entries`);
      }
    }

    // Ask for confirmation
    console.log('\n\nProceed with deletion? (This will delete all related data)');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete the dummy SKUs and all related data
    console.log('\n\nDeleting dummy SKUs and related data...');
    
    const deleteResults = await prisma.$transaction([
      // Delete inventory transactions
      prisma.inventoryTransaction.deleteMany({
        where: { skuId: { in: dummySKUs.map(s => s.id) } }
      }),
      // Delete calculated costs
      prisma.calculatedCost.deleteMany({
        where: { skuId: { in: dummySKUs.map(s => s.id) } }
      }),
      // Delete inventory balances
      prisma.inventoryBalance.deleteMany({
        where: { skuId: { in: dummySKUs.map(s => s.id) } }
      }),
      // Delete storage ledger entries
      prisma.storageLedger.deleteMany({
        where: { skuId: { in: dummySKUs.map(s => s.id) } }
      }),
      // Delete warehouse SKU configs
      prisma.warehouseSkuConfig.deleteMany({
        where: { skuId: { in: dummySKUs.map(s => s.id) } }
      }),
      // Delete SKU versions
      prisma.skuVersion.deleteMany({
        where: { skuId: { in: dummySKUs.map(s => s.id) } }
      }),
      // Delete SKUs
      prisma.sku.deleteMany({
        where: { id: { in: dummySKUs.map(s => s.id) } }
      })
    ]);

    console.log('\nDeletion complete:');
    console.log(`- Inventory transactions deleted: ${deleteResults[0].count}`);
    console.log(`- Calculated costs deleted: ${deleteResults[1].count}`);
    console.log(`- Inventory balances deleted: ${deleteResults[2].count}`);
    console.log(`- Storage ledger entries deleted: ${deleteResults[3].count}`);
    console.log(`- Warehouse SKU configs deleted: ${deleteResults[4].count}`);
    console.log(`- SKU versions deleted: ${deleteResults[5].count}`);
    console.log(`- SKUs deleted: ${deleteResults[6].count}`);

    // Show remaining SKUs
    const remainingSKUs = await prisma.sku.findMany({
      orderBy: { skuCode: 'asc' },
      select: {
        id: true,
        skuCode: true,
        description: true,
        createdAt: true,
        _count: {
          select: {
            inventoryTransactions: true,
            calculatedCosts: true,
            inventoryBalances: true,
            storageLedgerEntries: true
          }
        }
      }
    });

    console.log('\n\nRemaining SKUs in database:');
    console.log('===========================');
    if (remainingSKUs.length === 0) {
      console.log('No SKUs remaining in database.');
    } else {
      remainingSKUs.forEach(sku => {
        console.log(`${sku.skuCode}: ${sku.description} (ID: ${sku.id})`);
        console.log(`  - Inventory transactions: ${sku._count.inventoryTransactions}`);
        console.log(`  - Calculated costs: ${sku._count.calculatedCosts}`);
        console.log(`  - Inventory balances: ${sku._count.inventoryBalances}`);
        console.log(`  - Storage ledger entries: ${sku._count.storageLedgerEntries}`);
      });
      console.log(`\nTotal remaining SKUs: ${remainingSKUs.length}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deleteDummySKUs();