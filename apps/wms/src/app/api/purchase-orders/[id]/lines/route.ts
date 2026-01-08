import { NextRequest } from 'next/server'
import { withAuthAndParams, ApiResponses, z } from '@/lib/api'
import { getTenantPrisma, getCurrentTenant } from '@/lib/tenant/server'
import { NotFoundError } from '@/lib/api'
import { hasPermission } from '@/lib/services/permission-service'
import { auditLog } from '@/lib/security/audit-logger'
import { Prisma } from '@ecom-os/prisma-wms'

const CreateLineSchema = z.object({
  skuCode: z.string().trim().min(1),
  skuDescription: z.string().optional(),
  batchLot: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  storageCartonsPerPallet: z.number().int().positive().optional(),
  shippingCartonsPerPallet: z.number().int().positive().optional(),
  unitCost: z.number().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
})

/**
 * GET /api/purchase-orders/[id]/lines
 * Get all line items for a purchase order
 */
export const GET = withAuthAndParams(async (request: NextRequest, params, _session) => {
  const id = params.id as string
  const tenant = await getCurrentTenant()
  const prisma = await getTenantPrisma()

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  })

  if (!order) {
    throw new NotFoundError(`Purchase Order not found: ${id}`)
  }

  return ApiResponses.success({
    data: order.lines.map(line => ({
      id: line.id,
      skuCode: line.skuCode,
      skuDescription: line.skuDescription,
      batchLot: line.batchLot,
      quantity: line.quantity,
      unitCost: line.unitCost ? Number(line.unitCost) : null,
      currency: line.currency || tenant.currency,
      status: line.status,
      postedQuantity: line.postedQuantity,
      quantityReceived: line.quantityReceived,
      lineNotes: line.lineNotes,
      createdAt: line.createdAt.toISOString(),
      updatedAt: line.updatedAt.toISOString(),
    })),
  })
})

/**
 * POST /api/purchase-orders/[id]/lines
 * Add a new line item to a DRAFT purchase order
 */
export const POST = withAuthAndParams(async (request: NextRequest, params, session) => {
  const id = params.id as string
  const prisma = await getTenantPrisma()
  const tenant = await getCurrentTenant()

  const canEdit = await hasPermission(session.user.id, 'po.edit')
  if (!canEdit) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { id: true, status: true },
  })

  if (!order) {
    throw new NotFoundError(`Purchase Order not found: ${id}`)
  }

  if (order.status !== 'DRAFT') {
    return ApiResponses.badRequest('Can only add line items to orders in DRAFT status')
  }

  const payload = await request.json().catch(() => null)
  const result = CreateLineSchema.safeParse(payload)

  if (!result.success) {
    return ApiResponses.badRequest(
      `Invalid payload: ${result.error.errors.map(e => e.message).join(', ')}`
    )
  }

  const skuCode = result.data.skuCode.trim()
  const batchLot = result.data.batchLot.trim().toUpperCase()
  if (batchLot === 'DEFAULT') {
    return ApiResponses.badRequest('Batch / lot is required')
  }

  const sku = await prisma.sku.findFirst({
    where: { skuCode },
    select: {
      id: true,
      skuCode: true,
      description: true,
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
    return ApiResponses.badRequest(`SKU ${skuCode} not found. Create the SKU first.`)
  }

  const existingBatch = await prisma.skuBatch.findFirst({
    where: {
      skuId: sku.id,
      batchCode: { equals: batchLot, mode: 'insensitive' },
    },
    select: { id: true, batchCode: true },
  })

  if (!existingBatch) {
    return ApiResponses.badRequest(
      `Batch ${batchLot} not found for SKU ${sku.skuCode}. Create it in Products → Batches first.`
    )
  }

  const batchUpdate: Prisma.SkuBatchUpdateInput = {}
  if (result.data.storageCartonsPerPallet !== undefined) {
    batchUpdate.storageCartonsPerPallet = result.data.storageCartonsPerPallet
  }
  if (result.data.shippingCartonsPerPallet !== undefined) {
    batchUpdate.shippingCartonsPerPallet = result.data.shippingCartonsPerPallet
  }
  if (Object.keys(batchUpdate).length > 0) {
    await prisma.skuBatch.update({
      where: { id: existingBatch.id },
      data: batchUpdate,
    })
  }

  let line
  try {
    line = await prisma.purchaseOrderLine.create({
      data: {
        purchaseOrder: { connect: { id: order.id } },
        skuCode: sku.skuCode,
        skuDescription: result.data.skuDescription ?? sku.description ?? '',
        batchLot: existingBatch.batchCode,
        quantity: result.data.quantity,
        unitCost: result.data.unitCost,
        currency: result.data.currency || tenant.currency,
        lineNotes: result.data.notes,
        status: 'PENDING',
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return ApiResponses.conflict(
        'A line with this SKU and batch already exists for the purchase order'
      )
    }
    throw error
  }

  await auditLog({
    entityType: 'PurchaseOrder',
    entityId: id,
    action: 'LINE_ADD',
    userId: session.user.id,
    oldValue: null,
    newValue: {
      lineId: line.id,
      skuCode: line.skuCode,
      skuDescription: line.skuDescription ?? null,
      batchLot: line.batchLot ?? null,
      quantity: line.quantity,
      unitCost: line.unitCost ? Number(line.unitCost) : null,
      currency: line.currency ?? null,
      storageCartonsPerPallet: result.data.storageCartonsPerPallet ?? null,
      shippingCartonsPerPallet: result.data.shippingCartonsPerPallet ?? null,
      notes: line.lineNotes ?? null,
    },
  })

  return ApiResponses.success({
    id: line.id,
    skuCode: line.skuCode,
    skuDescription: line.skuDescription,
    batchLot: line.batchLot,
    quantity: line.quantity,
    unitCost: line.unitCost ? Number(line.unitCost) : null,
    currency: line.currency || tenant.currency,
    status: line.status,
    postedQuantity: line.postedQuantity,
    quantityReceived: line.quantityReceived,
    lineNotes: line.lineNotes,
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
  })
})
