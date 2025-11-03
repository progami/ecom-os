import { withAuthAndParams, ApiResponses, z } from '@/lib/api'
import {
 getPurchaseOrderById,
 serializePurchaseOrder,
 updatePurchaseOrderDetails,
} from '@/lib/services/purchase-order-service'

export const GET = withAuthAndParams(async (_request, params, _session) => {
 const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined
 if (!id) {
 return ApiResponses.badRequest('Purchase order ID is required')
 }

 const order = await getPurchaseOrderById(id)
 if (!order) {
 return ApiResponses.notFound('Purchase order not found')
 }

 return ApiResponses.success(serializePurchaseOrder(order))
})

const UpdateDetailsSchema = z.object({
 expectedDate: z.string().trim().optional().nullable(),
 counterpartyName: z.string().trim().optional().nullable(),
 notes: z.string().trim().optional().nullable(),
})

export const PATCH = withAuthAndParams(async (request, params, _session) => {
 const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined
 if (!id) {
 return ApiResponses.badRequest('Purchase order ID is required')
 }

 const payload = await request.json().catch(() => null)
 if (!payload || typeof payload !== 'object') {
 return ApiResponses.badRequest('Invalid update payload')
 }

 const parsed = UpdateDetailsSchema.safeParse(payload)
 if (!parsed.success) {
 return ApiResponses.validationError(parsed.error.flatten().fieldErrors)
 }

 const normalized = {
 expectedDate:
 parsed.data.expectedDate === '' ? null : parsed.data.expectedDate ?? undefined,
 counterpartyName:
 parsed.data.counterpartyName === '' ? null : parsed.data.counterpartyName ?? undefined,
 notes: parsed.data.notes === '' ? null : parsed.data.notes ?? undefined,
 }

 try {
 const updated = await updatePurchaseOrderDetails(id, normalized)
 return ApiResponses.success(serializePurchaseOrder(updated))
 } catch (error) {
 return ApiResponses.handleError(error)
 }
})
