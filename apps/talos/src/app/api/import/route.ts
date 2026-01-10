import { NextResponse } from 'next/server'
import type { PrismaClient } from '@ecom-os/prisma-talos'
import { withAuth } from '@/lib/api/auth-wrapper'
import { getTenantPrisma } from '@/lib/tenant/server'
import * as XLSX from 'xlsx'
import { getImportConfig, mapExcelRowToEntity } from '@/lib/import-config'
import { Prisma } from '@ecom-os/prisma-talos'
import { formatDimensionTripletCm, resolveDimensionTripletCm } from '@/lib/sku-dimensions'

export const dynamic = 'force-dynamic'

type ExcelRow = Record<string, unknown>

export const POST = withAuth(async (request, session) => {
  try {
    const prisma = await getTenantPrisma()
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
        const result = await importSkus(data, session.user.id, prisma)
        imported = result.imported
        skipped = result.skipped
        errors.push(...result.errors)
        break

      case 'warehouses':
        const warehouseResult = await importWarehouses(data, session.user.id, prisma)
        imported = warehouseResult.imported
        skipped = warehouseResult.skipped
        errors.push(...warehouseResult.errors)
        break

      default:
        return NextResponse.json(
          { error: 'Import not implemented for this entity' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      result: { imported, skipped, errors },
    })
  } catch (_error) {
    // console.error('Import error:', error)
    return NextResponse.json(
      {
        error: 'Failed to import file',
        details: _error instanceof Error ? _error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})

async function importSkus(data: ExcelRow[], _userId: string, prisma: PrismaClient) {
  const config = getImportConfig('skus')!
  let imported = 0
  let skipped = 0
  const errors: string[] = []
  const allowedSkuFields = new Set([
    'skuCode',
    'asin',
    'description',
    'packSize',
    'material',
    'unitDimensionsCm',
    'unitLengthCm',
    'unitWidthCm',
    'unitHeightCm',
    'unitWeightKg',
    'unitsPerCarton',
    'cartonDimensionsCm',
    'cartonLengthCm',
    'cartonWidthCm',
    'cartonHeightCm',
    'cartonWeightKg',
    'packagingType',
  ])

  for (const row of data) {
    try {
      const { data: mappedData, errors: mappingErrors } = mapExcelRowToEntity(row, config)

      if (mappingErrors.length > 0) {
        const skuLabel = String(row['SKU'] ?? mappedData.skuCode ?? 'unknown')
        errors.push(`Row ${skuLabel}: ${mappingErrors.join(', ')}`)
        skipped++
        continue
      }

      const skuCode = mappedData.skuCode as string | undefined

      if (!skuCode) {
        errors.push('Row unknown: Missing SKU code')
        skipped++
        continue
      }

      const unitDimensionsCm = mappedData.unitDimensionsCm as string | undefined
      const cartonDimensionsCm = mappedData.cartonDimensionsCm as string | undefined

      const unitTriplet = resolveDimensionTripletCm({
        legacy: unitDimensionsCm,
      })
      if (unitDimensionsCm && !unitTriplet) {
        errors.push(`SKU ${skuCode}: Unit dimensions must be a valid LxWxH triple`)
        skipped++
        continue
      }

      const cartonTriplet = resolveDimensionTripletCm({
        legacy: cartonDimensionsCm,
      })
      if (cartonDimensionsCm && !cartonTriplet) {
        errors.push(`SKU ${skuCode}: Carton dimensions must be a valid LxWxH triple`)
        skipped++
        continue
      }

      if (unitTriplet) {
        mappedData.unitDimensionsCm = formatDimensionTripletCm(unitTriplet)
        mappedData.unitLengthCm = unitTriplet.lengthCm
        mappedData.unitWidthCm = unitTriplet.widthCm
        mappedData.unitHeightCm = unitTriplet.heightCm
      }

      if (cartonTriplet) {
        mappedData.cartonDimensionsCm = formatDimensionTripletCm(cartonTriplet)
        mappedData.cartonLengthCm = cartonTriplet.lengthCm
        mappedData.cartonWidthCm = cartonTriplet.widthCm
        mappedData.cartonHeightCm = cartonTriplet.heightCm
      }

      const skuPayload = Object.fromEntries(
        Object.entries(mappedData).filter(
          ([key, value]) => allowedSkuFields.has(key) && value !== undefined
        )
      )

      await prisma.sku.upsert({
        where: { skuCode },
        update: skuPayload as unknown as Prisma.SkuUpdateInput,
        create: skuPayload as unknown as Prisma.SkuCreateInput,
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

async function importWarehouses(data: ExcelRow[], _userId: string, prisma: PrismaClient) {
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
        create: mappedData as unknown as Prisma.WarehouseCreateInput,
      })
      imported++
    } catch (_error) {
      const warehouseLabel = String(row['Code'] ?? 'unknown')
      errors.push(
        `Warehouse ${warehouseLabel}: ${_error instanceof Error ? _error.message : 'Unknown error'}`
      )
      skipped++
    }
  }

  return { imported, skipped, errors }
}
