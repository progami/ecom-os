import { getTenantPrisma } from '@/lib/tenant/server'
import {
  PurchaseOrder,
  PurchaseOrderStatus,
  Prisma,
} from '@ecom-os/prisma-wms'
import { NotFoundError, ValidationError, ConflictError } from '@/lib/api'
import { canApproveStageTransition, isSuperAdmin } from './permission-service'
import { auditLog } from '@/lib/security/audit-logger'

// Valid stage transitions for new 5-stage workflow
export const VALID_TRANSITIONS: Partial<Record<PurchaseOrderStatus, PurchaseOrderStatus[]>> = {
  DRAFT: [PurchaseOrderStatus.MANUFACTURING, PurchaseOrderStatus.CANCELLED],
  MANUFACTURING: [PurchaseOrderStatus.OCEAN, PurchaseOrderStatus.CANCELLED],
  OCEAN: [PurchaseOrderStatus.WAREHOUSE, PurchaseOrderStatus.CANCELLED],
  WAREHOUSE: [PurchaseOrderStatus.SHIPPED, PurchaseOrderStatus.CANCELLED],
  SHIPPED: [], // Terminal state
  CANCELLED: [], // Terminal state
  ARCHIVED: [], // Legacy terminal state
  // Legacy statuses have no valid transitions in new workflow
  AWAITING_PROOF: [],
  REVIEW: [],
  POSTED: [],
  CLOSED: [],
}

// Stage-specific required fields for transition
export const STAGE_REQUIREMENTS: Record<string, string[]> = {
  MANUFACTURING: ['proformaInvoiceId', 'manufacturingStart'],
  OCEAN: ['houseBillOfLading', 'packingListRef', 'commercialInvoiceId'],
  WAREHOUSE: ['warehouseInvoiceId', 'surrenderBL', 'transactionCertificate', 'customsDeclaration'],
  SHIPPED: ['proofOfDelivery'],
}

// Field labels for error messages
const FIELD_LABELS: Record<string, string> = {
  proformaInvoiceId: 'Proforma Invoice ID',
  manufacturingStart: 'Manufacturing Start Date',
  houseBillOfLading: 'House Bill of Lading',
  packingListRef: 'Packing List Reference',
  commercialInvoiceId: 'Commercial Invoice ID',
  warehouseInvoiceId: 'Warehouse Invoice ID',
  surrenderBL: 'Surrender B/L',
  transactionCertificate: 'Transaction Certificate',
  customsDeclaration: 'Customs Declaration',
  proofOfDelivery: 'Proof of Delivery',
}

export interface StageTransitionInput {
  // Manufacturing stage data
  proformaInvoiceId?: string
  proformaInvoiceData?: Prisma.JsonValue
  manufacturingStart?: Date | string
  manufacturingEnd?: Date | string
  cargoDetails?: Prisma.JsonValue

  // Ocean stage data
  houseBillOfLading?: string
  packingListRef?: string
  commercialInvoiceId?: string

  // Warehouse stage data
  warehouseInvoiceId?: string
  surrenderBL?: string
  transactionCertificate?: string
  customsDeclaration?: string

  // Shipped stage data
  proofOfDelivery?: string
}

export interface UserContext {
  id: string
  name: string
  email: string
}

/**
 * Check if a transition is valid
 */
export function isValidTransition(
  fromStatus: PurchaseOrderStatus,
  toStatus: PurchaseOrderStatus
): boolean {
  const validTargets = VALID_TRANSITIONS[fromStatus]
  return validTargets?.includes(toStatus) ?? false
}

/**
 * Get valid next stages from current status
 */
export function getValidNextStages(
  currentStatus: PurchaseOrderStatus
): PurchaseOrderStatus[] {
  return VALID_TRANSITIONS[currentStatus] ?? []
}

/**
 * Get required fields for transitioning to a stage
 */
export function getRequiredFieldsForStage(stage: PurchaseOrderStatus): string[] {
  return STAGE_REQUIREMENTS[stage] ?? []
}

/**
 * Validate that all required fields are present for a stage
 */
