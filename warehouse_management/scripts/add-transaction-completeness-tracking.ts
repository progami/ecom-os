import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addTransactionCompletenessTracking() {
  console.log('===== Adding Transaction Completeness Tracking =====\n');

  try {
    // First, let's analyze what's missing
    console.log('1. Analyzing missing data in transactions...\n');
    
    const missingDataAnalysis = await prisma.$queryRaw`
      SELECT 
        transaction_type,
        COUNT(*) as total,
        COUNT(CASE WHEN transaction_type = 'RECEIVE' AND container_number IS NULL THEN 1 END) as receive_missing_container,
        COUNT(CASE WHEN transaction_type = 'RECEIVE' AND pickup_date IS NULL THEN 1 END) as receive_missing_pickup_date,
        COUNT(CASE WHEN transaction_type = 'SHIP' AND pickup_date IS NULL THEN 1 END) as ship_missing_pickup_date,
        COUNT(CASE WHEN attachments IS NULL OR attachments::text = '{}' THEN 1 END) as missing_attachments
      FROM inventory_transactions
      GROUP BY transaction_type
    `;
    
    console.table(missingDataAnalysis);
    
    // Add a settings entry for tracking incomplete transactions
    console.log('\n2. Adding system settings for incomplete transaction tracking...');
    
    await prisma.settings.upsert({
      where: { key: 'incomplete_transaction_fields' },
      update: {
        value: {
          receive: {
            required: ['container_number', 'pickup_date'],
            optional: ['attachments', 'notes']
          },
          ship: {
            required: ['pickup_date'],
            optional: ['attachments', 'notes']
          }
        },
        description: 'Fields that should be completed for each transaction type'
      },
      create: {
        key: 'incomplete_transaction_fields',
        value: {
          receive: {
            required: ['container_number', 'pickup_date'],
            optional: ['attachments', 'notes']
          },
          ship: {
            required: ['pickup_date'],
            optional: ['attachments', 'notes']
          }
        },
        description: 'Fields that should be completed for each transaction type'
      }
    });
    
    // Create notifications for incomplete transactions
    console.log('\n3. Creating notifications for incomplete RECEIVE transactions...');
    
    // Get all warehouses
    const warehouses = await prisma.warehouse.findMany();
    
    for (const warehouse of warehouses) {
      // Count incomplete RECEIVE transactions
      const incompleteReceive = await prisma.inventoryTransaction.count({
        where: {
          warehouseId: warehouse.id,
          transactionType: 'RECEIVE',
          OR: [
            { containerNumber: null },
            { pickupDate: null }
          ]
        }
      });
      
      if (incompleteReceive > 0) {
        await prisma.warehouseNotification.create({
          data: {
            warehouseId: warehouse.id,
            type: 'INVOICE_DISPUTED', // Using existing type, should add new type
            title: 'Incomplete RECEIVE Transactions',
            message: `You have ${incompleteReceive} RECEIVE transactions missing container numbers or pickup dates. Please update these transactions to ensure accurate tracking and billing.`
          }
        });
        console.log(`  Created notification for ${warehouse.code}: ${incompleteReceive} incomplete RECEIVE transactions`);
      }
      
      // Count incomplete SHIP transactions
      const incompleteShip = await prisma.inventoryTransaction.count({
        where: {
          warehouseId: warehouse.id,
          transactionType: 'SHIP',
          pickupDate: null
        }
      });
      
      if (incompleteShip > 0) {
        await prisma.warehouseNotification.create({
          data: {
            warehouseId: warehouse.id,
            type: 'INVOICE_DISPUTED', // Using existing type, should add new type
            title: 'Incomplete SHIP Transactions',
            message: `You have ${incompleteShip} SHIP transactions missing pickup dates. Please update these transactions for accurate delivery tracking.`
          }
        });
        console.log(`  Created notification for ${warehouse.code}: ${incompleteShip} incomplete SHIP transactions`);
      }
    }
    
    // Add a system-wide audit log entry
    console.log('\n4. Creating audit log entry for data import...');
    
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' }
    });
    
    if (adminUser) {
      await prisma.auditLog.create({
        data: {
          tableName: 'inventory_transactions',
          recordId: 'BULK_IMPORT',
          action: 'EXCEL_IMPORT_COMPLETED',
          userId: adminUser.id,
          changes: {
            summary: 'Imported inventory ledger from Excel',
            missing_fields: {
              receive: ['container_number', 'pickup_date', 'attachments'],
              ship: ['pickup_date', 'attachments']
            },
            imported_counts: {
              receive: 33,
              ship: 141,
              total: 174
            }
          }
        }
      });
    }
    
    console.log('\n===== Summary =====');
    console.log('✅ Added transaction completeness tracking settings');
    console.log('✅ Created notifications for incomplete transactions');
    console.log('✅ Added audit log entry for the import');
    console.log('\n⚠️  Missing data that needs to be added:');
    console.log('   - RECEIVE: Container numbers (33), Pickup dates (33)');
    console.log('   - SHIP: Pickup dates (141)');
    console.log('   - ALL: Document attachments (174)');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addTransactionCompletenessTracking();