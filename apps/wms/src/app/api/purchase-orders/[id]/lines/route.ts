import { NextRequest } from 'next/server'
import { withAuthAndParams, ApiResponses, z } from '@/lib/api'
import { getTenantPrisma } from '@/lib/tenant/server'
import { NotFoundError } from '@/lib/api'

const LineItemSchema = z.object({
  skuCode: z.string().min(1),
  skuDescription: z.string().optional(),
  quantity: z.number().int().positive(),
  unitCost: z.number().optional(),
  currency: z.string().optional().default('USD'),
  notes: z.string().optional(),
})

/**
 * GET /api/purchase-orders/[id]/lines
 * Get all line items for a purchase order
 */
export const GET = withAuthAndParams(async (request: NextRequest, params, _session) => {
  const id = params.id as string
  const prisma = await getTenantPrisma()

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  })

  if (!order) {
    throw new NotFoundError(`Purchase Order not found: ${id}`)
  }

  return ApiResponses.success({
    data: order.lines.map((line) => ({
      id: line.id,
      skuCode: line.skuCode,
      skuDescription: line.skuDescription,
      batchLot: line.batchLot,
      quantity: line.quantity,
      unitCost: line.unitCost ? Number(line.unitCost) : null,
      currency: line.currency || 'USD',
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
  const prisma = await getTenantPrisma()

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
      `Invalid payload: ${result.error.errors.map((e) => e.message).join(', ')}`
    )
  }

  const line = await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId: id,
      skuCode: result.data.skuCode,
      skuDescription: result.data.skuDescription || '',
      quantity: result.data.quantity,
      unitCost: result.data.unitCost,
      currency: result.data.currency,
      lineNotes: result.data.notes,
      status: 'PENDING',
    },
  })

  return ApiResponses.success({
    id: line.id,
    skuCode: line.skuCode,
    skuDescription: line.skuDescription,
    quantity: line.quantity,
    unitCost: line.unitCost ? Number(line.unitCost) : null,
    currency: line.currency,
    status: line.status,
    lineNotes: line.lineNotes,
    createdAt: line.createdAt.toISOString(),
  })
})
