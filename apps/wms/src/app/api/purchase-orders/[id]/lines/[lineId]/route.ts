import { NextRequest } from 'next/server'
import { withAuthAndParams, ApiResponses, z } from '@/lib/api'
import { getTenantPrisma, getCurrentTenant } from '@/lib/tenant/server'
import { NotFoundError } from '@/lib/api'
import { hasPermission } from '@/lib/services/permission-service'
import { Prisma } from '@ecom-os/prisma-wms'

const UpdateLineSchema = z.object({
  skuCode: z.string().trim().min(1).optional(),
  skuDescription: z.string().optional(),
  batchLot: z.string().trim().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  unitCost: z.number().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  quantityReceived: z.number().int().min(0).optional(),
})

/**
 * GET /api/purchase-orders/[id]/lines/[lineId]
 * Get a specific line item
 */
export const GET = withAuthAndParams(async (request: NextRequest, params, _session) => {
  const id = params.id as string
  const lineId = params.lineId as string
  const tenant = await getCurrentTenant()
  const prisma = await getTenantPrisma()

  const line = await prisma.purchaseOrderLine.findFirst({
    where: {
      id: lineId,
      purchaseOrderId: id,
    },
  })

  if (!line) {
    throw new NotFoundError(`Line item not found: ${lineId}`)
  }

  return ApiResponses.success({
    id: line.id,
    skuCode: line.skuCode,
    skuDescription: line.skuDescription,
    batchLot: line.batchLot,
    quantity: line.quantity,
    unitCost: line.unitCost ? Number(line.unitCost) : null,
    currency: line.currency || tenant.currency,
    status: line.status,
    quantityReceived: line.quantityReceived,
    lineNotes: line.lineNotes,
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
  })
})

/**
 * PATCH /api/purchase-orders/[id]/lines/[lineId]
 * Update a line item
 */
