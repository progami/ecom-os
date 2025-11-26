import { NextRequest } from 'next/server'
import { withAuth, ApiResponses } from '@/lib/api'
import { getPurchaseOrders, serializePurchaseOrder } from '@/lib/services/purchase-order-service'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (_request: NextRequest, _session) => {
  if (!prisma) {
    console.warn('[purchase-orders] Prisma client unavailable; returning empty list')
    return ApiResponses.success({ data: [] })
  }

  const orders = await getPurchaseOrders()
  return ApiResponses.success({
    data: orders.map((order) => serializePurchaseOrder(order)),
  })
})
