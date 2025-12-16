import { PurchaseOrderType, PurchaseOrderStatus } from '@ecom-os/prisma-wms'

export type DocumentCategory =
  | 'commercial_invoice'
  | 'bill_of_lading'
  | 'packing_list'
  | 'movement_note'
  | 'cube_master'
  | 'transaction_certificate'
  | 'custom_declaration'

export const DOCUMENT_LABELS: Record<DocumentCategory, string> = {
  commercial_invoice: 'Commercial Invoice',
  bill_of_lading: 'Bill of Lading',
  packing_list: 'Packing List',
  movement_note: 'Movement Note',
  cube_master: 'Cube Master',
  transaction_certificate: 'TC GRS',
  custom_declaration: 'CDS',
}

type TransitionKey = `${PurchaseOrderStatus}_TO_${PurchaseOrderStatus}`

export const PO_DOCUMENT_REQUIREMENTS: Record<
  PurchaseOrderType,
  Partial<Record<TransitionKey, DocumentCategory[]>>
> = {
  // Inbound POs require more documents
  PURCHASE: {
    AWAITING_PROOF_TO_REVIEW: ['movement_note', 'bill_of_lading', 'packing_list'],
  },
  // Outbound POs require fewer documents
  FULFILLMENT: {
    AWAITING_PROOF_TO_REVIEW: ['movement_note', 'bill_of_lading'],
  },
  // Adjustments have no document requirements (internal operations)
  ADJUSTMENT: {},
}

export function getRequiredDocuments(
  poType: PurchaseOrderType,
  fromStatus: PurchaseOrderStatus,
  toStatus: PurchaseOrderStatus
): DocumentCategory[] {
  const transitionKey = `${fromStatus}_TO_${toStatus}` as TransitionKey
  return PO_DOCUMENT_REQUIREMENTS[poType]?.[transitionKey] ?? []
}

export function getDocumentLabel(category: DocumentCategory): string {
  return DOCUMENT_LABELS[category] ?? category
}
