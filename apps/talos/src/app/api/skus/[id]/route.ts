import { NextResponse } from 'next/server'
import { withAuthAndParams } from '@/lib/api/auth-wrapper'
import { getTenantPrisma } from '@/lib/tenant/server'
import { formatDimensionTripletCm, resolveDimensionTripletCm } from '@/lib/sku-dimensions'
export const dynamic = 'force-dynamic'

const normalizePackagingType = (value: unknown): 'BOX' | 'POLYBAG' | null => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.toUpperCase().replace(/[^A-Z]/g, '')
  if (normalized === 'BOX') return 'BOX'
  if (normalized === 'POLYBAG') return 'POLYBAG'
  return null
}

// GET /api/skus/[id] - Get a single SKU by ID
export const GET = withAuthAndParams(async (_request, params, _session) => {
  try {
    const { id } = params as { id: string }

    const prisma = await getTenantPrisma()
    const sku = await prisma.sku.findUnique({
      where: { id },
    })

    if (!sku) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
    }

    // Manually count transactions since relation no longer exists
    const transactionCount = await prisma.inventoryTransaction.count({
      where: { skuCode: sku.skuCode },
    })

    const storageLedgerCount = await prisma.storageLedger.count({
      where: { skuCode: sku.skuCode },
    })

    return NextResponse.json({
      ...sku,
      _count: {
        inventoryTransactions: transactionCount,
        storageLedgerEntries: storageLedgerCount,
      },
    })
  } catch (_error) {
    // console.error('Error fetching SKU:', error)
    return NextResponse.json({ error: 'Failed to fetch SKU' }, { status: 500 })
  }
})

// PUT /api/skus/[id] - Update a SKU
export const PUT = withAuthAndParams(async (request, params, _session) => {
  try {
    const { id } = params as { id: string }

    const prisma = await getTenantPrisma()
    const body = await request.json()

    // Validate required fields
    if (!body.skuCode || !body.description) {
      return NextResponse.json({ error: 'SKU code and description are required' }, { status: 400 })
    }

    // Check if SKU code is being changed and if new code already exists
    const existingSku = await prisma.sku.findFirst({
      where: {
        skuCode: body.skuCode,
        NOT: { id },
      },
    })

    if (existingSku) {
      return NextResponse.json({ error: 'SKU code already exists' }, { status: 400 })
    }

    // Update the SKU
    const unitTriplet = resolveDimensionTripletCm({
      lengthCm: body.unitLengthCm,
      widthCm: body.unitWidthCm,
      heightCm: body.unitHeightCm,
      legacy: body.unitDimensionsCm,
    })
    const cartonTriplet = resolveDimensionTripletCm({
      lengthCm: body.cartonLengthCm,
      widthCm: body.cartonWidthCm,
      heightCm: body.cartonHeightCm,
      legacy: body.cartonDimensionsCm,
    })

    const unitInputProvided =
      Boolean(body.unitDimensionsCm) ||
      [body.unitLengthCm, body.unitWidthCm, body.unitHeightCm].some(
        value => value !== undefined && value !== null
      )
    const cartonInputProvided =
      Boolean(body.cartonDimensionsCm) ||
      [body.cartonLengthCm, body.cartonWidthCm, body.cartonHeightCm].some(
        value => value !== undefined && value !== null
      )

    if (unitInputProvided && !unitTriplet) {
      return NextResponse.json(
        { error: 'Unit dimensions must be a valid LxWxH triple' },
        { status: 400 }
      )
    }
    if (cartonInputProvided && !cartonTriplet) {
      return NextResponse.json(
        { error: 'Carton dimensions must be a valid LxWxH triple' },
        { status: 400 }
      )
    }

    let packagingType: 'BOX' | 'POLYBAG' | null | undefined = undefined
    if (Object.prototype.hasOwnProperty.call(body, 'packagingType')) {
      if (body.packagingType === null || body.packagingType === '') {
        packagingType = null
      } else {
        const normalized = normalizePackagingType(body.packagingType)
        if (!normalized) {
          return NextResponse.json(
            { error: 'Invalid packaging type. Must be BOX or POLYBAG.' },
            { status: 400 }
          )
        }
        packagingType = normalized
      }
    }

    const updatedSku = await prisma.sku.update({
      where: { id },
      data: {
        skuCode: body.skuCode,
        asin: body.asin,
        description: body.description,
        packSize: body.packSize,
        material: body.material,
        unitDimensionsCm: unitTriplet ? formatDimensionTripletCm(unitTriplet) : null,
        unitLengthCm: unitTriplet ? unitTriplet.lengthCm : null,
        unitWidthCm: unitTriplet ? unitTriplet.widthCm : null,
        unitHeightCm: unitTriplet ? unitTriplet.heightCm : null,
        unitWeightKg: body.unitWeightKg,
        unitsPerCarton: body.unitsPerCarton,
        cartonDimensionsCm: cartonTriplet ? formatDimensionTripletCm(cartonTriplet) : null,
        cartonLengthCm: cartonTriplet ? cartonTriplet.lengthCm : null,
        cartonWidthCm: cartonTriplet ? cartonTriplet.widthCm : null,
        cartonHeightCm: cartonTriplet ? cartonTriplet.heightCm : null,
        cartonWeightKg: body.cartonWeightKg,
        packagingType,
      },
    })

    return NextResponse.json(updatedSku)
  } catch (_error) {
    // console.error('Error updating SKU:', error)
    return NextResponse.json({ error: 'Failed to update SKU' }, { status: 500 })
  }
})

// DELETE /api/skus/[id] - Delete a SKU
export const DELETE = withAuthAndParams(async (_request, params, _session) => {
  try {
    const { id } = params as { id: string }

    const prisma = await getTenantPrisma()
    // Check if SKU has related data
    const sku = await prisma.sku.findUnique({
      where: { id },
    })

    if (!sku) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
    }

    // Manually count related data since relations no longer exist
    const transactionCount = await prisma.inventoryTransaction.count({
      where: { skuCode: sku.skuCode },
    })

    const storageLedgerCount = await prisma.storageLedger.count({
      where: { skuCode: sku.skuCode },
    })

    if (transactionCount > 0 || storageLedgerCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete SKU "${sku.skuCode}". References found: inventory transactions=${transactionCount}, storage ledger=${storageLedgerCount}.`,
        },
        { status: 409 }
      )
    }

    // Otherwise, delete the SKU
    await prisma.sku.delete({
      where: { id: id },
    })

    return NextResponse.json({
      message: 'SKU deleted successfully',
    })
  } catch (_error) {
    // console.error('Error deleting SKU:', error)
    return NextResponse.json({ error: 'Failed to delete SKU' }, { status: 500 })
  }
})
