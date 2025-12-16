/**
 * Status and type mapping constants for consistent UI rendering across the WMS app.
 * Centralizes badge classes, labels, and other status-related UI configurations.
 */

// Purchase Order Status Types
export type POStatus = 'DRAFT' | 'AWAITING_PROOF' | 'REVIEW' | 'POSTED' | 'CANCELLED' | 'CLOSED'
export type POType = 'PURCHASE' | 'FULFILLMENT' | 'ADJUSTMENT'

// Transaction Types
export type TxType = 'RECEIVE' | 'SHIP' | 'ADJUST_IN' | 'ADJUST_OUT'

// Movement Note Status
export type MNStatus = 'DRAFT' | 'POSTED' | 'CANCELLED' | 'RECONCILED'

// PO Line Status
export type POLineStatus = 'PENDING' | 'POSTED' | 'CANCELLED'

/**
 * Badge CSS classes for Purchase Order statuses
 */
export const PO_STATUS_BADGE_CLASSES: Record<POStatus, string> = {
  DRAFT: 'bg-amber-50 text-amber-700 border border-amber-200',
  AWAITING_PROOF: 'bg-sky-50 text-sky-700 border border-sky-200',
  REVIEW: 'bg-brand-teal-50 text-brand-teal-700 border border-brand-teal-200',
  POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border border-red-200',
  CLOSED: 'bg-slate-100 text-slate-600 border border-slate-200',
}

/**
 * Human-readable labels for Purchase Order statuses
 */
export const PO_STATUS_LABELS: Record<POStatus, string> = {
  DRAFT: 'Draft',
  AWAITING_PROOF: 'Awaiting Proof',
  REVIEW: 'Review',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
  CLOSED: 'Closed',
}

/**
 * Badge CSS classes for Purchase Order types
 */
export const PO_TYPE_BADGE_CLASSES: Record<POType, string> = {
  PURCHASE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  FULFILLMENT: 'bg-red-50 text-red-700 border border-red-200',
  ADJUSTMENT: 'bg-muted text-muted-foreground border border-muted',
}

/**
 * Human-readable labels for Purchase Order types
 */
export const PO_TYPE_LABELS: Record<POType, string> = {
  PURCHASE: 'Inbound',
  FULFILLMENT: 'Outbound',
  ADJUSTMENT: 'Adjustment',
}

/**
 * Badge CSS classes for Transaction types
 */
export const TX_TYPE_BADGE_CLASSES: Record<TxType, string> = {
  RECEIVE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  SHIP: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  ADJUST_IN: 'bg-blue-50 text-blue-700 border border-blue-200',
  ADJUST_OUT: 'bg-orange-50 text-orange-700 border border-orange-200',
}

/**
 * Human-readable labels for Transaction types
 */
export const TX_TYPE_LABELS: Record<TxType, string> = {
  RECEIVE: 'Receive',
  SHIP: 'Ship',
  ADJUST_IN: 'Adjust In',
  ADJUST_OUT: 'Adjust Out',
}

/**
 * Badge CSS classes for Movement Note statuses
 */
export const MN_STATUS_BADGE_CLASSES: Record<MNStatus, string> = {
  DRAFT: 'bg-amber-50 text-amber-700 border border-amber-200',
  POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border border-red-200',
  RECONCILED: 'bg-blue-50 text-blue-700 border border-blue-200',
}

/**
 * Human-readable labels for Movement Note statuses
 */
export const MN_STATUS_LABELS: Record<MNStatus, string> = {
  DRAFT: 'Draft',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
  RECONCILED: 'Reconciled',
}

/**
 * Badge CSS classes for PO Line statuses
 */
export const PO_LINE_STATUS_BADGE_CLASSES: Record<POLineStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
  POSTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border border-red-200',
}

/**
 * Human-readable labels for PO Line statuses
 */
export const PO_LINE_STATUS_LABELS: Record<POLineStatus, string> = {
  PENDING: 'Pending',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
}

/**
 * Helper function to get status badge class with fallback
 */
export function getStatusBadgeClass(status: string, type: 'po' | 'tx' | 'mn' | 'poLine'): string {
  const fallback = 'bg-muted text-muted-foreground border border-muted'

  switch (type) {
    case 'po':
      return PO_STATUS_BADGE_CLASSES[status as POStatus] ?? fallback
    case 'tx':
      return TX_TYPE_BADGE_CLASSES[status as TxType] ?? fallback
    case 'mn':
      return MN_STATUS_BADGE_CLASSES[status as MNStatus] ?? fallback
    case 'poLine':
      return PO_LINE_STATUS_BADGE_CLASSES[status as POLineStatus] ?? fallback
    default:
      return fallback
  }
}

/**
 * Helper function to get status label with fallback
 */
export function getStatusLabel(status: string, type: 'po' | 'tx' | 'mn' | 'poLine'): string {
  switch (type) {
    case 'po':
      return PO_STATUS_LABELS[status as POStatus] ?? status
    case 'tx':
      return TX_TYPE_LABELS[status as TxType] ?? status
    case 'mn':
      return MN_STATUS_LABELS[status as MNStatus] ?? status
    case 'poLine':
      return PO_LINE_STATUS_LABELS[status as POLineStatus] ?? status
    default:
      return status
  }
}
