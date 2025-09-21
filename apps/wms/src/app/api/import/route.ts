import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { getImportConfig, mapExcelRowToEntity } from '@/lib/import-config'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type ExcelRow = Record<string, unknown>

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
    const data = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[]

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

async function importSkus(data: ExcelRow[], _userId: string) {
  const config = getImportConfig('skus')!
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of data) {
    try {
      const { data: mappedData, errors: mappingErrors } = mapExcelRowToEntity(row, config)
      
      if (mappingErrors.length > 0) {
        const skuLabel = String(row['SKU'] ?? mappedData.skuCode ?? 'unknown')
        errors.push(`Row ${skuLabel}: ${mappingErrors.join(', ')}`)
        skipped++
        continue
      }

      await prisma.sku.upsert({
        where: { skuCode: mappedData.skuCode as string },
        update: mappedData as unknown as Prisma.SkuUpdateInput,
        create: mappedData as unknown as Prisma.SkuCreateInput
      })
      imported++
    } catch (_error) {
      const skuLabel = String(row['SKU'] ?? 'unknown')
      errors.push(`SKU ${skuLabel}: ${_error instanceof Error ? _error.message : 'Unknown error'}`)
      skipped++
    }
  }

  return { imported, skipped, errors }
}

async function importWarehouses(data: ExcelRow[], _userId: string) {
  const config = getImportConfig('warehouses')!
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of data) {
    try {
      const { data: mappedData, errors: mappingErrors } = mapExcelRowToEntity(row, config)
      
      if (mappingErrors.length > 0) {
        const warehouseLabel = String(row['Code'] ?? mappedData.code ?? 'unknown')
        errors.push(`Row ${warehouseLabel}: ${mappingErrors.join(', ')}`)
        skipped++
        continue
      }

      await prisma.warehouse.upsert({
        where: { code: mappedData.code as string },
        update: mappedData as unknown as Prisma.WarehouseUpdateInput,
        create: mappedData as unknown as Prisma.WarehouseCreateInput
      })
      imported++
    } catch (_error) {
      const warehouseLabel = String(row['Code'] ?? 'unknown')
      errors.push(`Warehouse ${warehouseLabel}: ${_error instanceof Error ? _error.message : 'Unknown error'}`)
      skipped++
    }
  }

  return { imported, skipped, errors }
}
