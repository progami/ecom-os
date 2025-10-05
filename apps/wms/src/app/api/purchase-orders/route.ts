import { NextRequest } from 'next/server'
import { withAuth, withRole, ApiResponses, z } from '@/lib/api'
import {
  createPurchaseOrder,
  getPurchaseOrders,
  serializePurchaseOrder,
} from '@/lib/services/purchase-order-service'
import { PurchaseOrderStatus, PurchaseOrderType } from '@prisma/client'

export const GET = withAuth(async (_request: NextRequest, _session) => {
  const orders = await getPurchaseOrders()
  return ApiResponses.success({
    data: orders.map(serializePurchaseOrder),
  })
})

const createLineSchema = z.object({
  skuCode: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative().optional(),
  batchLot: z.string().trim().optional().nullable(),
})

const createOrderSchema = z.object({
  orderNumber: z.string().min(1),
  warehouseCode: z.string().min(1),
  type: z.enum(['purchase', 'sales', 'adjustment'] as const),
  status: z.enum(['DRAFT', 'SHIPPED', 'WAREHOUSE', 'CANCELLED', 'CLOSED']).optional(),
  counterpartyName: z.string().optional().nullable(),
  expectedDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(createLineSchema).min(1),
})

const typeMap: Record<'purchase' | 'sales' | 'adjustment', PurchaseOrderType> = {
  purchase: PurchaseOrderType.PURCHASE,
  sales: PurchaseOrderType.FULFILLMENT,
  adjustment: PurchaseOrderType.ADJUSTMENT,
}

export const POST = withRole(['admin', 'staff'], async (request: NextRequest, session) => {
  const payload = await request.json().catch(() => null)
  const result = createOrderSchema.safeParse(payload)

  if (!result.success) {
    return ApiResponses.validationError(result.error.flatten().fieldErrors)
  }

  const parsed = result.data

  let expectedDate: Date | null = null
  if (parsed.expectedDate) {
    const parsedDate = new Date(parsed.expectedDate)
    if (Number.isNaN(parsedDate.getTime())) {
      return ApiResponses.validationError({ expectedDate: 'Invalid expectedDate value' })
    }
    expectedDate = parsedDate
  }

  const createInput = {
    orderNumber: parsed.orderNumber.trim(),
    warehouseCode: parsed.warehouseCode.trim(),
    type: typeMap[parsed.type],
    status: parsed.status ? PurchaseOrderStatus[parsed.status as keyof typeof PurchaseOrderStatus] : undefined,
    counterpartyName: parsed.counterpartyName?.trim() || null,
    expectedDate,
    notes: parsed.notes?.trim() || null,
    lines: parsed.lines.map((line) => ({
      skuCode: line.skuCode.trim(),
      quantity: line.quantity,
      unitCost: line.unitCost ?? null,
      batchLot: line.batchLot?.trim() || null,
    })),
    createdById: session.user.id,
    createdByName: session.user.name ?? null,
  }

  try {
    const order = await createPurchaseOrder(createInput)
    return ApiResponses.created(serializePurchaseOrder(order))
  } catch (error) {
    return ApiResponses.handleError(error)
  }
})
