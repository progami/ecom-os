import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { getImportConfig, mapExcelRowToEntity } from '@/lib/import-config'
import type { Warehouse, Sku } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const entityName = formData.get('entityName') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!entityName) {
      return NextResponse.json({ error: 'No entity name provided' }, { status: 400 })
    }

    const config = getImportConfig(entityName)
    if (!config) {
      return NextResponse.json({ error: 'Invalid entity name' }, { status: 400 })
    }

    // Read file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[]

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    // Process based on entity type
    switch (entityName) {
      case 'skus':
        const result = await importSkus(data, session.user.id)
        imported = result.imported
        skipped = result.skipped
        errors.push(...result.errors)
        break

      case 'warehouses':
        const warehouseResult = await importWarehouses(data, session.user.id)
        imported = warehouseResult.imported
        skipped = warehouseResult.skipped
        errors.push(...warehouseResult.errors)
        break

      case 'warehouseSkuConfigs':
        const configResult = await importWarehouseSkuConfigs(data, session.user.id)
        imported = configResult.imported
        skipped = configResult.skipped
        errors.push(...configResult.errors)
        break

      case 'costRates':
        const costResult = await importCostRates(data, session.user.id)
        imported = costResult.imported
        skipped = costResult.skipped
        errors.push(...costResult.errors)
        break

      case 'inventoryTransactions':
        const transactionResult = await importInventoryTransactions(data, session.user.id)
        imported = transactionResult.imported
        skipped = transactionResult.skipped
        errors.push(...transactionResult.errors)
        break

      default:
        return NextResponse.json({ error: 'Import not implemented for this entity' }, { status: 400 })
    }

    return NextResponse.json({ 
      result: { imported, skipped, errors }
    })
  } catch (_error) {
    // console.error('Import error:', error)
    return NextResponse.json({ 
      error: 'Failed to import file',
      details: _error instanceof Error ? _error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function importSkus(data: unknown[], _userId: string) {
  const config = getImportConfig('skus')!
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of data) {
    try {
      const { data: mappedData, errors: mappingErrors } = mapExcelRowToEntity(row, config)
      
      if (mappingErrors.length > 0) {
        errors.push(`Row ${row.SKU || 'unknown'}: ${mappingErrors.join(', ')}`)
        skipped++
        continue
      }

      await prisma.sku.upsert({
        where: { skuCode: mappedData.skuCode as string },
        update: mappedData as Prisma.SkuUpdateInput,
        create: mappedData as Prisma.SkuCreateInput
      })
      imported++
    } catch (_error) {
      errors.push(`SKU ${row.SKU}: ${_error instanceof Error ? _error.message : 'Unknown error'}`)
      skipped++
    }
  }

  return { imported, skipped, errors }
}

async function importWarehouses(data: unknown[], _userId: string) {
  const config = getImportConfig('warehouses')!
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of data) {
    try {
      const { data: mappedData, errors: mappingErrors } = mapExcelRowToEntity(row, config)
      
      if (mappingErrors.length > 0) {
        errors.push(`Row ${row.Code || 'unknown'}: ${mappingErrors.join(', ')}`)
        skipped++
        continue
      }

      await prisma.warehouse.upsert({
        where: { code: mappedData.code as string },
        update: mappedData as Prisma.WarehouseUpdateInput,
        create: mappedData as Prisma.WarehouseCreateInput
      })
      imported++
    } catch (_error) {
      errors.push(`Warehouse ${row.Code}: ${_error instanceof Error ? _error.message : 'Unknown error'}`)
      skipped++
    }
  }

  return { imported, skipped, errors }
}

async function importWarehouseSkuConfigs(data: unknown[], _userId: string) {
  const config = getImportConfig('warehouseSkuConfigs')!
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  // Get warehouse and SKU mappings
  const warehouses = await prisma.warehouse.findMany()
  const warehouseMap = new Map<string, Warehouse>(warehouses.map(w => [w.name.toLowerCase(), w]))
  
  const skus = await prisma.sku.findMany()
  const skuMap = new Map<string, Sku>(skus.map(s => [s.skuCode, s]))

  for (const row of data) {
    try {
      const { data: mappedData, errors: mappingErrors } = mapExcelRowToEntity(row, config)
      
      if (mappingErrors.length > 0) {
        errors.push(`Row ${row.warehouse}/${row.SKU}: ${mappingErrors.join(', ')}`)
        skipped++
        continue
      }

      const warehouseName = String(mappedData.warehouse).toLowerCase()
      const warehouse = warehouseMap.get(warehouseName)
      if (!warehouse) {
        errors.push(`Warehouse ${mappedData.warehouse} not found`)
        skipped++
        continue
      }

      const skuCode = String(mappedData.sku)
      const sku = skuMap.get(skuCode)
      if (!sku) {
        errors.push(`SKU ${mappedData.sku} not found`)
        skipped++
        continue
      }

      // Remove warehouse and sku from mapped data and add IDs
      const { warehouse: _, sku: __, ..._configData } = mappedData
      
      // WarehouseSkuConfig removed in v0.5.0
      // Pallet configs now stored in transactions
      imported++
    } catch (_error) {
      if (_error instanceof Error && _error.message.includes('Unique constraint')) {
        skipped++
      } else {
        errors.push(`Config ${row.warehouse}/${row.SKU}: ${_error instanceof Error ? _error.message : 'Unknown error'}`)
      }
    }
  }

  return { imported, skipped, errors }
}

async function importCostRates(data: unknown[], userId: string) {
  const config = getImportConfig('costRates')!
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  // Get warehouse mapping
  const warehouses = await prisma.warehouse.findMany()
  const warehouseMap = new Map<string, Warehouse>(warehouses.map(w => [w.name.toLowerCase(), w]))

  for (const row of data) {
    try {
      const { data: mappedData, errors: mappingErrors } = mapExcelRowToEntity(row, config)
      
      if (mappingErrors.length > 0) {
        errors.push(`Row ${row.cost_name}: ${mappingErrors.join(', ')}`)
        skipped++
        continue
      }

      const warehouseName = String(mappedData.warehouse).toLowerCase()
      const warehouse = warehouseMap.get(warehouseName)
      if (!warehouse) {
        errors.push(`Warehouse ${mappedData.warehouse} not found`)
        skipped++
        continue
      }

      // Remove warehouse from mapped data and add ID
      const { warehouse: _, ...costData } = mappedData
      
      await prisma.costRate.create({
        data: {
          ...costData as Omit<Prisma.CostRateCreateInput, 'warehouseId' | 'createdById'>,
          warehouseId: warehouse.id,
          createdById: userId
        }
      })
      imported++
    } catch (_error) {
      if (_error instanceof Error && _error.message.includes('Unique constraint')) {
        skipped++
      } else {
        errors.push(`Cost ${row.cost_name}: ${_error instanceof Error ? _error.message : 'Unknown error'}`)
      }
    }
  }

  return { imported, skipped, errors }
}

async function importInventoryTransactions(data: unknown[], userId: string) {
  const config = getImportConfig('inventoryTransactions')!
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  // Get warehouse and SKU mappings
  const warehouses = await prisma.warehouse.findMany()
  const warehouseMap = new Map<string, Warehouse>(warehouses.map(w => [w.name.toLowerCase(), w]))
  
  const skus = await prisma.sku.findMany()
  const skuMap = new Map<string, Sku>(skus.map(s => [s.skuCode, s]))

  for (const row of data) {
    try {
      const { data: mappedData, errors: mappingErrors } = mapExcelRowToEntity(row, config)
      
      if (mappingErrors.length > 0) {
        errors.push(`Transaction ${row.transaction_id}: ${mappingErrors.join(', ')}`)
        skipped++
        continue
      }

      const warehouseName = String(mappedData.warehouse).toLowerCase()
      const warehouse = warehouseMap.get(warehouseName)
      if (!warehouse) {
        errors.push(`Warehouse ${mappedData.warehouse} not found for transaction ${mappedData.transactionId}`)
        skipped++
        continue
      }

      const skuCode = String(mappedData.sku)
      const sku = skuMap.get(skuCode)
      if (!sku) {
        errors.push(`SKU ${mappedData.sku} not found for transaction ${mappedData.transactionId}`)
        skipped++
        continue
      }

      // Remove warehouse and sku from mapped data and add IDs
      const { warehouse: _, sku: __, transactionId: importedTransactionId, ...transactionData } = mappedData
      
      // Use imported transaction ID if provided, otherwise generate new one
      const transactionId = String(importedTransactionId || `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
      
      // Upsert to support both create and update operations
      await prisma.inventoryTransaction.upsert({
        where: { id: transactionId },
        create: {
          ...transactionData as Omit<Prisma.InventoryTransactionCreateInput, 'warehouseId' | 'skuId' | 'createdById'>,
          warehouseId: warehouse.id,
          skuId: sku.id,
          createdById: userId
        },
        update: {
          // Only update fields that should be modifiable
          // Transaction date, type, and amounts should be immutable
          referenceId: transactionData.referenceId as string,
          shipName: transactionData.shipName as string,
          trackingNumber: transactionData.trackingNumber as string,
          isReconciled: transactionData.isReconciled as boolean,
          // Note: We don't update critical fields like cartonsIn/Out, dates, etc.
        }
      })
      imported++
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : 'Unknown error'
      const transactionRef = row.transaction_id || 'unknown'
      
      // Add helpful context for common errors
      if (errorMessage.includes('Unique constraint') && errorMessage.includes('transactionId')) {
        errors.push(`Transaction ${transactionRef}: Transaction ID already exists with different immutable fields`)
      } else {
        errors.push(`Transaction ${transactionRef}: ${errorMessage}`)
      }
    }
  }

  return { imported, skipped, errors }
}