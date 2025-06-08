import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const selectedSheets = JSON.parse(formData.get('sheets') as string || '[]')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

    const results = []

    // Import SKU Master
    if (selectedSheets.includes('sku master') && workbook.Sheets['sku master']) {
      const result = await importSkuMaster(workbook.Sheets['sku master'])
      results.push(result)
    }

    // Import Warehouse Config
    if (selectedSheets.includes('warehouse config') && workbook.Sheets['warehouse config']) {
      const result = await importWarehouseConfig(workbook.Sheets['warehouse config'], session.user.id)
      results.push(result)
    }

    // Import Cost Master
    if (selectedSheets.includes('cost master') && workbook.Sheets['cost master']) {
      const result = await importCostMaster(workbook.Sheets['cost master'], session.user.id)
      results.push(result)
    }

    // Import Inventory Ledger
    if (selectedSheets.includes('inventory ledger') && workbook.Sheets['inventory ledger']) {
      const result = await importInventoryLedger(workbook.Sheets['inventory ledger'], session.user.id)
      results.push(result)
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ 
      error: 'Failed to import Excel file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function importSkuMaster(sheet: XLSX.WorkSheet) {
  const data = XLSX.utils.sheet_to_json(sheet) as any[]
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of data) {
    try {
      if (!row.SKU) {
        skipped++
        continue
      }

      await prisma.sku.upsert({
        where: { skuCode: row.SKU },
        update: {
          asin: row.ASIN || null,
          description: row.Description || '',
          packSize: parseInt(row.Pack_Size) || 1,
          material: row.Material || null,
          unitDimensionsCm: row.Unit_Dimensions_cm || null,
          unitWeightKg: parseFloat(row.Unit_Weight_KG) || null,
          unitsPerCarton: parseInt(row.Units_Per_Carton) || 1,
          cartonDimensionsCm: row.Carton_Dimensions_cm || null,
          cartonWeightKg: parseFloat(row.Carton_Weight_KG) || null,
          packagingType: row.Packaging_Type || null,
          notes: row.Notes || null
        },
        create: {
          skuCode: row.SKU,
          asin: row.ASIN || null,
          description: row.Description || '',
          packSize: parseInt(row.Pack_Size) || 1,
          material: row.Material || null,
          unitDimensionsCm: row.Unit_Dimensions_cm || null,
          unitWeightKg: parseFloat(row.Unit_Weight_KG) || null,
          unitsPerCarton: parseInt(row.Units_Per_Carton) || 1,
          cartonDimensionsCm: row.Carton_Dimensions_cm || null,
          cartonWeightKg: parseFloat(row.Carton_Weight_KG) || null,
          packagingType: row.Packaging_Type || null,
          notes: row.Notes || null
        }
      })
      imported++
    } catch (error) {
      errors.push(`SKU ${row.SKU}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { sheet: 'SKU Master', imported, skipped, errors }
}

async function importWarehouseConfig(sheet: XLSX.WorkSheet, userId: string) {
  const data = XLSX.utils.sheet_to_json(sheet) as any[]
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  // Get warehouse mapping
  const warehouses = await prisma.warehouse.findMany()
  const warehouseMap = new Map(warehouses.map(w => [w.name.toLowerCase(), w]))

  for (const row of data) {
    try {
      if (!row.warehouse || !row.SKU) {
        skipped++
        continue
      }

      const warehouse = warehouseMap.get(row.warehouse.toLowerCase())
      if (!warehouse) {
        errors.push(`Warehouse ${row.warehouse} not found`)
        continue
      }

      const sku = await prisma.sku.findUnique({
        where: { skuCode: row.SKU }
      })
      if (!sku) {
        errors.push(`SKU ${row.SKU} not found`)
        continue
      }

      // Convert Excel date to JS date
      const effectiveDate = row.effective_date 
        ? new Date((row.effective_date - 25569) * 86400 * 1000)
        : new Date()

      await prisma.warehouseSkuConfig.create({
        data: {
          warehouseId: warehouse.id,
          skuId: sku.id,
          storageCartonsPerPallet: parseInt(row.storage_cartons_per_pallet) || 1,
          shippingCartonsPerPallet: parseInt(row.shipping_cartons_per_pallet) || 1,
          maxStackingHeightCm: row.max_stacking_height_cm ? parseInt(row.max_stacking_height_cm) : null,
          effectiveDate,
          endDate: row.end_date ? new Date((row.end_date - 25569) * 86400 * 1000) : null,
          notes: row.notes || null,
          createdById: userId
        }
      })
      imported++
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        skipped++
      } else {
        errors.push(`Config for ${row.warehouse}/${row.SKU}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  return { sheet: 'Warehouse Config', imported, skipped, errors }
}

async function importCostMaster(sheet: XLSX.WorkSheet, userId: string) {
  const data = XLSX.utils.sheet_to_json(sheet) as any[]
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  // Get warehouse mapping
  const warehouses = await prisma.warehouse.findMany()
  const warehouseMap = new Map(warehouses.map(w => [w.name.toLowerCase(), w]))

  // Category mapping
  const categoryMap: { [key: string]: string } = {
    'storage': 'STORAGE',
    'container': 'CONTAINER',
    'pallet': 'PALLET',
    'carton': 'CARTON',
    'unit': 'UNIT',
    'shipment': 'SHIPMENT',
    'accessorial': 'ACCESSORIAL'
  }

  for (const row of data) {
    try {
      if (!row.warehouse || !row.cost_name || !row.cost_value) {
        skipped++
        continue
      }

      const warehouse = warehouseMap.get(row.warehouse.toLowerCase())
      if (!warehouse) {
        errors.push(`Warehouse ${row.warehouse} not found`)
        continue
      }

      const category = categoryMap[row.cost_category?.toLowerCase()] || 'ACCESSORIAL'
      const effectiveDate = row.effective_date 
        ? new Date((row.effective_date - 25569) * 86400 * 1000)
        : new Date()

      await prisma.costRate.create({
        data: {
          warehouseId: warehouse.id,
          costCategory: category as any,
          costName: row.cost_name,
          costValue: parseFloat(row.cost_value),
          unitOfMeasure: row.unit_of_measure || 'unit',
          effectiveDate,
          endDate: row.end_date ? new Date((row.end_date - 25569) * 86400 * 1000) : null,
          notes: row.notes || null,
          createdById: userId
        }
      })
      imported++
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        skipped++
      } else {
        errors.push(`Cost ${row.cost_name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  return { sheet: 'Cost Master', imported, skipped, errors }
}

async function importInventoryLedger(sheet: XLSX.WorkSheet, userId: string) {
  const data = XLSX.utils.sheet_to_json(sheet) as any[]
  let imported = 0
  let skipped = 0
  const errors: string[] = []
  const warnings: string[] = []
  const criticalFieldsMissing: string[] = []

  // Get warehouse and SKU mappings
  const warehouses = await prisma.warehouse.findMany()
  const warehouseMap = new Map(warehouses.map(w => [w.name.toLowerCase(), w]))
  
  const skus = await prisma.sku.findMany()
  const skuMap = new Map(skus.map(s => [s.skuCode, s]))

  // Track missing pallet data
  let transactionsWithMissingPalletData = 0

  for (const row of data) {
    try {
      // Use the new column names from restructured file
      const transactionId = row.transaction_id || row.Transaction_ID
      const warehouseName = row.warehouse || row.Warehouse
      const skuCode = row.sku || row.SKU
      const transactionType = row.transaction_type || row.Transaction_Type || 'RECEIVE'
      
      if (!transactionId || !warehouseName || !skuCode) {
        skipped++
        errors.push(`Row missing required fields - Transaction ID: ${transactionId || 'MISSING'}, Warehouse: ${warehouseName || 'MISSING'}, SKU: ${skuCode || 'MISSING'}`)
        continue
      }

      const warehouse = warehouseMap.get(warehouseName.toLowerCase())
      if (!warehouse) {
        errors.push(`Warehouse ${warehouseName} not found for transaction ${transactionId}`)
        continue
      }

      const sku = skuMap.get(skuCode)
      if (!sku) {
        errors.push(`SKU ${skuCode} not found for transaction ${transactionId}`)
        continue
      }

      // Parse date - handle both formats
      let transactionDate = new Date()
      if (row.transaction_date) {
        transactionDate = new Date(row.transaction_date)
      } else if (row.Timestamp) {
        if (typeof row.Timestamp === 'number') {
          transactionDate = new Date((row.Timestamp - 25569) * 86400 * 1000)
        } else {
          transactionDate = new Date(row.Timestamp)
        }
      }

      // Parse pickup date if available
      let pickupDate = null
      if (row.pickup_date) {
        pickupDate = new Date(row.pickup_date)
      }

      // Extract batch/lot
      const batchLot = row.batch_lot || row.Shipment?.toString() || 'DEFAULT'

      // Check if transaction already exists
      const existing = await prisma.inventoryTransaction.findUnique({
        where: { transactionId }
      })

      if (existing) {
        skipped++
        continue
      }

      // Build attachments object from flags
      const attachments: any = {}
      if (row.has_packing_list === 'TRUE') {
        attachments.packingList = { exists: true }
      }
      if (row.has_commercial_invoice === 'TRUE') {
        attachments.commercialInvoice = { exists: true }
      }
      if (row.has_delivery_note === 'TRUE') {
        attachments.deliveryNote = { exists: true }
      }
      if (row.has_cubemaster === 'TRUE') {
        attachments.cubemaster = { exists: true }
      }

      // Parse cartons and pallets - handle both naming conventions
      const cartonsIn = parseInt(row.cartons_in || row.Cartons_In || '0') || 0
      const cartonsOut = parseInt(row.cartons_out || row.Cartons_Out || '0') || 0
      const storagePalletsIn = parseInt(row.storage_pallets_in || row.Pallets_In || '0') || 0
      const shippingPalletsOut = parseInt(row.shipping_pallets_out || row.Pallets_Out || '0') || 0

      // Validate critical fields for calculations
      if (transactionType === 'RECEIVE') {
        if (cartonsIn > 0 && storagePalletsIn === 0) {
          warnings.push(`Transaction ${transactionId}: RECEIVE with ${cartonsIn} cartons but 0 storage pallets - this will affect cost calculations`)
          transactionsWithMissingPalletData++
        }
      } else if (transactionType === 'SHIP') {
        if (cartonsOut > 0 && shippingPalletsOut === 0) {
          warnings.push(`Transaction ${transactionId}: SHIP with ${cartonsOut} cartons but 0 shipping pallets - this will affect cost calculations`)
          transactionsWithMissingPalletData++
        }
      }

      // Get pallet configurations
      let storageCartonsPerPallet = null
      let shippingCartonsPerPallet = null
      
      if (row.storage_cartons_per_pallet) {
        storageCartonsPerPallet = parseInt(row.storage_cartons_per_pallet)
      }
      if (row.shipping_cartons_per_pallet) {
        shippingCartonsPerPallet = parseInt(row.shipping_cartons_per_pallet)
      }

      // Check for warehouse configs
      const hasWarehouseConfig = await prisma.warehouseSkuConfig.findFirst({
        where: {
          warehouseId: warehouse.id,
          skuId: sku.id,
          effectiveDate: { lte: transactionDate },
          OR: [
            { endDate: null },
            { endDate: { gte: transactionDate } }
          ]
        }
      })

      if (!hasWarehouseConfig) {
        if (transactionType === 'RECEIVE' && !storageCartonsPerPallet) {
          warnings.push(`Transaction ${transactionId}: No warehouse config or storage_cartons_per_pallet for ${warehouse.name}/${sku.skuCode}`)
        } else if (transactionType === 'SHIP' && !shippingCartonsPerPallet) {
          warnings.push(`Transaction ${transactionId}: No warehouse config or shipping_cartons_per_pallet for ${warehouse.name}/${sku.skuCode}`)
        }
      }

      await prisma.inventoryTransaction.create({
        data: {
          transactionId,
          warehouseId: warehouse.id,
          skuId: sku.id,
          batchLot,
          transactionType: transactionType as any,
          referenceId: row.reference_id || row['Reference_ID (Email tag)'] || null,
          cartonsIn,
          cartonsOut,
          storagePalletsIn,
          shippingPalletsOut,
          notes: row.notes || row.Notes || null,
          transactionDate,
          pickupDate,
          isReconciled: row.is_reconciled === 'TRUE',
          createdById: userId,
          shipName: row.ship_name || null,
          containerNumber: row.container_number || null,
          storageCartonsPerPallet,
          shippingCartonsPerPallet,
          attachments: Object.keys(attachments).length > 0 ? attachments : null
        }
      })
      imported++
    } catch (error) {
      errors.push(`Transaction ${row.transaction_id || row.Transaction_ID}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Add summary of critical missing data
  if (transactionsWithMissingPalletData > 0) {
    criticalFieldsMissing.push(`${transactionsWithMissingPalletData} transactions have cartons but missing pallet data (storage_pallets_in or shipping_pallets_out)`)
  }

  const warehouseConfigCount = await prisma.warehouseSkuConfig.count()
  if (warehouseConfigCount === 0) {
    criticalFieldsMissing.push('No warehouse SKU configurations found - cartons per pallet calculations will fail')
  }

  // Report systematically missing fields that are not in Excel
  const missingFieldsNotInExcel = []
  
  // RECEIVE transaction missing fields
  missingFieldsNotInExcel.push('For RECEIVE transactions:')
  missingFieldsNotInExcel.push('  • container_number - Required for tracking specific containers')
  missingFieldsNotInExcel.push('  • attachments - Packing lists, commercial invoices, etc.')
  
  // SHIP transaction missing fields  
  missingFieldsNotInExcel.push('\nFor SHIP transactions:')
  missingFieldsNotInExcel.push('  • pickup_date - Required for scheduling and tracking')
  missingFieldsNotInExcel.push('  • ship_name/destination - Required for delivery tracking')
  missingFieldsNotInExcel.push('  • container_number - If shipping via container')
  missingFieldsNotInExcel.push('  • attachments - Delivery notes, shipping documents')
  
  missingFieldsNotInExcel.push('\nThese fields must be added via Import Attributes after initial import')

  return { 
    sheet: 'Inventory Ledger', 
    imported, 
    skipped, 
    errors, 
    warnings: warnings.slice(0, 10), // Limit warnings to first 10
    criticalFieldsMissing,
    missingFieldsNotInExcel,
    totalWarnings: warnings.length
  }
}

