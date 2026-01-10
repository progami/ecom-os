import { NextRequest } from 'next/server'
import { withAuthAndParams, ApiResponses, z } from '@/lib/api'
import { FulfillmentOrderStatus } from '@targon/prisma-talos'
import {
  transitionFulfillmentOrderStage,
  getValidNextFulfillmentStages,
  type FulfillmentUserContext,
} from '@/lib/services/fulfillment-order-service'
import { hasPermission } from '@/lib/services/permission-service'

const DateInputSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'Invalid date',
  })

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim().length === 0 ? undefined : value

const OptionalString = z.preprocess(emptyToUndefined, z.string().trim().optional())
const OptionalDateString = z.preprocess(emptyToUndefined, DateInputSchema.optional())

const StageTransitionSchema = z.object({
  targetStatus: z.enum(['DRAFT', 'SHIPPED', 'CANCELLED'] as const),
  stageData: z
    .object({
      shippedDate: OptionalDateString,
      deliveredDate: OptionalDateString,
      shippingCarrier: OptionalString,
      shippingMethod: OptionalString,
      trackingNumber: OptionalString,
    })
    .optional()
    .default({}),
})

/**
 * PATCH /api/fulfillment-orders/[id]/stage
 * Transition a fulfillment order to a new stage.
 */
export const PATCH = withAuthAndParams(async (request: NextRequest, params, session) => {
  const id =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined

  if (!id) {
    return ApiResponses.badRequest('Fulfillment order ID is required')
  }

  const payload = await request.json().catch(() => null)
  const result = StageTransitionSchema.safeParse(payload)

  if (!result.success) {
    const issue = result.error.issues[0]
    const path = issue?.path?.length ? issue.path.join('.') : 'payload'
    return ApiResponses.badRequest(
      issue?.message ? `Invalid ${path}: ${issue.message}` : 'Invalid stage transition payload'
    )
  }

  const canTransition = await hasPermission(session.user.id, 'fo.stage')
  if (!canTransition) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const userContext: FulfillmentUserContext = {
    id: session.user.id,
    name: session.user.name || session.user.email || 'Unknown',
  }

  try {
    const order = await transitionFulfillmentOrderStage(
      id,
      result.data.targetStatus as FulfillmentOrderStatus,
      result.data.stageData,
      userContext
    )
    return ApiResponses.success({ data: order })
  } catch (error) {
    return ApiResponses.handleError(error)
  }
})

/**
 * GET /api/fulfillment-orders/[id]/stage
 * Get valid next stages for a fulfillment order.
 */
export const GET = withAuthAndParams(async (_request: NextRequest, params, _session) => {
  const id =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined

  if (!id) {
    return ApiResponses.badRequest('Fulfillment order ID is required')
  }

  const { getTenantPrisma } = await import('@/lib/tenant/server')
  const prisma = await getTenantPrisma()

  const order = await prisma.fulfillmentOrder.findUnique({
    where: { id },
    select: { status: true },
  })

  if (!order) {
    return ApiResponses.notFound('Fulfillment order not found')
  }

  const validNextStages = getValidNextFulfillmentStages(order.status as FulfillmentOrderStatus)

  return ApiResponses.success({
    currentStatus: order.status,
    validNextStages,
  })
})

