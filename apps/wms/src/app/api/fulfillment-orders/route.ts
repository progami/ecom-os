import { NextRequest } from 'next/server'
import { withAuth, ApiResponses, z } from '@/lib/api'
import {
  createFulfillmentOrder,
  listFulfillmentOrders,
  type CreateFulfillmentOrderInput,
  type FulfillmentUserContext,
} from '@/lib/services/fulfillment-order-service'
import { hasPermission } from '@/lib/services/permission-service'
import { FulfillmentDestinationType } from '@ecom-os/prisma-wms'

export const GET = withAuth(async (_request: NextRequest, _session) => {
  const orders = await listFulfillmentOrders()
  return ApiResponses.success({ data: orders })
})

const LineItemSchema = z.object({
  skuCode: z.string().min(1),
  skuDescription: z.string().optional(),
  batchLot: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
})

const CreateFOSchema = z.object({
  warehouseCode: z.string().min(1),
  warehouseName: z.string().optional(),
  destinationType: z.nativeEnum(FulfillmentDestinationType).optional(),
  destinationName: z.string().optional(),
  destinationAddress: z.string().optional(),
  destinationCountry: z.string().optional(),
  shippingCarrier: z.string().optional(),
  shippingMethod: z.string().optional(),
  trackingNumber: z.string().optional(),
  externalReference: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(LineItemSchema).min(1, 'At least one line item is required'),
})

/**
 * POST /api/fulfillment-orders
 * Create a new Fulfillment Order (FO) in DRAFT status.
 */
export const POST = withAuth(async (request: NextRequest, session) => {
  const payload = await request.json().catch(() => null)
  const result = CreateFOSchema.safeParse(payload)

  if (!result.success) {
    return ApiResponses.badRequest(
      `Invalid payload: ${result.error.errors.map((e) => e.message).join(', ')}`
    )
  }

  const userContext: FulfillmentUserContext = {
    id: session.user.id,
    name: session.user.name || session.user.email || 'Unknown',
  }

  const canCreate = await hasPermission(userContext.id, 'fo.create')
  if (!canCreate) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const input: CreateFulfillmentOrderInput = {
    warehouseCode: result.data.warehouseCode,
    warehouseName: result.data.warehouseName,
    destinationType: result.data.destinationType,
    destinationName: result.data.destinationName,
    destinationAddress: result.data.destinationAddress,
    destinationCountry: result.data.destinationCountry,
    shippingCarrier: result.data.shippingCarrier,
    shippingMethod: result.data.shippingMethod,
    trackingNumber: result.data.trackingNumber,
    externalReference: result.data.externalReference,
    notes: result.data.notes,
    lines: result.data.lines.map((line) => ({
      skuCode: line.skuCode,
      skuDescription: line.skuDescription,
      batchLot: line.batchLot,
      quantity: line.quantity,
      notes: line.notes,
    })),
  }

  try {
    const order = await createFulfillmentOrder(input, userContext)
    return ApiResponses.success({ data: order })
  } catch (error) {
    return ApiResponses.handleError(error)
  }
})

