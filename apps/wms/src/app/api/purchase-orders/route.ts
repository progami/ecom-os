import { NextRequest } from 'next/server'
import { withAuth, ApiResponses } from '@/lib/api'
import { getPurchaseOrders, serializePurchaseOrder } from '@/lib/services/purchase-order-service'

export const GET = withAuth(async (_request: NextRequest, _session) => {
  const orders = await getPurchaseOrders()
  return ApiResponses.success({
    data: orders.map((order) => serializePurchaseOrder(order)),
  })
})