export function validateStageData(
  targetStage: PurchaseOrderStatus,
  data: StageTransitionInput,
  existingOrder: PurchaseOrder
): { valid: boolean; missingFields: string[] } {
  const requiredFields = getRequiredFieldsForStage(targetStage)
  const missingFields: string[] = []

  for (const field of requiredFields) {
    // Check if the field exists in the new data or already on the order
    const newValue = data[field as keyof StageTransitionInput]
    const existingValue = existingOrder[field as keyof PurchaseOrder]

    if (!newValue && !existingValue) {
      missingFields.push(FIELD_LABELS[field] || field)
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Generate the next PO number in sequence (PO-0001 format)
 */
export async function generatePoNumber(): Promise<string> {
  const prisma = await getTenantPrisma()

  // Find the highest existing PO number
  const lastPo = await prisma.purchaseOrder.findFirst({
    where: {
      poNumber: { startsWith: 'PO-' },
    },
    orderBy: { poNumber: 'desc' },
    select: { poNumber: true },
  })

  let nextNumber = 1
  if (lastPo?.poNumber) {
    const match = lastPo.poNumber.match(/PO-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }

  return `PO-${nextNumber.toString().padStart(4, '0')}`
}

/**
 * Create a new Purchase Order in DRAFT status
 */
export async function createPurchaseOrder(
  input: {
    warehouseCode: string
    warehouseName: string
    counterpartyName?: string
    expectedDate?: Date
    notes?: string
    receiveType?: string
  },
  user: UserContext
): Promise<PurchaseOrder> {
  const prisma = await getTenantPrisma()

  const poNumber = await generatePoNumber()
  const orderNumber = `${input.warehouseCode}-${poNumber}`

  const order = await prisma.purchaseOrder.create({
    data: {
      orderNumber,
      poNumber,
      type: 'PURCHASE',
      status: 'DRAFT',
      warehouseCode: input.warehouseCode,
      warehouseName: input.warehouseName,
      counterpartyName: input.counterpartyName,
      expectedDate: input.expectedDate,
      notes: input.notes,
      receiveType: input.receiveType as any,
      createdById: user.id,
      createdByName: user.name,
      isLegacy: false,
    },
  })

  await auditLog({
    userId: user.id,
    action: 'CREATE',
    entityType: 'PurchaseOrder',
    entityId: order.id,
    data: { poNumber, status: 'DRAFT' },
  })

  return order
}

/**
 * Transition a Purchase Order to a new stage
 */
export async function transitionPurchaseOrderStage(
  orderId: string,
  targetStatus: PurchaseOrderStatus,
  stageData: StageTransitionInput,
  user: UserContext
): Promise<PurchaseOrder> {
  const prisma = await getTenantPrisma()

  // Get the current order
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    include: { lines: true },
  })

  if (!order) {
    throw new NotFoundError(`Purchase Order not found: ${orderId}`)
  }

  // Check if order is legacy
  if (order.isLegacy) {
    throw new ConflictError('Cannot transition legacy orders. They are archived.')
  }

  const currentStatus = order.status as PurchaseOrderStatus

  // Validate the transition is allowed
  if (!isValidTransition(currentStatus, targetStatus)) {
    throw new ValidationError(
      `Invalid transition from ${currentStatus} to ${targetStatus}. ` +
        `Valid targets: ${getValidNextStages(currentStatus).join(', ') || 'none'}`
    )
  }

  // Check user permission for this transition (unless cancelling)
  if (targetStatus !== PurchaseOrderStatus.CANCELLED) {
    const canApprove = await canApproveStageTransition(
      user.id,
      currentStatus,
      targetStatus
    )

    if (!canApprove && !isSuperAdmin(user.email)) {
      throw new ValidationError(
        `You don't have permission to approve the transition from ${currentStatus} to ${targetStatus}`
      )
    }
  }

  // Validate stage data requirements
  if (targetStatus !== PurchaseOrderStatus.CANCELLED) {
    const validation = validateStageData(targetStatus, stageData, order)
    if (!validation.valid) {
      throw new ValidationError(
        `Missing required fields for ${targetStatus}: ${validation.missingFields.join(', ')}`
      )
    }
  }

  // Build the update data
  const updateData: Prisma.PurchaseOrderUpdateInput = {
    status: targetStatus,
  }

  // Add stage-specific data
  if (stageData.proformaInvoiceId !== undefined) {
    updateData.proformaInvoiceId = stageData.proformaInvoiceId
  }
  if (stageData.proformaInvoiceData !== undefined) {
    updateData.proformaInvoiceData = stageData.proformaInvoiceData
  }
  if (stageData.manufacturingStart !== undefined) {
    updateData.manufacturingStart = new Date(stageData.manufacturingStart)
  }
  if (stageData.manufacturingEnd !== undefined) {
    updateData.manufacturingEnd = new Date(stageData.manufacturingEnd)
  }
  if (stageData.cargoDetails !== undefined) {
    updateData.cargoDetails = stageData.cargoDetails
  }
  if (stageData.houseBillOfLading !== undefined) {
    updateData.houseBillOfLading = stageData.houseBillOfLading
  }
  if (stageData.packingListRef !== undefined) {
    updateData.packingListRef = stageData.packingListRef
  }
  if (stageData.commercialInvoiceId !== undefined) {
    updateData.commercialInvoiceId = stageData.commercialInvoiceId
  }
  if (stageData.warehouseInvoiceId !== undefined) {
    updateData.warehouseInvoiceId = stageData.warehouseInvoiceId
  }
  if (stageData.surrenderBL !== undefined) {
    updateData.surrenderBL = stageData.surrenderBL
  }
  if (stageData.transactionCertificate !== undefined) {
    updateData.transactionCertificate = stageData.transactionCertificate
  }
  if (stageData.customsDeclaration !== undefined) {
    updateData.customsDeclaration = stageData.customsDeclaration
  }
  if (stageData.proofOfDelivery !== undefined) {
    updateData.proofOfDelivery = stageData.proofOfDelivery
  }

  // Set approval tracking based on target status
  const now = new Date()
  switch (targetStatus) {
    case PurchaseOrderStatus.MANUFACTURING:
      updateData.draftApprovedAt = now
      updateData.draftApprovedById = user.id
      updateData.draftApprovedByName = user.name
      break
    case PurchaseOrderStatus.OCEAN:
      updateData.manufacturingApprovedAt = now
      updateData.manufacturingApprovedById = user.id
      updateData.manufacturingApprovedByName = user.name
      break
    case PurchaseOrderStatus.WAREHOUSE:
      updateData.oceanApprovedAt = now
      updateData.oceanApprovedById = user.id
      updateData.oceanApprovedByName = user.name
      break
    case PurchaseOrderStatus.SHIPPED:
      updateData.warehouseApprovedAt = now
      updateData.warehouseApprovedById = user.id
      updateData.warehouseApprovedByName = user.name
      updateData.shippedAt = now
      updateData.shippedById = user.id
      updateData.shippedByName = user.name
      break
  }

  // Execute the transition
  const updatedOrder = await prisma.purchaseOrder.update({
    where: { id: orderId },
    data: updateData,
    include: { lines: true },
  })

  // Audit log the transition
  await auditLog({
    userId: user.id,
    action: 'STATUS_TRANSITION',
    entityType: 'PurchaseOrder',
    entityId: orderId,
    data: { fromStatus: currentStatus, toStatus: targetStatus, approvedBy: user.name },
  })

  // TODO: Handle inventory ledger impacts
  // - WAREHOUSE stage: Create inventory IN transactions
  // - SHIPPED stage: Create inventory OUT transactions

  return updatedOrder
}

/**
 * Get stage approval history for a Purchase Order
 */
export function getStageApprovalHistory(order: PurchaseOrder): {
  stage: string
  approvedAt: Date | null
  approvedBy: string | null
}[] {
  const history = []

  if (order.draftApprovedAt) {
    history.push({
      stage: 'DRAFT → MANUFACTURING',
      approvedAt: order.draftApprovedAt,
      approvedBy: order.draftApprovedByName,
    })
  }

  if (order.manufacturingApprovedAt) {
    history.push({
      stage: 'MANUFACTURING → OCEAN',
      approvedAt: order.manufacturingApprovedAt,
      approvedBy: order.manufacturingApprovedByName,
    })
  }

  if (order.oceanApprovedAt) {
    history.push({
      stage: 'OCEAN → WAREHOUSE',
      approvedAt: order.oceanApprovedAt,
      approvedBy: order.oceanApprovedByName,
    })
  }

  if (order.warehouseApprovedAt) {
    history.push({
      stage: 'WAREHOUSE → SHIPPED',
      approvedAt: order.warehouseApprovedAt,
      approvedBy: order.warehouseApprovedByName,
    })
  }

  return history
}

/**
 * Get current stage data for display
 */
export function getStageData(order: PurchaseOrder): {
  manufacturing: Record<string, any>
  ocean: Record<string, any>
  warehouse: Record<string, any>
  shipped: Record<string, any>
} {
  return {
    manufacturing: {
      proformaInvoiceId: order.proformaInvoiceId,
      proformaInvoiceData: order.proformaInvoiceData,
      manufacturingStart: order.manufacturingStart,
      manufacturingEnd: order.manufacturingEnd,
      cargoDetails: order.cargoDetails,
    },
    ocean: {
      houseBillOfLading: order.houseBillOfLading,
      packingListRef: order.packingListRef,
      commercialInvoiceId: order.commercialInvoiceId,
    },
    warehouse: {
      warehouseInvoiceId: order.warehouseInvoiceId,
      surrenderBL: order.surrenderBL,
      transactionCertificate: order.transactionCertificate,
      customsDeclaration: order.customsDeclaration,
    },
    shipped: {
      proofOfDelivery: order.proofOfDelivery,
      shippedAt: order.shippedAt,
      shippedBy: order.shippedByName,
    },
  }
}

// Export status constants for UI use
export const PO_STAGES = [
  PurchaseOrderStatus.DRAFT,
  PurchaseOrderStatus.MANUFACTURING,
  PurchaseOrderStatus.OCEAN,
  PurchaseOrderStatus.WAREHOUSE,
  PurchaseOrderStatus.SHIPPED,
] as const

export const PO_STAGE_LABELS: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.DRAFT]: 'Draft',
  [PurchaseOrderStatus.MANUFACTURING]: 'Manufacturing',
  [PurchaseOrderStatus.OCEAN]: 'In Transit',
  [PurchaseOrderStatus.WAREHOUSE]: 'At Warehouse',
  [PurchaseOrderStatus.SHIPPED]: 'Shipped',
  [PurchaseOrderStatus.CANCELLED]: 'Cancelled',
  [PurchaseOrderStatus.ARCHIVED]: 'Archived',
  // Legacy statuses
  [PurchaseOrderStatus.AWAITING_PROOF]: 'Awaiting Proof',
  [PurchaseOrderStatus.REVIEW]: 'Review',
  [PurchaseOrderStatus.POSTED]: 'Posted',
  [PurchaseOrderStatus.CLOSED]: 'Closed',
}

