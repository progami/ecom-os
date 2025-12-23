import { getTenantPrisma } from '@/lib/tenant/server'
import {
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseOrderLineStatus,
  Prisma,
} from '@ecom-os/prisma-wms'
import { NotFoundError, ValidationError, ConflictError } from '@/lib/api'
import { canApproveStageTransition, hasPermission, isSuperAdmin } from './permission-service'
import { auditLog } from '@/lib/security/audit-logger'
import { toPublicOrderNumber } from './purchase-order-utils'
import { recalculateStorageLedgerForTransactions } from './storage-ledger-sync'

// Valid stage transitions for new 5-stage workflow
export const VALID_TRANSITIONS: Partial<Record<PurchaseOrderStatus, PurchaseOrderStatus[]>> = {
  DRAFT: [PurchaseOrderStatus.MANUFACTURING, PurchaseOrderStatus.CANCELLED],
  MANUFACTURING: [PurchaseOrderStatus.OCEAN, PurchaseOrderStatus.CANCELLED],
  OCEAN: [PurchaseOrderStatus.WAREHOUSE, PurchaseOrderStatus.CANCELLED],
  WAREHOUSE: [PurchaseOrderStatus.SHIPPED, PurchaseOrderStatus.CANCELLED],
  SHIPPED: [], // Terminal state
  CANCELLED: [], // Terminal state
}

// Stage-specific required fields for transition
export const STAGE_REQUIREMENTS: Record<string, string[]> = {
  // Stage 2: Manufacturing
  MANUFACTURING: ['proformaInvoiceNumber', 'manufacturingStartDate'],
  // Stage 3: Ocean
  OCEAN: ['houseBillOfLading', 'commercialInvoiceNumber', 'packingListRef', 'vesselName', 'portOfLoading', 'portOfDischarge'],
  // Stage 4: Warehouse - now requires selecting the warehouse
  WAREHOUSE: ['warehouseCode', 'customsEntryNumber', 'customsClearedDate', 'receivedDate'],
  // Stage 5: Shipped
  SHIPPED: ['shipToName', 'shippingCarrier', 'trackingNumber', 'shippedDate'],
}

// Field labels for error messages
const FIELD_LABELS: Record<string, string> = {
  // Stage 2
  proformaInvoiceNumber: 'Proforma Invoice Number',
  manufacturingStartDate: 'Manufacturing Start Date',
  expectedCompletionDate: 'Expected Completion Date',
  // Stage 3
  houseBillOfLading: 'House Bill of Lading',
  commercialInvoiceNumber: 'Commercial Invoice Number',
  packingListRef: 'Packing List Reference',
  vesselName: 'Vessel Name',
  portOfLoading: 'Port of Loading',
  portOfDischarge: 'Port of Discharge',
  // Stage 4
  warehouseCode: 'Warehouse',
  customsEntryNumber: 'Customs Entry Number',
  customsClearedDate: 'Customs Cleared Date',
  receivedDate: 'Received Date',
  // Stage 5
  shipToName: 'Ship To Name',
  shippingCarrier: 'Shipping Carrier',
  trackingNumber: 'Tracking Number',
  shippedDate: 'Shipped Date',
  proofOfDeliveryRef: 'Proof of Delivery Reference',
}

export interface StageTransitionInput {
  // Stage 2: Manufacturing
  proformaInvoiceNumber?: string
  proformaInvoiceDate?: Date | string
  factoryName?: string
  manufacturingStartDate?: Date | string
  expectedCompletionDate?: Date | string
  actualCompletionDate?: Date | string
  totalWeightKg?: number
  totalVolumeCbm?: number
  totalCartons?: number
  totalPallets?: number
  packagingNotes?: string

  // Stage 3: Ocean
  houseBillOfLading?: string
  masterBillOfLading?: string
  commercialInvoiceNumber?: string
  packingListRef?: string
  vesselName?: string
  voyageNumber?: string
  portOfLoading?: string
  portOfDischarge?: string
  estimatedDeparture?: Date | string
  estimatedArrival?: Date | string
  actualDeparture?: Date | string
  actualArrival?: Date | string

  // Stage 4: Warehouse
  warehouseCode?: string
  warehouseName?: string
  customsEntryNumber?: string
  customsClearedDate?: Date | string
  dutyAmount?: number
  dutyCurrency?: string
  surrenderBlDate?: Date | string
  transactionCertNumber?: string
  receivedDate?: Date | string
  discrepancyNotes?: string