export const PATCH = withAuthAndParams(async (request: NextRequest, params, _session) => {
  const id = params.id as string
  const lineId = params.lineId as string
  const prisma = await getTenantPrisma()

  const canEdit = await hasPermission(_session.user.id, 'po.edit')
  if (!canEdit) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
  })

  if (!order) {
    throw new NotFoundError(`Purchase Order not found: ${id}`)
  }

  const line = await prisma.purchaseOrderLine.findFirst({
    where: {
      id: lineId,
      purchaseOrderId: id,
    },
  })

  if (!line) {
    throw new NotFoundError(`Line item not found: ${lineId}`)
  }

  // Only allow editing most fields in DRAFT status
  // quantityReceived can be edited in WAREHOUSE status
  const payload = await request.json().catch(() => null)
  const result = UpdateLineSchema.safeParse(payload)

  if (!result.success) {
    return ApiResponses.badRequest(
      `Invalid payload: ${result.error.errors.map(e => e.message).join(', ')}`
    )
  }

  const updateData: Prisma.PurchaseOrderLineUpdateInput = {}

  // Core fields - only editable in DRAFT
  if (order.status === 'DRAFT') {
    if (result.data.skuCode !== undefined) updateData.skuCode = result.data.skuCode
    if (result.data.skuDescription !== undefined)
      updateData.skuDescription = result.data.skuDescription
    if (result.data.quantity !== undefined) updateData.quantity = result.data.quantity
    if (result.data.unitCost !== undefined) updateData.unitCost = result.data.unitCost
    if (result.data.currency !== undefined) updateData.currency = result.data.currency
    if (result.data.notes !== undefined) updateData.lineNotes = result.data.notes
  }

  // quantityReceived - editable in WAREHOUSE status
  if (order.status === 'WAREHOUSE' && result.data.quantityReceived !== undefined) {
    if (result.data.quantityReceived > line.quantity) {
      return ApiResponses.badRequest('quantityReceived cannot exceed ordered quantity')
    }
    updateData.quantityReceived = result.data.quantityReceived
  }

  if (Object.keys(updateData).length === 0) {
    return ApiResponses.badRequest('No valid fields to update for current order status')
  }

  if (order.status === 'DRAFT') {
    const DEFAULT_BATCH_LOT = 'DEFAULT'
    const skuCodeChanged =
      result.data.skuCode !== undefined &&
      result.data.skuCode.trim().toLowerCase() !== line.skuCode.trim().toLowerCase()

    const nextSkuCode = (result.data.skuCode ?? line.skuCode).trim()
    const requestedBatchLot = result.data.batchLot?.trim()

    const nextBatchLot = (
      requestedBatchLot
        ? requestedBatchLot
        : skuCodeChanged
          ? DEFAULT_BATCH_LOT
          : line.batchLot ?? DEFAULT_BATCH_LOT
    )
      .trim()
      .toUpperCase()

    if (!line.batchLot || line.batchLot.trim().toUpperCase() !== nextBatchLot) {
      updateData.batchLot = nextBatchLot
    }

    const sku = await prisma.sku.findFirst({
      where: { skuCode: nextSkuCode },
      select: {
        id: true,
        skuCode: true,
        packSize: true,
        unitsPerCarton: true,
        material: true,
        unitDimensionsCm: true,
        unitLengthCm: true,
        unitWidthCm: true,
        unitHeightCm: true,
        unitWeightKg: true,
        cartonDimensionsCm: true,
        cartonLengthCm: true,
        cartonWidthCm: true,
        cartonHeightCm: true,
        cartonWeightKg: true,
        packagingType: true,
      },
    })

    if (!sku) {
      return ApiResponses.badRequest(`SKU ${nextSkuCode} not found. Create the SKU first.`)
    }

    await prisma.skuBatch.upsert({
      where: {
        skuId_batchCode: {
          skuId: sku.id,
          batchCode: DEFAULT_BATCH_LOT,
        },
      },
      create: {
        skuId: sku.id,
        batchCode: DEFAULT_BATCH_LOT,
        packSize: sku.packSize,
        unitsPerCarton: sku.unitsPerCarton,
        material: sku.material,
        unitDimensionsCm: sku.unitDimensionsCm,
        unitLengthCm: sku.unitLengthCm,
        unitWidthCm: sku.unitWidthCm,
        unitHeightCm: sku.unitHeightCm,
        unitWeightKg: sku.unitWeightKg,
        cartonDimensionsCm: sku.cartonDimensionsCm,
        cartonLengthCm: sku.cartonLengthCm,
        cartonWidthCm: sku.cartonWidthCm,
        cartonHeightCm: sku.cartonHeightCm,
        cartonWeightKg: sku.cartonWeightKg,
        packagingType: sku.packagingType,
        isActive: true,
      },
      update: { isActive: true },
    })

    if (nextBatchLot !== DEFAULT_BATCH_LOT) {
      const existingBatch = await prisma.skuBatch.findUnique({
        where: {
          skuId_batchCode: {
            skuId: sku.id,
            batchCode: nextBatchLot,
          },
        },
        select: { id: true },
      })

      if (!existingBatch) {
        return ApiResponses.badRequest(
          `Batch ${nextBatchLot} not found for SKU ${sku.skuCode}. Create it in Products → Batches first.`
        )
      }
    }
  }

  let updated
  try {
    updated = await prisma.purchaseOrderLine.update({
      where: { id: lineId },
      data: updateData,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return ApiResponses.conflict('A line with this SKU already exists for the purchase order')
    }
    throw error
  }

  return ApiResponses.success({
    id: updated.id,
    skuCode: updated.skuCode,
    skuDescription: updated.skuDescription,
    batchLot: updated.batchLot,
    quantity: updated.quantity,
    unitCost: updated.unitCost ? Number(updated.unitCost) : null,
    currency: updated.currency,
    status: updated.status,
    quantityReceived: updated.quantityReceived,
    lineNotes: updated.lineNotes,
    updatedAt: updated.updatedAt.toISOString(),
  })
})

/**
 * DELETE /api/purchase-orders/[id]/lines/[lineId]
 * Delete a line item
 */
export const DELETE = withAuthAndParams(async (request: NextRequest, params, _session) => {
  const id = params.id as string
  const lineId = params.lineId as string
  const prisma = await getTenantPrisma()

  const canEdit = await hasPermission(_session.user.id, 'po.edit')
  if (!canEdit) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
  })

  if (!order) {
    throw new NotFoundError(`Purchase Order not found: ${id}`)
  }

  // Only allow deleting lines in DRAFT status
  if (order.status !== 'DRAFT') {
    return ApiResponses.badRequest('Can only delete line items from orders in DRAFT status')
  }

  const line = await prisma.purchaseOrderLine.findFirst({
    where: {
      id: lineId,
      purchaseOrderId: id,
    },
  })

  if (!line) {
    throw new NotFoundError(`Line item not found: ${lineId}`)
  }

  await prisma.purchaseOrderLine.delete({
    where: { id: lineId },
  })

  return ApiResponses.success({ deleted: true })
})