export const PO_STAGE_COLORS: Record<PurchaseOrderStatus, string> = {
  [PurchaseOrderStatus.DRAFT]: 'slate',
  [PurchaseOrderStatus.MANUFACTURING]: 'amber',
  [PurchaseOrderStatus.OCEAN]: 'blue',
  [PurchaseOrderStatus.WAREHOUSE]: 'purple',
  [PurchaseOrderStatus.SHIPPED]: 'emerald',
  [PurchaseOrderStatus.CANCELLED]: 'red',
  [PurchaseOrderStatus.ARCHIVED]: 'gray',
  // Legacy statuses
  [PurchaseOrderStatus.AWAITING_PROOF]: 'sky',
  [PurchaseOrderStatus.REVIEW]: 'cyan',
  [PurchaseOrderStatus.POSTED]: 'emerald',
  [PurchaseOrderStatus.CLOSED]: 'slate',
}

/**
 * Serialize a PurchaseOrder for API responses
 */
export function serializePurchaseOrder(order: PurchaseOrder & { lines?: any[] }): Record<string, any> {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    poNumber: order.poNumber,
    type: order.type,
    status: order.status,
    warehouseCode: order.warehouseCode,
    warehouseName: order.warehouseName,
    counterpartyName: order.counterpartyName,
    expectedDate: order.expectedDate?.toISOString() ?? null,
    notes: order.notes,
    receiveType: order.receiveType,
    isLegacy: order.isLegacy,

    // Stage data
    stageData: getStageData(order),
    approvalHistory: getStageApprovalHistory(order),

    // Metadata
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    createdById: order.createdById,
    createdByName: order.createdByName,

    // Lines if included
    lines: order.lines?.map((line) => ({
      id: line.id,
      itemSku: line.itemSku,
      itemName: line.itemName,
      quantity: line.quantity,
      receivedQuantity: line.receivedQuantity,
      unitCost: line.unitCost,
    })),
  }
}
