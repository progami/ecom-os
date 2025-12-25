import { withAuthAndParams, ApiResponses, z } from '@/lib/api'
import { getFulfillmentOrderById } from '@/lib/services/fulfillment-order-service'
import { hasPermission } from '@/lib/services/permission-service'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'

export const GET = withAuthAndParams(async (_request, params, _session) => {
  const id =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined

  if (!id) {
    return ApiResponses.badRequest('Fulfillment order ID is required')
  }

  try {
    const order = await getFulfillmentOrderById(id)
    return ApiResponses.success({ data: order })
  } catch (error) {
    return ApiResponses.handleError(error)
  }
})

const UpdateDetailsSchema = z.object({
  destinationName: z.string().trim().optional().nullable(),
  destinationAddress: z.string().trim().optional().nullable(),
  destinationCountry: z.string().trim().optional().nullable(),
  shippingCarrier: z.string().trim().optional().nullable(),
  shippingMethod: z.string().trim().optional().nullable(),
  trackingNumber: z.string().trim().optional().nullable(),
  externalReference: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

export const PATCH = withAuthAndParams(async (request, params, session) => {
  const id =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined

  if (!id) {
    return ApiResponses.badRequest('Fulfillment order ID is required')
  }

  const canEdit = await hasPermission(session.user.id, 'fo.edit')
  if (!canEdit) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return ApiResponses.badRequest('Invalid update payload')
  }

  const parsed = UpdateDetailsSchema.safeParse(payload)
  if (!parsed.success) {
    return ApiResponses.validationError(parsed.error.flatten().fieldErrors)
  }

  const normalize = (value: string | null | undefined) =>
    value === '' ? null : value?.trim() ? sanitizeForDisplay(value.trim()) : value ?? undefined

  const updates = {
    destinationName: normalize(parsed.data.destinationName),
    destinationAddress: normalize(parsed.data.destinationAddress),
    destinationCountry: normalize(parsed.data.destinationCountry),
    shippingCarrier: normalize(parsed.data.shippingCarrier),
    shippingMethod: normalize(parsed.data.shippingMethod),
    trackingNumber: normalize(parsed.data.trackingNumber),
    externalReference: normalize(parsed.data.externalReference),
    notes: normalize(parsed.data.notes),
  }

  try {
    const { getTenantPrisma } = await import('@/lib/tenant/server')
    const prisma = await getTenantPrisma()
    const updated = await prisma.fulfillmentOrder.update({
      where: { id },
      data: updates,
      include: { lines: true, documents: true },
    })
    return ApiResponses.success({ data: updated })
  } catch (error) {
    return ApiResponses.handleError(error)
  }
})
