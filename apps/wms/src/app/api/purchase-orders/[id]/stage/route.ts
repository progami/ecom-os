import { NextRequest } from 'next/server'
import { withAuthAndParams, ApiResponses, z } from '@/lib/api'
import { PurchaseOrderStatus } from '@ecom-os/prisma-wms'
import {
  transitionPurchaseOrderStage,
  serializePurchaseOrder,
  getValidNextStages,
} from '@/lib/services/po-stage-service'
import type { UserContext } from '@/lib/services/po-stage-service'

const DateInputSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'Invalid date',
  })

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
      // ===========================================
      // Stage 2: Manufacturing
      // ===========================================
      proformaInvoiceNumber: z.string().optional(),
      proformaInvoiceDate: DateInputSchema.optional(),
      factoryName: z.string().optional(),
      manufacturingStartDate: DateInputSchema.optional(),
      expectedCompletionDate: DateInputSchema.optional(),
      actualCompletionDate: DateInputSchema.optional(),
      totalWeightKg: z.number().optional(),
      totalVolumeCbm: z.number().optional(),
      totalCartons: z.number().int().optional(),
      totalPallets: z.number().int().optional(),
      packagingNotes: z.string().optional(),

      // ===========================================
      // Stage 3: Ocean
      // ===========================================
      houseBillOfLading: z.string().optional(),
      masterBillOfLading: z.string().optional(),
      commercialInvoiceNumber: z.string().optional(),
      packingListRef: z.string().optional(),
      vesselName: z.string().optional(),
      voyageNumber: z.string().optional(),
      portOfLoading: z.string().optional(),
      portOfDischarge: z.string().optional(),
      estimatedDeparture: DateInputSchema.optional(),
      estimatedArrival: DateInputSchema.optional(),
      actualDeparture: DateInputSchema.optional(),
      actualArrival: DateInputSchema.optional(),

      // ===========================================
      // Stage 4: Warehouse (warehouse selected here)
      // ===========================================
      warehouseCode: z.string().optional(),
      warehouseName: z.string().optional(),
      customsEntryNumber: z.string().optional(),
      customsClearedDate: DateInputSchema.optional(),
      dutyAmount: z.number().optional(),
      dutyCurrency: z.string().optional(),
      surrenderBlDate: DateInputSchema.optional(),
      transactionCertNumber: z.string().optional(),
      receivedDate: DateInputSchema.optional(),
      discrepancyNotes: z.string().optional(),

      // ===========================================
      // Stage 5: Shipped
      // ===========================================
      shipToName: z.string().optional(),
      shipToAddress: z.string().optional(),
      shipToCity: z.string().optional(),
      shipToCountry: z.string().optional(),
      shipToPostalCode: z.string().optional(),
      shippingCarrier: z.string().optional(),
      shippingMethod: z.string().optional(),
      trackingNumber: z.string().optional(),
      shippedDate: DateInputSchema.optional(),
      proofOfDeliveryRef: z.string().optional(),
      deliveredDate: DateInputSchema.optional(),

      // ===========================================
      // Legacy fields (backward compatibility)
      // ===========================================
      proformaInvoiceId: z.string().optional(),
      proformaInvoiceData: z.any().optional(),
      manufacturingStart: DateInputSchema.optional(),
      manufacturingEnd: DateInputSchema.optional(),
      cargoDetails: z.any().optional(),
      commercialInvoiceId: z.string().optional(),
      warehouseInvoiceId: z.string().optional(),
      surrenderBL: z.string().optional(),
      transactionCertificate: z.string().optional(),
      customsDeclaration: z.string().optional(),
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
