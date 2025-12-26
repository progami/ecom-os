import { getTenantPrisma, getCurrentTenant } from '@/lib/tenant/server'
import {
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseOrderLineStatus,
  PurchaseOrderDocumentStage,
  InboundReceiveType,
  OutboundShipMode,
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
  OCEAN: [
    'houseBillOfLading',
    'commercialInvoiceNumber',
    'packingListRef',
    'vesselName',
    'portOfLoading',
    'portOfDischarge',
  ],
  // Stage 4: Warehouse - now requires selecting the warehouse
  WAREHOUSE: ['warehouseCode', 'receiveType', 'customsEntryNumber', 'customsClearedDate', 'receivedDate'],
  // Stage 5: Shipped
  SHIPPED: ['shipToName', 'shipMode', 'shippingCarrier', 'trackingNumber', 'shippedDate'],
}

export const STAGE_DOCUMENT_REQUIREMENTS: Partial<Record<PurchaseOrderStatus, string[]>> = {
  MANUFACTURING: ['proforma_invoice'],
  OCEAN: ['commercial_invoice', 'bill_of_lading', 'packing_list'],
  WAREHOUSE: ['movement_note', 'custom_declaration'],
  SHIPPED: ['proof_of_pickup'],
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
  receiveType: 'Inbound Type',
  customsEntryNumber: 'Customs Entry Number',
  customsClearedDate: 'Customs Cleared Date',
  receivedDate: 'Received Date',
  // Stage 5
  shipToName: 'Ship To Name',
  shipMode: 'Outbound Mode',
  shippingCarrier: 'Shipping Carrier',
  trackingNumber: 'Tracking Number',
  shippedDate: 'Shipped Date',
  proofOfDeliveryRef: 'Proof of Delivery Reference',
}

function toDocumentStage(status: PurchaseOrderStatus): PurchaseOrderDocumentStage {
  switch (status) {
    case PurchaseOrderStatus.MANUFACTURING:
      return PurchaseOrderDocumentStage.MANUFACTURING
    case PurchaseOrderStatus.OCEAN:
      return PurchaseOrderDocumentStage.OCEAN
    case PurchaseOrderStatus.WAREHOUSE:
      return PurchaseOrderDocumentStage.WAREHOUSE
    case PurchaseOrderStatus.SHIPPED:
      return PurchaseOrderDocumentStage.SHIPPED
    default:
      throw new ValidationError(`Unsupported stage for document validation: ${status}`)
  }
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
  receiveType?: InboundReceiveType | string
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
  shipMode?: OutboundShipMode | string
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
export function getValidNextStages(currentStatus: PurchaseOrderStatus): PurchaseOrderStatus[] {
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

function resolveDateValue(
  value: Date | string | undefined | null,
  label: string
): Date | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && value.trim().length === 0) return null

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`Invalid ${label}`)
  }
  return date
}

function resolveOrderDate(
  key: keyof StageTransitionInput & keyof PurchaseOrder,
  stageData: StageTransitionInput,
  order: PurchaseOrder,
  label: string
): Date | null {
  if (Object.prototype.hasOwnProperty.call(stageData, key)) {
    return resolveDateValue(stageData[key] as Date | string | undefined | null, label)
  }
  return resolveDateValue(order[key] as unknown as Date | string | undefined | null, label)
}

function assertNotEarlierThan(
  earlierLabel: string,
  earlier: Date | null,
  laterLabel: string,
  later: Date | null
) {
  if (!earlier || !later) return
  if (later < earlier) {
    throw new ValidationError(`${laterLabel} cannot be earlier than ${earlierLabel}`)
  }
}

function pickBaseline(
  candidates: Array<{ label: string; date: Date | null }>
): { label: string; date: Date } | null {
  for (const candidate of candidates) {
    if (candidate.date) return { label: candidate.label, date: candidate.date }
  }
  return null
}

