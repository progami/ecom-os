import { NextRequest } from 'next/server'
import { withAuthAndParams, ApiResponses, z } from '@/lib/api'
import { getTenantPrisma, getCurrentTenant } from '@/lib/tenant/server'
import { NotFoundError } from '@/lib/api'
import { hasPermission } from '@/lib/services/permission-service'
import { Prisma } from '@ecom-os/prisma-wms'

const LineItemSchema = z.object({
  skuCode: z.string().trim().min(1),
  skuDescription: z.string().optional(),
  batchLot: z.string().trim().min(1, 'Batch/Lot is required'),
  quantity: z.number().int().positive(),
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
      quantityReceived: line.quantityReceived,
      lineNotes: line.lineNotes,
      createdAt: line.createdAt.toISOString(),
      updatedAt: line.updatedAt.toISOString(),
    })),
  })
})

/**
 * POST /api/purchase-orders/[id]/lines
 * Add a new line item to a purchase order
 */
export const POST = withAuthAndParams(async (request: NextRequest, params, _session) => {
  const id = params.id as string
  const tenant = await getCurrentTenant()
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

  // Only allow adding lines in DRAFT status
  if (order.status !== 'DRAFT') {
    return ApiResponses.badRequest('Can only add line items to orders in DRAFT status')
  }

  const payload = await request.json().catch(() => null)
  const result = LineItemSchema.safeParse(payload)

  if (!result.success) {
    return ApiResponses.badRequest(
      `Invalid payload: ${result.error.errors.map(e => e.message).join(', ')}`
    )
  }

  const sku = await prisma.sku.findFirst({
    where: { skuCode: result.data.skuCode },
    select: { id: true },
  })

  if (!sku) {
    return ApiResponses.badRequest(`SKU ${result.data.skuCode} not found. Create the SKU first.`)
  }

  const batchRecord = await prisma.skuBatch.findFirst({
    where: {
      skuId: sku.id,
      batchCode: result.data.batchLot,
      isActive: true,
    },
    select: { id: true },
  })

  if (!batchRecord) {
    return ApiResponses.badRequest(
      `Batch/Lot ${result.data.batchLot} is not configured for SKU ${result.data.skuCode}. Create it in Config → Products → SKUs → Batches.`
    )
  }

  let line
  try {
    line = await prisma.purchaseOrderLine.create({
      data: {
        purchaseOrderId: id,
        skuCode: result.data.skuCode,
        skuDescription: result.data.skuDescription || '',
        batchLot: result.data.batchLot,
        quantity: result.data.quantity,
        unitCost: result.data.unitCost,
        currency: result.data.currency ?? tenant.currency,
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

  return ApiResponses.success({
    id: line.id,
    skuCode: line.skuCode,
    skuDescription: line.skuDescription,
    batchLot: line.batchLot,
    quantity: line.quantity,
    unitCost: line.unitCost ? Number(line.unitCost) : null,
    currency: line.currency,
    status: line.status,
    lineNotes: line.lineNotes,
    createdAt: line.createdAt.toISOString(),
  })
})
