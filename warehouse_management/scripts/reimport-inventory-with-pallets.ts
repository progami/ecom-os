import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

async function reimportInventoryWithPallets() {
  console.log('===== Re-importing Inventory Ledger with Pallet Data =====\n');

  try {
    // First, delete all existing inventory transactions
    console.log('Deleting existing inventory transactions...');
    await prisma.inventoryTransaction.deleteMany({});
    console.log('All inventory transactions deleted.\n');

    // Load the Excel file
    const filePath = path.join(process.cwd(), 'data', 'Warehouse Management.xlsx');
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets['inventory ledger'];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as any[];
    
    console.log(`Total rows in Excel: ${data.length}`);
    
    // Get warehouse mappings
    const warehouses = await prisma.warehouse.findMany();
    const warehouseMap = new Map(
      warehouses.map(w => [w.code.toLowerCase(), w])
    );
    
    // Also handle alternate names
    const warehouseAltMap: Record<string, string> = {
      'vglobal': 'vglobal',
      'fmc': 'fmc', 
      '4as': '4as'
    };
    
    // Get all SKUs
    const skus = await prisma.sku.findMany();
    const skuMap = new Map(
      skus.map(s => [s.skuCode, s])
    );
    
    // Get user for created_by
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' }
    });
    
    if (!adminUser) {
      throw new Error('No admin user found');
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Parse fields
        const transactionType = row['Transaction_Type'];
        const skuCode = row['SKU'];
        const batchLot = row['Shipment'] || 'DEFAULT';
        const warehouseName = row['Warehouse'];
        const reference = row['Reference_ID (Email tag)'] || '';
        const cartonsIn = parseInt(row['Cartons_In'] || '0');
        const cartonsOut = parseInt(row['Cartons_Out'] || '0');
        const storagePalletsIn = parseInt(row['storage_pallets_in'] || '0');
        const shippingPalletsOut = parseInt(row['shipping_pallets_out'] || '0');
        
        // Parse date
        let transactionDate: Date;
        const dateValue = row['Timestamp'];
        if (typeof dateValue === 'number') {
          // Excel serial date
          transactionDate = new Date((dateValue - 25569) * 86400 * 1000);
        } else if (dateValue) {
          transactionDate = new Date(dateValue);
        } else {
          throw new Error('Invalid date');
        }
        
        // Validate date
        if (isNaN(transactionDate.getTime())) {
          throw new Error(`Invalid date: ${dateValue}`);
        }
        
        // Get warehouse
        const warehouseCode = warehouseAltMap[warehouseName?.toLowerCase()] || warehouseName?.toLowerCase();
        const warehouse = warehouseMap.get(warehouseCode);
        if (!warehouse) {
          throw new Error(`Warehouse not found: ${warehouseName}`);
        }
        
        // Get SKU
        const sku = skuMap.get(skuCode);
        if (!sku) {
          throw new Error(`SKU not found: ${skuCode}`);
        }
        
        // Extract ship name from reference (for RECEIVE transactions)
        let shipName: string | null = null;
        if (transactionType === 'RECEIVE' && reference) {
          // Common ship name patterns
          const shipPatterns = [
            /OOCL\s+[\w\s]+/i,
            /MSC\s+[\w\s]+/i,
            /CMA\s+CGM\s+[\w\s]+/i,
            /MAERSK\s+[\w\s]+/i,
            /COSCO\s+[\w\s]+/i
          ];
          
          for (const pattern of shipPatterns) {
            const match = reference.match(pattern);
            if (match) {
              shipName = match[0].trim();
              break;
            }
          }
          
          // If no pattern match, use the reference as ship name if it looks like one
          if (!shipName && reference && !reference.includes('Cartons') && !reference.includes('LTL')) {
            shipName = reference;
          }
        }
        
        // Generate transaction ID
        const timestamp = transactionDate.getTime();
        const transactionId = `TRX-${warehouse.code}-${timestamp}-${i+1}`;
        
        // Create transaction
        await prisma.inventoryTransaction.create({
          data: {
            transactionId,
            warehouseId: warehouse.id,
            skuId: sku.id,
            batchLot,
            transactionType: transactionType as any,
            referenceId: reference || null,
            cartonsIn,
            cartonsOut,
            storagePalletsIn,
            shippingPalletsOut,
            transactionDate,
            shipName,
            createdById: adminUser.id,
            notes: null
          }
        });
        
        successCount++;
        
        if (successCount % 50 === 0) {
          console.log(`Processed ${successCount} transactions...`);
        }
        
      } catch (error) {
        errorCount++;
        errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log('\n===== Import Summary =====');
    console.log(`Total rows processed: ${data.length}`);
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\nFirst 10 errors:');
      errors.slice(0, 10).forEach(err => console.log(`  ${err}`));
    }
    
    // Update cartons per pallet from warehouse configs
    console.log('\n===== Updating Cartons Per Pallet from Configs =====');
    
    const configUpdateResult = await prisma.$executeRaw`
      UPDATE inventory_transactions t
      SET 
        storage_cartons_per_pallet = CASE 
          WHEN t.transaction_type = 'RECEIVE' THEN wsc.storage_cartons_per_pallet
          ELSE t.storage_cartons_per_pallet
        END,
        shipping_cartons_per_pallet = CASE 
          WHEN t.transaction_type = 'SHIP' THEN wsc.shipping_cartons_per_pallet
          ELSE t.shipping_cartons_per_pallet
        END
      FROM warehouse_sku_configs wsc
      WHERE t.warehouse_id = wsc.warehouse_id
        AND t.sku_id = wsc.sku_id
        AND t.transaction_date >= wsc.effective_date
        AND (wsc.end_date IS NULL OR t.transaction_date <= wsc.end_date)
    `;
    
    console.log(`Updated ${configUpdateResult} transactions with cartons per pallet from configs`);
    
    // Final verification
    console.log('\n===== Final Verification =====');
    
    const finalStats = await prisma.$queryRaw`
      SELECT 
        transaction_type,
        COUNT(*) as total,
        COUNT(CASE WHEN transaction_type = 'RECEIVE' AND storage_pallets_in > 0 THEN 1 END) as has_storage_pallets,
        COUNT(CASE WHEN transaction_type = 'SHIP' AND shipping_pallets_out > 0 THEN 1 END) as has_shipping_pallets,
        COUNT(ship_name) as has_ship_name,
        COUNT(storage_cartons_per_pallet) as has_storage_cpp,
        COUNT(shipping_cartons_per_pallet) as has_shipping_cpp
      FROM inventory_transactions
      GROUP BY transaction_type
    `;
    
    console.table(finalStats);
    
    // Show sample transactions
    console.log('\n===== Sample Imported Transactions =====');
    
    const samples = await prisma.inventoryTransaction.findMany({
      take: 5,
      orderBy: { transactionDate: 'asc' },
      include: {
        warehouse: { select: { code: true } },
        sku: { select: { skuCode: true } }
      }
    });
    
    samples.forEach(t => {
      console.log(`\n${t.transactionId}:`);
      console.log(`  Date: ${t.transactionDate.toISOString().split('T')[0]}`);
      console.log(`  Type: ${t.transactionType}`);
      console.log(`  Warehouse: ${t.warehouse.code}`);
      console.log(`  SKU: ${t.sku.skuCode}`);
      console.log(`  Batch: ${t.batchLot}`);
      console.log(`  Reference: ${t.referenceId}`);
      if (t.transactionType === 'RECEIVE') {
        console.log(`  Cartons In: ${t.cartonsIn}`);
        console.log(`  Storage Pallets: ${t.storagePalletsIn}`);
        console.log(`  Ship Name: ${t.shipName || 'N/A'}`);
      } else if (t.transactionType === 'SHIP') {
        console.log(`  Cartons Out: ${t.cartonsOut}`);
        console.log(`  Shipping Pallets: ${t.shippingPalletsOut}`);
      }
    });
    
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
reimportInventoryWithPallets();