  // Stage 5: Shipped
  shipToName?: string
  shipToAddress?: string
  shipToCity?: string
  shipToCountry?: string
  shipToPostalCode?: string
  shippingCarrier?: string
  shippingMethod?: string
  trackingNumber?: string
  shippedDate?: Date | string
  proofOfDeliveryRef?: string
  deliveredDate?: Date | string

  // Legacy fields (for backward compatibility)
  proformaInvoiceId?: string
  proformaInvoiceData?: Prisma.JsonValue
  manufacturingStart?: Date | string
  manufacturingEnd?: Date | string
  cargoDetails?: Prisma.JsonValue
  commercialInvoiceId?: string
  warehouseInvoiceId?: string
  surrenderBL?: string
  transactionCertificate?: string
  customsDeclaration?: string
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

export interface CreatePurchaseOrderLineInput {
  skuCode: string
  skuDescription?: string
  quantity: number
  unitCost?: number
  currency?: string
  notes?: string
}

/**
 * Create a new Purchase Order in DRAFT status
 * Warehouse is NOT required at this stage - it's selected at Stage 4 (WAREHOUSE)
 */
export async function createPurchaseOrder(
  input: {
    counterpartyName?: string
    notes?: string
    lines?: CreatePurchaseOrderLineInput[]
  },
  user: UserContext
): Promise<PurchaseOrder & { lines: any[] }> {
  const prisma = await getTenantPrisma()

  const MAX_PO_NUMBER_ATTEMPTS = 5
  let order: (PurchaseOrder & { lines: any[] }) | null = null

  for (let attempt = 0; attempt < MAX_PO_NUMBER_ATTEMPTS; attempt += 1) {
    const poNumber = await generatePoNumber()
    const orderNumber = poNumber // Order number is just the PO number now

    try {
      order = await prisma.purchaseOrder.create({
        data: {
          orderNumber,
          poNumber,
          type: 'PURCHASE',
          status: 'DRAFT',
          counterpartyName: input.counterpartyName,
          notes: input.notes,
          createdById: user.id,
          createdByName: user.name,
          isLegacy: false,
          // Create lines if provided
          lines:
            input.lines && input.lines.length > 0
              ? {
                  create: input.lines.map((line) => ({
                    skuCode: line.skuCode,
                    skuDescription: line.skuDescription || '',
                    quantity: line.quantity,
                    unitCost: line.unitCost,
                    currency: line.currency || 'USD',
                    lineNotes: line.notes,
                    status: 'PENDING',
                  })),
                }
              : undefined,
        },
        include: {
          lines: true,
        },
      })
      break
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue
      }
      throw error
    }
  }

  if (!order) {
    throw new ValidationError('Unable to generate a unique PO number. Please retry.')
  }

  await auditLog({
    userId: user.id,
    action: 'CREATE',
    entityType: 'PurchaseOrder',
    entityId: order.id,
    data: { poNumber: order.poNumber, status: 'DRAFT', lineCount: input.lines?.length || 0 },
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
  if (targetStatus === PurchaseOrderStatus.CANCELLED) {
    const canCancel = await hasPermission(user.id, 'po.cancel')
    if (!canCancel && !isSuperAdmin(user.email)) {
      throw new ValidationError(`You don't have permission to cancel purchase orders`)
    }
  } else {
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

  if (targetStatus === PurchaseOrderStatus.CANCELLED) {
    const storageRecalcInputs = await prisma.inventoryTransaction.findMany({
      where: { purchaseOrderId: order.id },
      select: {
        warehouseCode: true,
        warehouseName: true,
        skuCode: true,
        skuDescription: true,
        batchLot: true,
        transactionDate: true,
      },
    })

    const updatedOrder = await prisma.$transaction(async tx => {
      await tx.inventoryTransaction.deleteMany({
        where: { purchaseOrderId: order.id },
      })

      await tx.purchaseOrderLine.updateMany({
        where: { purchaseOrderId: order.id },
        data: {
          status: PurchaseOrderLineStatus.CANCELLED,
          postedQuantity: 0,
          quantityReceived: 0,
        },
      })

      return tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: targetStatus,
          postedAt: null,
        },
        include: { lines: true },
      })
    })

    await auditLog({
      userId: user.id,
      action: 'STATUS_TRANSITION',
      entityType: 'PurchaseOrder',
      entityId: orderId,
      data: { fromStatus: currentStatus, toStatus: targetStatus, approvedBy: user.name },
    })

    await recalculateStorageLedgerForTransactions(
      storageRecalcInputs.map(transaction => ({
        warehouseCode: transaction.warehouseCode,
        warehouseName: transaction.warehouseName,
        skuCode: transaction.skuCode,
        skuDescription: transaction.skuDescription,
        batchLot: transaction.batchLot,
        transactionDate: transaction.transactionDate,
      }))
    )

    return updatedOrder
  }

