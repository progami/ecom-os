import { NextRequest } from 'next/server'
import { withAuthAndParams, ApiResponses, z } from '@/lib/api'
import { PurchaseOrderStatus } from '@ecom-os/prisma-wms'
import {
  transitionPurchaseOrderStage,
  serializePurchaseOrder,
  getValidNextStages,
} from '@/lib/services/po-stage-service'
import type { UserContext } from '@/lib/services/po-stage-service'

const StageTransitionSchema = z.object({
  targetStatus: z.enum([
    'DRAFT',
    'MANUFACTURING',
    'OCEAN',
    'WAREHOUSE',
    'SHIPPED',
    'CANCELLED',
  ] as const),
  stageData: z
    .object({
      // Manufacturing stage data
      proformaInvoiceId: z.string().optional(),
      proformaInvoiceData: z.any().optional(),
      manufacturingStart: z.string().datetime().optional(),
      manufacturingEnd: z.string().datetime().optional(),
      cargoDetails: z.any().optional(),

      // Ocean stage data
      houseBillOfLading: z.string().optional(),
      packingListRef: z.string().optional(),
      commercialInvoiceId: z.string().optional(),

      // Warehouse stage data
      warehouseInvoiceId: z.string().optional(),
      surrenderBL: z.string().optional(),
      transactionCertificate: z.string().optional(),
      customsDeclaration: z.string().optional(),

      // Shipped stage data
      proofOfDelivery: z.string().optional(),
    })
    .optional()
    .default({}),
})

/**
 * PATCH /api/purchase-orders/[id]/stage
 * Transition a purchase order to a new stage
 */
export const PATCH = withAuthAndParams(
  async (request: NextRequest, params, session) => {
    const id =
      typeof params?.id === 'string'
        ? params.id
        : Array.isArray(params?.id)
          ? params?.id?.[0]
          : undefined

    if (!id) {
      return ApiResponses.badRequest('Purchase order ID is required')
    }

    const payload = await request.json().catch(() => null)
    const result = StageTransitionSchema.safeParse(payload)

    if (!result.success) {
      return ApiResponses.badRequest(
        `Invalid stage transition payload: ${result.error.message}`
      )
    }

    const userContext: UserContext = {
      id: session.user.id,
      name: session.user.name || session.user.email || 'Unknown',
      email: session.user.email || '',
    }

    try {
      const order = await transitionPurchaseOrderStage(
        id,
        result.data.targetStatus as PurchaseOrderStatus,
        result.data.stageData,
        userContext
      )
      return ApiResponses.success(serializePurchaseOrder(order))
    } catch (error) {
      return ApiResponses.handleError(error)
    }
  }
)

/**
 * GET /api/purchase-orders/[id]/stage
 * Get valid next stages for a purchase order
 */
export const GET = withAuthAndParams(
  async (_request: NextRequest, params, _session) => {
    const id =
      typeof params?.id === 'string'
        ? params.id
        : Array.isArray(params?.id)
          ? params?.id?.[0]
          : undefined

    if (!id) {
      return ApiResponses.badRequest('Purchase order ID is required')
    }

    // Import prisma to get current status
    const { getTenantPrisma } = await import('@/lib/tenant/server')
    const prisma = await getTenantPrisma()

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { status: true },
    })

    if (!order) {
      return ApiResponses.notFound('Purchase order not found')
    }

    const validNextStages = getValidNextStages(
      order.status as PurchaseOrderStatus
    )

    return ApiResponses.success({
      currentStatus: order.status,
      validNextStages,
    })
  }
)
