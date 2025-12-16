import { withAuthAndParams, ApiResponses, z } from '@/lib/api'
import { PurchaseOrderStatus } from '@ecom-os/prisma-wms'
import {
  validateDocumentsForTransition,
} from '@/lib/services/purchase-order-service'
import { getDocumentLabel } from '@/lib/config/po-document-requirements'

const QuerySchema = z.object({
  toStatus: z.enum(['AWAITING_PROOF', 'REVIEW', 'POSTED']).optional(),
})

export const GET = withAuthAndParams(async (request, params, _session) => {
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id?.[0] : undefined
  if (!id) {
    return ApiResponses.badRequest('Purchase order ID is required')
  }

  const url = new URL(request.url)
  const toStatusParam = url.searchParams.get('toStatus')

  const parsed = QuerySchema.safeParse({ toStatus: toStatusParam })
  if (!parsed.success) {
    return ApiResponses.badRequest('Invalid toStatus parameter')
  }

  // Default to checking AWAITING_PROOF → REVIEW transition
  const fromStatus = PurchaseOrderStatus.AWAITING_PROOF
  const toStatus = (parsed.data.toStatus as PurchaseOrderStatus) ?? PurchaseOrderStatus.REVIEW

  const validation = await validateDocumentsForTransition(id, fromStatus, toStatus)

  return ApiResponses.success({
    canTransition: validation.valid,
    requiredDocuments: validation.requiredDocuments.map(doc => ({
      id: doc,
      label: getDocumentLabel(doc),
    })),
    uploadedDocuments: validation.uploadedDocuments.map(doc => ({
      id: doc,
      label: getDocumentLabel(doc),
    })),
    missingDocuments: validation.missingDocuments.map(doc => ({
      id: doc,
      label: getDocumentLabel(doc),
    })),
  })
})