  // Validate stage data requirements
  const validation = validateStageData(targetStatus, stageData, order)
  if (!validation.valid) {
    throw new ValidationError(
      `Missing required fields for ${targetStatus}: ${validation.missingFields.join(', ')}`
    )
  }

  // Build the update data
  const updateData: Prisma.PurchaseOrderUpdateInput = {
    status: targetStatus,
  }

  // Stage 2: Manufacturing fields
  if (stageData.proformaInvoiceNumber !== undefined) {
    updateData.proformaInvoiceNumber = stageData.proformaInvoiceNumber
  }
  if (stageData.proformaInvoiceDate !== undefined) {
    updateData.proformaInvoiceDate = new Date(stageData.proformaInvoiceDate)
  }
  if (stageData.factoryName !== undefined) {
    updateData.factoryName = stageData.factoryName
  }
  if (stageData.manufacturingStartDate !== undefined) {
    updateData.manufacturingStartDate = new Date(stageData.manufacturingStartDate)
  }
  if (stageData.expectedCompletionDate !== undefined) {
    updateData.expectedCompletionDate = new Date(stageData.expectedCompletionDate)
  }
  if (stageData.actualCompletionDate !== undefined) {
    updateData.actualCompletionDate = new Date(stageData.actualCompletionDate)
  }
  if (stageData.totalWeightKg !== undefined) {
    updateData.totalWeightKg = stageData.totalWeightKg
  }
  if (stageData.totalVolumeCbm !== undefined) {
    updateData.totalVolumeCbm = stageData.totalVolumeCbm
  }
  if (stageData.totalCartons !== undefined) {
    updateData.totalCartons = stageData.totalCartons
  }
  if (stageData.totalPallets !== undefined) {
    updateData.totalPallets = stageData.totalPallets
  }
  if (stageData.packagingNotes !== undefined) {
    updateData.packagingNotes = stageData.packagingNotes
  }

  // Stage 3: Ocean fields
  if (stageData.houseBillOfLading !== undefined) {
    updateData.houseBillOfLading = stageData.houseBillOfLading
  }
  if (stageData.masterBillOfLading !== undefined) {
    updateData.masterBillOfLading = stageData.masterBillOfLading
  }
  if (stageData.commercialInvoiceNumber !== undefined) {
    updateData.commercialInvoiceNumber = stageData.commercialInvoiceNumber
  }
  if (stageData.packingListRef !== undefined) {
    updateData.packingListRef = stageData.packingListRef
  }
  if (stageData.vesselName !== undefined) {
    updateData.vesselName = stageData.vesselName
  }
  if (stageData.voyageNumber !== undefined) {
    updateData.voyageNumber = stageData.voyageNumber
  }
  if (stageData.portOfLoading !== undefined) {
    updateData.portOfLoading = stageData.portOfLoading
  }
  if (stageData.portOfDischarge !== undefined) {
    updateData.portOfDischarge = stageData.portOfDischarge
  }
  if (stageData.estimatedDeparture !== undefined) {
    updateData.estimatedDeparture = new Date(stageData.estimatedDeparture)
  }
  if (stageData.estimatedArrival !== undefined) {
    updateData.estimatedArrival = new Date(stageData.estimatedArrival)
  }
  if (stageData.actualDeparture !== undefined) {
    updateData.actualDeparture = new Date(stageData.actualDeparture)
  }
  if (stageData.actualArrival !== undefined) {
    updateData.actualArrival = new Date(stageData.actualArrival)
  }

