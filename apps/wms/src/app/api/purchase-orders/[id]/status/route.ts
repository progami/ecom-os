import { NextRequest } from 'next/server'
import { withAuthAndParams, ApiResponses, z } from '@/lib/api'
import { serializePurchaseOrder, transitionPurchaseOrderStatus } from '@/lib/services/purchase-order-service'

const UpdateStatusSchema = z.object({
 status: z.enum(['DRAFT', 'AWAITING_PROOF', 'REVIEW', 'POSTED'] as const),
})

export const PATCH = withAuthAndParams(async (request: NextRequest, params, _session) => {
 const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined
 if (!id) {
 return ApiResponses.badRequest('Purchase order ID is required')
 }

 const payload = await request.json().catch(() => null)
 const result = UpdateStatusSchema.safeParse(payload)

 if (!result.success) {
 return ApiResponses.badRequest('Invalid status payload')
 }

 try {
 const order = await transitionPurchaseOrderStatus(id, result.data.status)
 return ApiResponses.success(serializePurchaseOrder(order))
 } catch (error) {
 return ApiResponses.handleError(error)
 }
})
