import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import path from 'path'

const prisma = new PrismaClient()

// Excel serial date to JavaScript Date conversion
function excelDateToJSDate(serial: number): Date {
  // Excel starts from January 1, 1900 as serial 1
  // JavaScript Date starts from January 1, 1970
  const excelEpoch = new Date(1899, 11, 30) // December 30, 1899
  const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000)
  return date
}

// Parse date from various formats
function parseDate(value: any): Date {
  if (!value) return new Date()
  
  // If it's already a Date object
  if (value instanceof Date) return value
  
  // If it's a number (Excel serial date)
  if (typeof value === 'number') return excelDateToJSDate(value)
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!isNaN(parsed.getTime())) return parsed
  }
  
  console.warn(`Could not parse date: ${value}`)
  return new Date()
}

// Map warehouse names from Excel to database
const warehouseMapping: Record<string, string> = {
  'SUFI WAREHOUSE': 'SUFI',
  'LUCKY WAREHOUSE': 'LUCKY',
  'AMAZON FBA': 'AMAZON-FBA',
  'AMAZON': 'AMAZON-FBA',
  'VGLOBAL': 'VGLOBAL',
  'FMC': 'FMC',
  '4AS': '4AS'
}

async function main() {
  console.log('Starting inventory ledger import...\n')
  
  // Check if we should clear existing data
  const args = process.argv.slice(2)
  const clearExisting = args.includes('--clear')
  
  try {
    if (clearExisting) {
      console.log('Clearing existing inventory transactions...')
      await prisma.inventoryBalance.deleteMany({})
      await prisma.inventoryTransaction.deleteMany({})
      console.log('✓ Cleared existing data\n')
    }
    // Get admin user for createdBy
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' }
    })
    
    if (!adminUser) {
      throw new Error('No admin user found. Please run create-users.ts first.')
    }
    
    // Load Excel file
    const filePath = path.join(__dirname, '../data/inventory_ledger_restructured.xlsx')
    console.log(`Reading Excel file from: ${filePath}`)
    
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet)
    console.log(`Found ${data.length} rows in the inventory ledger\n`)
    
    // Get all warehouses and SKUs for mapping
    const warehouses = await prisma.warehouse.findMany()
    const skus = await prisma.sku.findMany()
    
    const warehouseMap = new Map(warehouses.map(w => [w.code, w]))
    const skuMap = new Map(skus.map(s => [s.skuCode, s]))
    
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []
    const warnings: string[] = []
    let transactionsWithMissingPalletData = 0
    
    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]
      
      try {
        // Extract and validate data
        const warehouseName = row['Warehouse'] || row['warehouse']
        const warehouseCode = warehouseMapping[warehouseName?.toUpperCase()] || warehouseName
        const warehouse = warehouseMap.get(warehouseCode)
        
        if (!warehouse) {
          errors.push(`Row ${i + 2}: Unknown warehouse: ${warehouseName}`)
          errorCount++
          continue
        }
        
        const skuCode = row['SKU'] || row['sku']
        const sku = skuMap.get(skuCode)
        
        if (!sku) {
          errors.push(`Row ${i + 2}: Unknown SKU: ${skuCode}`)
          errorCount++
          continue
        }
        
        // Parse transaction details
        const transactionType = (row['Transaction Type'] || row['transaction_type'] || row['Transaction_Type'] || '').toUpperCase()
        const batchLot = row['Batch/Lot'] || row['batch_lot'] || row['Shipment']?.toString() || 'DEFAULT'
        const cartonsIn = parseInt(row['Cartons In'] || row['cartons_in'] || row['Cartons_In'] || '0') || 0
        const cartonsOut = parseInt(row['Cartons Out'] || row['cartons_out'] || row['Cartons_Out'] || '0') || 0
        const palletsIn = parseInt(row['Pallets In'] || row['pallets_in'] || row['storage_pallets_in'] || '0') || 0
        const palletsOut = parseInt(row['Pallets Out'] || row['pallets_out'] || row['shipping_pallets_out'] || '0') || 0
        
        // Validate critical fields for calculations
        if (transactionType === 'RECEIVE') {
          if (cartonsIn > 0 && palletsIn === 0) {
            warnings.push(`Row ${i + 2}: RECEIVE with ${cartonsIn} cartons but 0 storage pallets`)
            transactionsWithMissingPalletData++
          }
        } else if (transactionType === 'SHIP') {
          if (cartonsOut > 0 && palletsOut === 0) {
            warnings.push(`Row ${i + 2}: SHIP with ${cartonsOut} cartons but 0 shipping pallets`)
            transactionsWithMissingPalletData++
          }
        }
        
        // Parse dates
        const transactionDate = parseDate(row['Transaction Date'] || row['transaction_date'])
        const pickupDate = row['Pickup Date'] || row['pickup_date'] ? parseDate(row['Pickup Date'] || row['pickup_date']) : null
        
        // Additional details
        const referenceId = row['Reference ID'] || row['reference_id'] || null
        const shipName = row['Ship Name'] || row['ship_name'] || null
        const containerNumber = row['Container Number'] || row['container_number'] || null
        const notes = row['Notes'] || row['notes'] || null
        
        // Generate transaction ID
        const transactionId = `TRX-${warehouse.code}-${transactionDate.getTime()}-${i}`
        
        // Create transaction
        const transaction = await prisma.inventoryTransaction.create({
          data: {
            transactionId,
            warehouseId: warehouse.id,
            skuId: sku.id,
            batchLot,
            transactionType: transactionType as any,
            referenceId,
            cartonsIn,
            cartonsOut,
            storagePalletsIn: palletsIn,
            shippingPalletsOut: palletsOut,
            notes,
            transactionDate,
            pickupDate,
            shipName,
            containerNumber,
            createdById: adminUser.id,
            isReconciled: false
          }
        })
        
        successCount++
        
        // Log progress every 10 transactions
        if ((i + 1) % 10 === 0) {
          console.log(`Processed ${i + 1}/${data.length} transactions...`)
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        errors.push(`Row ${i + 2}: ${errorMessage}`)
        errorCount++
      }
    }
    
    console.log('\n=== Import Summary ===')
    console.log(`✓ Successfully imported: ${successCount} transactions`)
    console.log(`✗ Failed: ${errorCount} transactions`)
    
    if (transactionsWithMissingPalletData > 0) {
      console.log(`\n⚠️  CRITICAL: ${transactionsWithMissingPalletData} transactions have cartons but missing pallet data`)
      console.log('   This will affect storage and shipping cost calculations!')
    }
    
    if (warnings.length > 0) {
      console.log('\n=== Warnings (Missing Pallet Data) ===')
      warnings.slice(0, 10).forEach(warning => console.log(`- ${warning}`))
      if (warnings.length > 10) {
        console.log(`... and ${warnings.length - 10} more warnings`)
      }
    }
    
    if (errors.length > 0) {
      console.log('\n=== Errors ===')
      errors.slice(0, 10).forEach(error => console.log(`- ${error}`))
      if (errors.length > 10) {
        console.log(`... and ${errors.length - 10} more errors`)
      }
    }
    
    // Show sample of imported data
    console.log('\n=== Sample Imported Transactions ===')
    const samples = await prisma.inventoryTransaction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: true,
        sku: true
      }
    })
    
    samples.forEach(tx => {
      console.log(`\n${tx.transactionId}:`)
      console.log(`  Warehouse: ${tx.warehouse.name} (${tx.warehouse.code})`)
      console.log(`  SKU: ${tx.sku.skuCode} - ${tx.sku.description}`)
      console.log(`  Type: ${tx.transactionType}`)
      console.log(`  Date: ${tx.transactionDate.toISOString().split('T')[0]}`)
      console.log(`  Cartons: In=${tx.cartonsIn}, Out=${tx.cartonsOut}`)
      console.log(`  Pallets: In=${tx.storagePalletsIn}, Out=${tx.shippingPalletsOut}`)
      if (tx.batchLot !== 'DEFAULT') console.log(`  Batch/Lot: ${tx.batchLot}`)
      if (tx.referenceId) console.log(`  Reference: ${tx.referenceId}`)
    })
    
    // Update inventory balances
    console.log('\n=== Updating Inventory Balances ===')
    await updateInventoryBalances()
    
  } catch (error) {
    console.error('Fatal error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Update inventory balances based on transactions
async function updateInventoryBalances() {
  const transactions = await prisma.inventoryTransaction.findMany({
    orderBy: { transactionDate: 'asc' }
  })
  
  const balances = new Map<string, any>()
  
  for (const tx of transactions) {
    const key = `${tx.warehouseId}-${tx.skuId}-${tx.batchLot}`
    
    if (!balances.has(key)) {
      balances.set(key, {
        warehouseId: tx.warehouseId,
        skuId: tx.skuId,
        batchLot: tx.batchLot,
        currentCartons: 0,
        currentPallets: 0,
        currentUnits: 0,
        lastTransactionDate: tx.transactionDate
      })
    }
    
    const balance = balances.get(key)!
    
    // Update cartons
    balance.currentCartons += tx.cartonsIn - tx.cartonsOut
    
    // Update pallets
    balance.currentPallets += tx.storagePalletsIn - tx.shippingPalletsOut
    
    // Update last transaction date
    if (tx.transactionDate > balance.lastTransactionDate) {
      balance.lastTransactionDate = tx.transactionDate
    }
  }
  
  // Save balances to database
  let balanceCount = 0
  for (const [key, balance] of balances) {
    await prisma.inventoryBalance.upsert({
      where: {
        warehouseId_skuId_batchLot: {
          warehouseId: balance.warehouseId,
          skuId: balance.skuId,
          batchLot: balance.batchLot
        }
      },
      update: {
        currentCartons: balance.currentCartons,
        currentPallets: balance.currentPallets,
        lastTransactionDate: balance.lastTransactionDate
      },
      create: balance
    })
    balanceCount++
  }
  
  console.log(`✓ Updated ${balanceCount} inventory balances`)
}

main()