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

  // Get warehouse and SKU mappings
  const warehouses = await prisma.warehouse.findMany()
  const warehouseMap = new Map(warehouses.map(w => [w.name.toLowerCase(), w]))
  
  const skus = await prisma.sku.findMany()
  const skuMap = new Map(skus.map(s => [s.skuCode, s]))

  for (const row of data) {
    try {
      if (!row.Transaction_ID || !row.Warehouse || !row.SKU) {
        skipped++
        continue
      }

      const warehouse = warehouseMap.get(row.Warehouse.toLowerCase())
      if (!warehouse) {
        errors.push(`Warehouse ${row.Warehouse} not found for transaction ${row.Transaction_ID}`)
        continue
      }

      const sku = skuMap.get(row.SKU)
      if (!sku) {
        errors.push(`SKU ${row.SKU} not found for transaction ${row.Transaction_ID}`)
        continue
      }

      // Convert Excel date to JS date
      const transactionDate = row.Timestamp 
        ? new Date((row.Timestamp - 25569) * 86400 * 1000)
        : new Date()

      // Extract batch/lot from Shipment field
      const batchLot = row.Shipment?.toString() || 'DEFAULT'

      // Check if transaction already exists
      const existing = await prisma.inventoryTransaction.findUnique({
        where: { transactionId: row.Transaction_ID }
      })

      if (existing) {
        skipped++
        continue
      }

      await prisma.inventoryTransaction.create({
        data: {
          transactionId: row.Transaction_ID,
          warehouseId: warehouse.id,
          skuId: sku.id,
          batchLot,
          transactionType: row.Transaction_Type || 'RECEIVE',
          referenceId: row['Reference_ID (Email tag)'] || null,
          cartonsIn: parseInt(row.Cartons_In) || 0,
          cartonsOut: parseInt(row.Cartons_Out) || 0,
          storagePalletsIn: parseInt(row.storage_pallets_in) || 0,
          shippingPalletsOut: parseInt(row.shipping_pallets_out) || 0,
          notes: row.Notes || null,
          transactionDate,
          createdById: userId,
          // Try to extract additional info from reference field
          shipName: extractShipName(row['Reference_ID (Email tag)']),
          containerNumber: extractContainerNumber(row['Reference_ID (Email tag)'])
        }
      })
      imported++
    } catch (error) {
      errors.push(`Transaction ${row.Transaction_ID}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { sheet: 'Inventory Ledger', imported, skipped, errors }
}

function extractShipName(reference: string): string | null {
  if (!reference) return null
  
  // Common ship name patterns
  const patterns = [
    /MV\s+([^,]+)/i,
    /M\/V\s+([^,]+)/i,
    /vessel:\s*([^,]+)/i,
    /ship:\s*([^,]+)/i,
    /^([^-,]+)/  // First part before comma or dash
  ]

  for (const pattern of patterns) {
    const match = reference.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }

  return null
}

function extractContainerNumber(reference: string): string | null {
  if (!reference) return null
  
  // Container number pattern (4 letters + 7 digits)
  const containerPattern = /\b[A-Z]{4}\d{7}\b/
  const match = reference.match(containerPattern)
  
  return match ? match[0] : null
}