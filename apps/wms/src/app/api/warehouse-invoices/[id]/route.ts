import { withAuthAndParams, ApiResponses } from '@/lib/api'
import { getWarehouseInvoiceById } from '@/lib/services/warehouse-invoice-service'

export const GET = withAuthAndParams(async (_request, params, _session) => {
  const idParam = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : undefined
  if (!idParam) {
    return ApiResponses.badRequest('Warehouse invoice ID is required')
  }

  const invoice = await getWarehouseInvoiceById(idParam)
  return ApiResponses.success(invoice)
})