  // Stage 4: Warehouse fields
  if (stageData.warehouseCode !== undefined) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { code: stageData.warehouseCode },
      select: { name: true },
    })
    if (!warehouse) {
      throw new ValidationError(`Invalid warehouse code: ${stageData.warehouseCode}`)
    }

    updateData.warehouseCode = stageData.warehouseCode
    updateData.warehouseName = stageData.warehouseName ?? warehouse.name
  }
  if (stageData.warehouseName !== undefined && stageData.warehouseCode === undefined) {
    updateData.warehouseName = stageData.warehouseName
  }
  if (stageData.customsEntryNumber !== undefined) {
    updateData.customsEntryNumber = stageData.customsEntryNumber
  }
  if (stageData.customsClearedDate !== undefined) {
    updateData.customsClearedDate = new Date(stageData.customsClearedDate)
  }
  if (stageData.dutyAmount !== undefined) {
    updateData.dutyAmount = stageData.dutyAmount
  }
  if (stageData.dutyCurrency !== undefined) {
    updateData.dutyCurrency = stageData.dutyCurrency
  }
  if (stageData.surrenderBlDate !== undefined) {
    updateData.surrenderBlDate = new Date(stageData.surrenderBlDate)
  }
  if (stageData.transactionCertNumber !== undefined) {
    updateData.transactionCertNumber = stageData.transactionCertNumber
  }
  if (stageData.receivedDate !== undefined) {
    updateData.receivedDate = new Date(stageData.receivedDate)
  }
  if (stageData.discrepancyNotes !== undefined) {
    updateData.discrepancyNotes = stageData.discrepancyNotes
  }

  // Stage 5: Shipped fields
  if (stageData.shipToName !== undefined) {
    updateData.shipToName = stageData.shipToName
  }
  if (stageData.shipToAddress !== undefined) {
    updateData.shipToAddress = stageData.shipToAddress
  }
  if (stageData.shipToCity !== undefined) {
    updateData.shipToCity = stageData.shipToCity
  }
  if (stageData.shipToCountry !== undefined) {
    updateData.shipToCountry = stageData.shipToCountry
  }
  if (stageData.shipToPostalCode !== undefined) {
    updateData.shipToPostalCode = stageData.shipToPostalCode
  }
  if (stageData.shippingCarrier !== undefined) {
    updateData.shippingCarrier = stageData.shippingCarrier
  }
  if (stageData.shippingMethod !== undefined) {
    updateData.shippingMethod = stageData.shippingMethod
  }
  if (stageData.trackingNumber !== undefined) {
    updateData.trackingNumber = stageData.trackingNumber
  }
  if (stageData.shippedDate !== undefined) {
    updateData.shippedDate = new Date(stageData.shippedDate)
  }
  if (stageData.proofOfDeliveryRef !== undefined) {
    updateData.proofOfDeliveryRef = stageData.proofOfDeliveryRef
  }
  if (stageData.deliveredDate !== undefined) {
    updateData.deliveredDate = new Date(stageData.deliveredDate)
  }

  // Legacy fields (for backward compatibility)
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
      updateData.shippedApprovedAt = now
      updateData.shippedApprovedById = user.id
      updateData.shippedApprovedByName = user.name
      // Legacy (keep existing consumers working)
      updateData.shippedAt =
        stageData.shippedDate !== undefined
          ? new Date(stageData.shippedDate)
          : order.shippedDate
            ? new Date(order.shippedDate)
            : now
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
      proformaInvoiceNumber: order.proformaInvoiceNumber,
      proformaInvoiceDate: order.proformaInvoiceDate,
      factoryName: order.factoryName,
      manufacturingStartDate: order.manufacturingStartDate,
      expectedCompletionDate: order.expectedCompletionDate,
      actualCompletionDate: order.actualCompletionDate,
      totalWeightKg: order.totalWeightKg ? Number(order.totalWeightKg) : null,
      totalVolumeCbm: order.totalVolumeCbm ? Number(order.totalVolumeCbm) : null,
      totalCartons: order.totalCartons,
      totalPallets: order.totalPallets,
      packagingNotes: order.packagingNotes,
      // Legacy fields
      proformaInvoiceId: order.proformaInvoiceId,
      proformaInvoiceData: order.proformaInvoiceData,
      manufacturingStart: order.manufacturingStart,
      manufacturingEnd: order.manufacturingEnd,
      cargoDetails: order.cargoDetails,
    },
    ocean: {
      houseBillOfLading: order.houseBillOfLading,
      masterBillOfLading: order.masterBillOfLading,
      commercialInvoiceNumber: order.commercialInvoiceNumber,
      packingListRef: order.packingListRef,
      vesselName: order.vesselName,
      voyageNumber: order.voyageNumber,
      portOfLoading: order.portOfLoading,
      portOfDischarge: order.portOfDischarge,
      estimatedDeparture: order.estimatedDeparture,
      estimatedArrival: order.estimatedArrival,
      actualDeparture: order.actualDeparture,
      actualArrival: order.actualArrival,
      // Legacy
      commercialInvoiceId: order.commercialInvoiceId,
    },
    warehouse: {
      warehouseCode: order.warehouseCode,
      warehouseName: order.warehouseName,
      customsEntryNumber: order.customsEntryNumber,
      customsClearedDate: order.customsClearedDate,
      dutyAmount: order.dutyAmount ? Number(order.dutyAmount) : null,
      dutyCurrency: order.dutyCurrency,
      surrenderBlDate: order.surrenderBlDate,
      transactionCertNumber: order.transactionCertNumber,
      receivedDate: order.receivedDate,
      discrepancyNotes: order.discrepancyNotes,
      // Legacy
      warehouseInvoiceId: order.warehouseInvoiceId,
      surrenderBL: order.surrenderBL,
      transactionCertificate: order.transactionCertificate,
      customsDeclaration: order.customsDeclaration,
    },
    shipped: {
      shipToName: order.shipToName,
      shipToAddress: order.shipToAddress,
      shipToCity: order.shipToCity,
      shipToCountry: order.shipToCountry,
      shipToPostalCode: order.shipToPostalCode,
      shippingCarrier: order.shippingCarrier,
      shippingMethod: order.shippingMethod,
      trackingNumber: order.trackingNumber,
      shippedDate: order.shippedDate,
      proofOfDeliveryRef: order.proofOfDeliveryRef,
      deliveredDate: order.deliveredDate,
      // Legacy
      proofOfDelivery: order.proofOfDelivery,
      shippedAt: order.shippedAt,
      shippedBy: order.shippedByName,
    },
  }
}

