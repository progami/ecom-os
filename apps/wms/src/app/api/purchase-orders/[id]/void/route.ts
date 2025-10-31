import { NextRequest } from 'next/server'
import { withAuthAndParams, ApiResponses } from '@/lib/api'
import {
 voidPurchaseOrder,
 serializePurchaseOrder,
} from '@/lib/services/purchase-order-service'

export const POST = withAuthAndParams(async (_request: NextRequest, params, _session) => {
 const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined
 if (!id) {
 return ApiResponses.badRequest('Purchase order ID is required')
 }

 try {
 const order = await voidPurchaseOrder(id)

 return ApiResponses.success(serializePurchaseOrder(order))
 } catch (error) {
 return ApiResponses.handleError(error)
 }
})
