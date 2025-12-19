import { NextRequest } from 'next/server'
import { withAuth, ApiResponses, z } from '@/lib/api'
import { getPurchaseOrders, serializePurchaseOrder } from '@/lib/services/purchase-order-service'
import {
  createPurchaseOrder,
  serializePurchaseOrder as serializeNewPO,
} from '@/lib/services/po-stage-service'
import type { UserContext } from '@/lib/services/po-stage-service'

export const GET = withAuth(async (_request: NextRequest, _session) => {
  const orders = await getPurchaseOrders()
  return ApiResponses.success({
    data: orders.map((order) => serializePurchaseOrder(order)),
  })
})

const CreatePOSchema = z.object({
  warehouseCode: z.string().min(1),
  warehouseName: z.string().min(1),
  counterpartyName: z.string().optional(),
  expectedDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  receiveType: z.enum(['SEA', 'AIR', 'LAND']).optional(),
})

/**
 * POST /api/purchase-orders
 * Create a new Purchase Order in DRAFT status with auto-generated PO number
 */
export const POST = withAuth(async (request: NextRequest, session) => {
  const payload = await request.json().catch(() => null)
  const result = CreatePOSchema.safeParse(payload)

  if (!result.success) {
    return ApiResponses.badRequest(
      `Invalid payload: ${result.error.message}`
    )
  }

  const userContext: UserContext = {
    id: session.user.id,
    name: session.user.name || session.user.email || 'Unknown',
    email: session.user.email || '',
  }

  try {
    const order = await createPurchaseOrder(
      {
        warehouseCode: result.data.warehouseCode,
        warehouseName: result.data.warehouseName,
        counterpartyName: result.data.counterpartyName,
        expectedDate: result.data.expectedDate
          ? new Date(result.data.expectedDate)
          : undefined,
        notes: result.data.notes,
        receiveType: result.data.receiveType,
      },
      userContext
    )

    return ApiResponses.success(serializeNewPO(order))
  } catch (error) {
    return ApiResponses.handleError(error)
  }
})