/**
 * Helper to serialize a date field
 */
function serializeDate(value: Date | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

/**
 * Serialize stage data dates to ISO strings
 */
function serializeStageData(data: ReturnType<typeof getStageData>): Record<string, any> {
  return {
    manufacturing: {
      ...data.manufacturing,
      proformaInvoiceDate: serializeDate(data.manufacturing.proformaInvoiceDate),
      manufacturingStartDate: serializeDate(data.manufacturing.manufacturingStartDate),
      expectedCompletionDate: serializeDate(data.manufacturing.expectedCompletionDate),
      actualCompletionDate: serializeDate(data.manufacturing.actualCompletionDate),
      // Legacy
      manufacturingStart: serializeDate(data.manufacturing.manufacturingStart),
      manufacturingEnd: serializeDate(data.manufacturing.manufacturingEnd),
    },
    ocean: {
      ...data.ocean,
      estimatedDeparture: serializeDate(data.ocean.estimatedDeparture),
      estimatedArrival: serializeDate(data.ocean.estimatedArrival),
      actualDeparture: serializeDate(data.ocean.actualDeparture),
      actualArrival: serializeDate(data.ocean.actualArrival),
    },
    warehouse: {
      ...data.warehouse,
      customsClearedDate: serializeDate(data.warehouse.customsClearedDate),
      surrenderBlDate: serializeDate(data.warehouse.surrenderBlDate),
      receivedDate: serializeDate(data.warehouse.receivedDate),
    },
    shipped: {
      ...data.shipped,
      shippedDate: serializeDate(data.shipped.shippedDate),
      deliveredDate: serializeDate(data.shipped.deliveredDate),
      // Legacy
      shippedAt: serializeDate(data.shipped.shippedAt),
    },
  }
}

/**
 * Serialize a PurchaseOrder for API responses
 */
export function serializePurchaseOrder(order: PurchaseOrder & { lines?: any[] }): Record<string, any> {
  return {
    id: order.id,
    orderNumber: toPublicOrderNumber(order.orderNumber),
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

    // Stage data - serialize dates to ISO strings
    stageData: serializeStageData(getStageData(order)),
    approvalHistory: getStageApprovalHistory(order).map(h => ({
      ...h,
      approvedAt: h.approvedAt?.toISOString() ?? null,
    })),

    // Metadata
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    createdById: order.createdById,
    createdByName: order.createdByName,

    // Lines if included
    lines: order.lines?.map((line) => ({
      id: line.id,
      skuCode: line.skuCode,
      skuDescription: line.skuDescription,
      batchLot: line.batchLot,
      quantity: line.quantity,
      unitCost: line.unitCost ? Number(line.unitCost) : null,
      currency: line.currency || 'USD',
      status: line.status,
      postedQuantity: line.postedQuantity,
      quantityReceived: line.quantityReceived,
      lineNotes: line.lineNotes,
      createdAt: line.createdAt?.toISOString?.() ?? line.createdAt,
      updatedAt: line.updatedAt?.toISOString?.() ?? line.updatedAt,
    })),
  }
}