function validateStageDateOrdering(
  targetStatus: PurchaseOrderStatus,
  stageData: StageTransitionInput,
  order: PurchaseOrder
) {
  const manufacturingStartDate = resolveOrderDate(
    'manufacturingStartDate',
    stageData,
    order,
    'Manufacturing start date'
  )
  const expectedCompletionDate = resolveOrderDate(
    'expectedCompletionDate',
    stageData,
    order,
    'Expected completion date'
  )
  const actualCompletionDate = resolveOrderDate(
    'actualCompletionDate',
    stageData,
    order,
    'Actual completion date'
  )

  const manufacturingBaseline = pickBaseline([
    { label: 'Actual completion date', date: actualCompletionDate },
    { label: 'Expected completion date', date: expectedCompletionDate },
    { label: 'Manufacturing start date', date: manufacturingStartDate },
  ])

  const estimatedDeparture = resolveOrderDate(
    'estimatedDeparture',
    stageData,
    order,
    'Estimated departure'
  )
  const estimatedArrival = resolveOrderDate('estimatedArrival', stageData, order, 'Estimated arrival')
  const actualDeparture = resolveOrderDate('actualDeparture', stageData, order, 'Actual departure')
  const actualArrival = resolveOrderDate('actualArrival', stageData, order, 'Actual arrival')

  const inboundBaseline = pickBaseline([
    { label: 'Actual arrival', date: actualArrival },
    { label: 'Estimated arrival', date: estimatedArrival },
    { label: 'Actual departure', date: actualDeparture },
    { label: 'Estimated departure', date: estimatedDeparture },
    { label: manufacturingBaseline?.label ?? 'Manufacturing stage', date: manufacturingBaseline?.date ?? null },
  ])

  const customsClearedDate = resolveOrderDate(
    'customsClearedDate',
    stageData,
    order,
    'Customs cleared date'
  )
  const receivedDate = resolveOrderDate('receivedDate', stageData, order, 'Received date')
  const shippedDate = resolveOrderDate('shippedDate', stageData, order, 'Shipped date')
  const deliveredDate = resolveOrderDate('deliveredDate', stageData, order, 'Delivered date')

  if (targetStatus === PurchaseOrderStatus.MANUFACTURING) {
    assertNotEarlierThan('Manufacturing start date', manufacturingStartDate, 'Expected completion date', expectedCompletionDate)
    assertNotEarlierThan('Manufacturing start date', manufacturingStartDate, 'Actual completion date', actualCompletionDate)
    return
  }

  if (targetStatus === PurchaseOrderStatus.OCEAN) {
    if (manufacturingBaseline) {
      assertNotEarlierThan(manufacturingBaseline.label, manufacturingBaseline.date, 'Estimated departure', estimatedDeparture)
      assertNotEarlierThan(manufacturingBaseline.label, manufacturingBaseline.date, 'Actual departure', actualDeparture)
    }

    assertNotEarlierThan('Estimated departure', estimatedDeparture, 'Estimated arrival', estimatedArrival)
    assertNotEarlierThan('Actual departure', actualDeparture, 'Actual arrival', actualArrival)
    return
  }

  if (targetStatus === PurchaseOrderStatus.WAREHOUSE) {
    if (inboundBaseline) {
      assertNotEarlierThan(inboundBaseline.label, inboundBaseline.date, 'Customs cleared date', customsClearedDate)
      assertNotEarlierThan(inboundBaseline.label, inboundBaseline.date, 'Received date', receivedDate)
    }

    assertNotEarlierThan('Customs cleared date', customsClearedDate, 'Received date', receivedDate)
    return
  }

  if (targetStatus === PurchaseOrderStatus.SHIPPED) {
    assertNotEarlierThan('Received date', receivedDate, 'Shipped date', shippedDate)
    assertNotEarlierThan('Shipped date', shippedDate, 'Delivered date', deliveredDate)
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
  batchLot?: string
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
  const tenant = await getCurrentTenant()
  const prisma = await getTenantPrisma()
  let skuRecordsForLines: Array<{
    id: string
    skuCode: string
    packSize: number | null
    unitsPerCarton: number
    material: string | null
    unitDimensionsCm: string | null
    unitLengthCm: Prisma.Decimal | null
    unitWidthCm: Prisma.Decimal | null
    unitHeightCm: Prisma.Decimal | null
    unitWeightKg: Prisma.Decimal | null
    cartonDimensionsCm: string | null
    cartonLengthCm: Prisma.Decimal | null
    cartonWidthCm: Prisma.Decimal | null
    cartonHeightCm: Prisma.Decimal | null
    cartonWeightKg: Prisma.Decimal | null
    packagingType: string | null
  }> = []

  if (input.lines && input.lines.length > 0) {
    const DEFAULT_BATCH_LOT = 'DEFAULT'
    const normalizedLines = input.lines.map(line => ({
      ...line,
      skuCode: line.skuCode.trim(),
      batchLot: line.batchLot?.trim() ? line.batchLot.trim() : undefined,
    }))

    const keySet = new Set<string>()
    for (const line of normalizedLines) {
      if (!line.skuCode) {
        throw new ValidationError('SKU code is required for all line items')
      }

      const key = line.skuCode.toLowerCase()
      if (keySet.has(key)) {
        throw new ValidationError(
          `Duplicate SKU line detected: ${line.skuCode}. Combine quantities into a single line.`
        )
      }
      keySet.add(key)

      if (!line.batchLot) {
        line.batchLot = DEFAULT_BATCH_LOT
      }
    }

    const skuCodes = Array.from(new Set(normalizedLines.map(line => line.skuCode)))
    const skus = await prisma.sku.findMany({
      where: { skuCode: { in: skuCodes } },
      select: {
        id: true,
        skuCode: true,
        packSize: true,
        unitsPerCarton: true,
        material: true,
        unitDimensionsCm: true,
        unitLengthCm: true,
        unitWidthCm: true,
        unitHeightCm: true,
        unitWeightKg: true,
        cartonDimensionsCm: true,
        cartonLengthCm: true,
        cartonWidthCm: true,
        cartonHeightCm: true,
        cartonWeightKg: true,
        packagingType: true,
      },
    })
    const skuByCode = new Map(skus.map(sku => [sku.skuCode, sku]))

    for (const line of normalizedLines) {
      if (!skuByCode.has(line.skuCode)) {
        throw new ValidationError(`SKU ${line.skuCode} not found. Create the SKU first.`)
      }
    }

    input.lines = normalizedLines
    skuRecordsForLines = skus
  }

  const MAX_PO_NUMBER_ATTEMPTS = 5
  let order: (PurchaseOrder & { lines: any[] }) | null = null

  for (let attempt = 0; attempt < MAX_PO_NUMBER_ATTEMPTS; attempt += 1) {
    const poNumber = await generatePoNumber()
    const orderNumber = poNumber // Order number is just the PO number now
    const DEFAULT_BATCH_LOT = 'DEFAULT'

    try {
      order = await prisma.$transaction(async tx => {
        if (input.lines && input.lines.length > 0) {
          const uniqueSkuIds = Array.from(new Set(skuRecordsForLines.map(sku => sku.id)))
          const skuMap = new Map(skuRecordsForLines.map(sku => [sku.id, sku]))
          const skuByCode = new Map(skuRecordsForLines.map(sku => [sku.skuCode.toLowerCase(), sku]))

          for (const skuId of uniqueSkuIds) {
            const sku = skuMap.get(skuId)
            if (!sku) continue

            await tx.skuBatch.upsert({
              where: {
                skuId_batchCode: {
                  skuId,
                  batchCode: DEFAULT_BATCH_LOT,
                },
              },
              create: {
                skuId,
                batchCode: DEFAULT_BATCH_LOT,
                packSize: sku.packSize,
                unitsPerCarton: sku.unitsPerCarton,
                material: sku.material,
                unitDimensionsCm: sku.unitDimensionsCm,
                unitLengthCm: sku.unitLengthCm,
                unitWidthCm: sku.unitWidthCm,
                unitHeightCm: sku.unitHeightCm,
                unitWeightKg: sku.unitWeightKg,
                cartonDimensionsCm: sku.cartonDimensionsCm,
                cartonLengthCm: sku.cartonLengthCm,
                cartonWidthCm: sku.cartonWidthCm,
                cartonHeightCm: sku.cartonHeightCm,
                cartonWeightKg: sku.cartonWeightKg,
                packagingType: sku.packagingType,
                isActive: true,
              },
              update: {
                isActive: true,
              },
            })
          }

          const requiredCombos: Array<{ skuId: string; skuCode: string; batchCode: string }> = []
          const requiredKeySet = new Set<string>()
          for (const line of input.lines) {
            const batchCode = (line.batchLot ?? DEFAULT_BATCH_LOT).trim().toUpperCase()
            if (batchCode === DEFAULT_BATCH_LOT) continue

            const skuRecord = skuByCode.get(line.skuCode.trim().toLowerCase())
            if (!skuRecord) continue

            const key = `${skuRecord.id}::${batchCode}`
            if (requiredKeySet.has(key)) continue

            requiredKeySet.add(key)
            requiredCombos.push({
              skuId: skuRecord.id,
              skuCode: skuRecord.skuCode,
              batchCode,
            })
          }

          if (requiredCombos.length > 0) {
            const existing = await tx.skuBatch.findMany({
              where: {
                OR: requiredCombos.map(combo => ({
                  skuId: combo.skuId,
                  batchCode: combo.batchCode,
                })),
              },
              select: { skuId: true, batchCode: true },
            })

            const existingSet = new Set(existing.map(row => `${row.skuId}::${row.batchCode}`))
            for (const combo of requiredCombos) {
              if (!existingSet.has(`${combo.skuId}::${combo.batchCode}`)) {
                throw new ValidationError(
                  `Batch ${combo.batchCode} not found for SKU ${combo.skuCode}. Create it in Products → Batches first.`
                )
              }
            }
          }
        }

        return tx.purchaseOrder.create({
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
                    create: input.lines.map(line => ({
                      skuCode: line.skuCode,
                      skuDescription: line.skuDescription || '',
                      batchLot: (line.batchLot ?? DEFAULT_BATCH_LOT).trim().toUpperCase(),
                      quantity: line.quantity,
                      unitCost: line.unitCost,
                      currency: line.currency || tenant.currency,
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
    const canApprove = await canApproveStageTransition(user.id, currentStatus, targetStatus)

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

  validateStageDateOrdering(targetStatus, stageData, order)

  const requiredDocs = STAGE_DOCUMENT_REQUIREMENTS[targetStatus]
  if (requiredDocs && requiredDocs.length > 0) {
    const stageDocs = await prisma.purchaseOrderDocument.findMany({
      where: {
        purchaseOrderId: order.id,
        stage: toDocumentStage(targetStatus),
        documentType: { in: requiredDocs },
      },
      select: { documentType: true },
    })

    const present = new Set(stageDocs.map(doc => doc.documentType))
    const missing = requiredDocs.filter(docType => !present.has(docType))

    if (missing.length > 0) {
      throw new ValidationError(
        `Missing required documents for ${targetStatus}: ${missing.join(', ')}`
      )
    }
  }

  if (targetStatus === PurchaseOrderStatus.SHIPPED) {
    if (!order.lines || order.lines.length === 0) {
      throw new ValidationError('Cannot ship an order with no cargo lines')
    }

    for (const line of order.lines) {
      if (line.status === PurchaseOrderLineStatus.CANCELLED) continue
      if (!line.batchLot) {
        throw new ValidationError(`Batch/Lot is required for SKU ${line.skuCode}`)
      }
    }

    const pendingLines = order.lines.filter(
      line =>
        line.status !== PurchaseOrderLineStatus.POSTED &&
        line.status !== PurchaseOrderLineStatus.CANCELLED
    )

    if (pendingLines.length > 0) {
      throw new ValidationError(
        'Cannot ship before all cargo is received and posted. Post a movement note to record the receipt.'
      )
    }
  }

  if (targetStatus === PurchaseOrderStatus.WAREHOUSE) {
    if (!order.lines || order.lines.length === 0) {
      throw new ValidationError('Cannot receive an order with no cargo lines')
    }

    for (const line of order.lines) {
      if (!line.batchLot) {
        throw new ValidationError(`Batch/Lot is required for SKU ${line.skuCode}`)
      }
    }
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
  if (stageData.receiveType !== undefined) {
    updateData.receiveType = stageData.receiveType as InboundReceiveType
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
  if (stageData.shipMode !== undefined) {
    updateData.shipMode = stageData.shipMode as OutboundShipMode
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

  // Execute the transition atomically.
  const updatedOrder = await prisma.$transaction(async tx => {
    const nextOrder = await tx.purchaseOrder.update({
      where: { id: orderId },
      data: updateData,
      include: { lines: true },
    })

    const refreshed = await tx.purchaseOrder.findUnique({
      where: { id: nextOrder.id },
      include: { lines: true },
    })

    if (!refreshed) {
      throw new NotFoundError(`Purchase Order not found after transition: ${nextOrder.id}`)
    }

    return refreshed
  })

  // Audit log the transition
  await auditLog({
    userId: user.id,
    action: 'STATUS_TRANSITION',
    entityType: 'PurchaseOrder',
    entityId: orderId,
    data: { fromStatus: currentStatus, toStatus: targetStatus, approvedBy: user.name },
  })
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
export function serializePurchaseOrder(
  order: PurchaseOrder & { lines?: any[] },
  options?: { defaultCurrency?: string }
): Record<string, any> {
  const defaultCurrency = options?.defaultCurrency ?? 'USD'

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
    lines: order.lines?.map(line => ({
      id: line.id,
      skuCode: line.skuCode,
      skuDescription: line.skuDescription,
      batchLot: line.batchLot,
      quantity: line.quantity,
      unitCost: line.unitCost ? Number(line.unitCost) : null,
      currency: line.currency || defaultCurrency,
      status: line.status,
      postedQuantity: line.postedQuantity,
      quantityReceived: line.quantityReceived,
      lineNotes: line.lineNotes,
      createdAt: line.createdAt?.toISOString?.() ?? line.createdAt,
      updatedAt: line.updatedAt?.toISOString?.() ?? line.updatedAt,
    })),
  }
}
