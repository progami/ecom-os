import { getTenantPrisma, getCurrentTenant } from '@/lib/tenant/server'
import {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  PurchaseOrderLineStatus,
  PurchaseOrderDocumentStage,
  TransactionType,
  InboundReceiveType,
  Prisma,
} from '@ecom-os/prisma-wms'
import { NotFoundError, ValidationError, ConflictError } from '@/lib/api'
import { canApproveStageTransition, hasPermission, isSuperAdmin } from './permission-service'
import { auditLog } from '@/lib/security/audit-logger'
import { toPublicOrderNumber } from './purchase-order-utils'
import { recalculateStorageLedgerForTransactions } from './storage-ledger-sync'
import { buildTacticalCostLedgerEntries } from '@/lib/costing/tactical-costing'
import { calculatePalletValues } from '@/lib/utils/pallet-calculations'
import { recordStorageCostEntry } from '@/services/storageCost.service'

type PurchaseOrderWithLines = PurchaseOrder & { lines: PurchaseOrderLine[] }
type PurchaseOrderWithOptionalLines = PurchaseOrder & { lines?: PurchaseOrderLine[] }

type ManufacturingStageData = {
  proformaInvoiceNumber: PurchaseOrder['proformaInvoiceNumber']
  proformaInvoiceDate: PurchaseOrder['proformaInvoiceDate']
  factoryName: PurchaseOrder['factoryName']
  manufacturingStartDate: PurchaseOrder['manufacturingStartDate']
  expectedCompletionDate: PurchaseOrder['expectedCompletionDate']
  actualCompletionDate: PurchaseOrder['actualCompletionDate']
  totalWeightKg: number | null
  totalVolumeCbm: number | null
  totalCartons: PurchaseOrder['totalCartons']
  totalPallets: PurchaseOrder['totalPallets']
  packagingNotes: PurchaseOrder['packagingNotes']
  proformaInvoiceId: PurchaseOrder['proformaInvoiceId']
  proformaInvoiceData: PurchaseOrder['proformaInvoiceData']
  manufacturingStart: PurchaseOrder['manufacturingStart']
  manufacturingEnd: PurchaseOrder['manufacturingEnd']
  cargoDetails: PurchaseOrder['cargoDetails']
}

type OceanStageData = {
  houseBillOfLading: PurchaseOrder['houseBillOfLading']
  masterBillOfLading: PurchaseOrder['masterBillOfLading']
  commercialInvoiceNumber: PurchaseOrder['commercialInvoiceNumber']
  packingListRef: PurchaseOrder['packingListRef']
  vesselName: PurchaseOrder['vesselName']
  voyageNumber: PurchaseOrder['voyageNumber']
  portOfLoading: PurchaseOrder['portOfLoading']
  portOfDischarge: PurchaseOrder['portOfDischarge']
  estimatedDeparture: PurchaseOrder['estimatedDeparture']
  estimatedArrival: PurchaseOrder['estimatedArrival']
  actualDeparture: PurchaseOrder['actualDeparture']
  actualArrival: PurchaseOrder['actualArrival']
  commercialInvoiceId: PurchaseOrder['commercialInvoiceId']
}

type WarehouseStageData = {
  warehouseCode: PurchaseOrder['warehouseCode']
  warehouseName: PurchaseOrder['warehouseName']
  customsEntryNumber: PurchaseOrder['customsEntryNumber']
  customsClearedDate: PurchaseOrder['customsClearedDate']
  dutyAmount: number | null
  dutyCurrency: PurchaseOrder['dutyCurrency']
  surrenderBlDate: PurchaseOrder['surrenderBlDate']
  transactionCertNumber: PurchaseOrder['transactionCertNumber']
  receivedDate: PurchaseOrder['receivedDate']
  discrepancyNotes: PurchaseOrder['discrepancyNotes']
  warehouseInvoiceId: PurchaseOrder['warehouseInvoiceId']
  surrenderBL: PurchaseOrder['surrenderBL']
  transactionCertificate: PurchaseOrder['transactionCertificate']
  customsDeclaration: PurchaseOrder['customsDeclaration']
}

type ShippedStageData = {
  shipToName: PurchaseOrder['shipToName']
  shipToAddress: PurchaseOrder['shipToAddress']
  shipToCity: PurchaseOrder['shipToCity']
  shipToCountry: PurchaseOrder['shipToCountry']
  shipToPostalCode: PurchaseOrder['shipToPostalCode']
  shippingCarrier: PurchaseOrder['shippingCarrier']
  shippingMethod: PurchaseOrder['shippingMethod']
  trackingNumber: PurchaseOrder['trackingNumber']
  shippedDate: PurchaseOrder['shippedDate']
  proofOfDeliveryRef: PurchaseOrder['proofOfDeliveryRef']
  deliveredDate: PurchaseOrder['deliveredDate']
  proofOfDelivery: PurchaseOrder['proofOfDelivery']
  shippedAt: PurchaseOrder['shippedAt']
  shippedBy: PurchaseOrder['shippedByName']
}

type StageData = {
  manufacturing: ManufacturingStageData
  ocean: OceanStageData
  warehouse: WarehouseStageData
  shipped: ShippedStageData
}

type SerializedStageSection<T> = {
  [K in keyof T]: T[K] extends Date | null | undefined ? string | null : T[K]
}

type SerializedStageData = {
  [K in keyof StageData]: SerializedStageSection<StageData[K]>
}

function normalizeAuditValue(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const numeric = Number(value as never)
    if (Number.isFinite(numeric)) return numeric
  }
  return value
}

// Valid stage transitions for new 5-stage workflow
export const VALID_TRANSITIONS: Partial<Record<PurchaseOrderStatus, PurchaseOrderStatus[]>> = {
  DRAFT: [PurchaseOrderStatus.ISSUED, PurchaseOrderStatus.CANCELLED],
  ISSUED: [
    PurchaseOrderStatus.MANUFACTURING,
    PurchaseOrderStatus.REJECTED,
    PurchaseOrderStatus.DRAFT,
    PurchaseOrderStatus.CANCELLED,
  ],
  MANUFACTURING: [PurchaseOrderStatus.OCEAN, PurchaseOrderStatus.CANCELLED],
  OCEAN: [PurchaseOrderStatus.WAREHOUSE, PurchaseOrderStatus.CANCELLED],
  WAREHOUSE: [PurchaseOrderStatus.CANCELLED],
  SHIPPED: [], // Terminal state
  REJECTED: [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.CANCELLED], // Terminal unless reopened
  CANCELLED: [], // Terminal state
}

// Stage-specific required fields for transition
export const STAGE_REQUIREMENTS: Record<string, string[]> = {
  ISSUED: ['expectedDate', 'incoterms', 'paymentTerms'],
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
  WAREHOUSE: [
    'warehouseCode',
    'receiveType',
    'customsEntryNumber',
    'customsClearedDate',
    'receivedDate',
  ],
}

export const STAGE_DOCUMENT_REQUIREMENTS: Partial<Record<PurchaseOrderStatus, string[]>> = {
  MANUFACTURING: ['proforma_invoice'],
  OCEAN: ['commercial_invoice', 'bill_of_lading', 'packing_list'],
  WAREHOUSE: ['movement_note', 'custom_declaration'],
}

// Field labels for error messages
const FIELD_LABELS: Record<string, string> = {
  expectedDate: 'Cargo Ready Date',
  incoterms: 'Incoterms',
  paymentTerms: 'Payment Terms',
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

function resolveDateValue(value: Date | string | undefined | null, label: string): Date | null {
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
  const estimatedArrival = resolveOrderDate(
    'estimatedArrival',
    stageData,
    order,
    'Estimated arrival'
  )
  const actualDeparture = resolveOrderDate('actualDeparture', stageData, order, 'Actual departure')
  const actualArrival = resolveOrderDate('actualArrival', stageData, order, 'Actual arrival')

  const inboundBaseline = pickBaseline([
    { label: 'Actual arrival', date: actualArrival },
    { label: 'Estimated arrival', date: estimatedArrival },
    { label: 'Actual departure', date: actualDeparture },
    { label: 'Estimated departure', date: estimatedDeparture },
    {
      label: manufacturingBaseline?.label ?? 'Manufacturing stage',
      date: manufacturingBaseline?.date ?? null,
    },
  ])

  const customsClearedDate = resolveOrderDate(
    'customsClearedDate',
    stageData,
    order,
    'Customs cleared date'
  )
  const receivedDate = resolveOrderDate('receivedDate', stageData, order, 'Received date')

  if (targetStatus === PurchaseOrderStatus.MANUFACTURING) {
    assertNotEarlierThan(
      'Manufacturing start date',
      manufacturingStartDate,
      'Expected completion date',
      expectedCompletionDate
    )
    assertNotEarlierThan(
      'Manufacturing start date',
      manufacturingStartDate,
      'Actual completion date',
      actualCompletionDate
    )
    return
  }

  if (targetStatus === PurchaseOrderStatus.OCEAN) {
    if (manufacturingBaseline) {
      assertNotEarlierThan(
        manufacturingBaseline.label,
        manufacturingBaseline.date,
        'Estimated departure',
        estimatedDeparture
      )
      assertNotEarlierThan(
        manufacturingBaseline.label,
        manufacturingBaseline.date,
        'Actual departure',
        actualDeparture
      )
    }

    assertNotEarlierThan(
      'Estimated departure',
      estimatedDeparture,
      'Estimated arrival',
      estimatedArrival
    )
    assertNotEarlierThan('Actual departure', actualDeparture, 'Actual arrival', actualArrival)
    return
  }

  if (targetStatus === PurchaseOrderStatus.WAREHOUSE) {
    if (inboundBaseline) {
      assertNotEarlierThan(
        inboundBaseline.label,
        inboundBaseline.date,
        'Customs cleared date',
        customsClearedDate
      )
      assertNotEarlierThan(
        inboundBaseline.label,
        inboundBaseline.date,
        'Received date',
        receivedDate
      )
    }

    assertNotEarlierThan('Customs cleared date', customsClearedDate, 'Received date', receivedDate)
    return
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
  batchLot: string
  quantity: number
  storageCartonsPerPallet?: number
  shippingCartonsPerPallet?: number
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
    expectedDate?: Date | string | null
    incoterms?: string | null
    paymentTerms?: string | null
    notes?: string
    lines?: CreatePurchaseOrderLineInput[]
  },
  user: UserContext
): Promise<PurchaseOrderWithLines> {
  const tenant = await getCurrentTenant()
  const prisma = await getTenantPrisma()
  let skuRecordsForLines: Array<{ id: string; skuCode: string }> = []

  if (input.lines && input.lines.length > 0) {
    const normalizedLines = input.lines.map(line => ({
      ...line,
      skuCode: line.skuCode.trim(),
      batchLot: line.batchLot?.trim() ? line.batchLot.trim().toUpperCase() : undefined,
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

      if (!line.batchLot || line.batchLot === 'DEFAULT') {
        throw new ValidationError(`Batch / lot is required for SKU ${line.skuCode}`)
      }
    }

    const skuCodes = Array.from(new Set(normalizedLines.map(line => line.skuCode)))
    const skus = await prisma.sku.findMany({
      where: { skuCode: { in: skuCodes } },
      select: {
        id: true,
        skuCode: true,
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
  let order: PurchaseOrderWithLines | null = null

  for (let attempt = 0; attempt < MAX_PO_NUMBER_ATTEMPTS; attempt += 1) {
    const poNumber = await generatePoNumber()
    const orderNumber = poNumber // Order number is just the PO number now
    const expectedDate = resolveDateValue(input.expectedDate, 'Cargo Ready Date')
    const incoterms =
      typeof input.incoterms === 'string' && input.incoterms.trim().length > 0
        ? input.incoterms.trim().toUpperCase()
        : null
    const paymentTerms =
      typeof input.paymentTerms === 'string' && input.paymentTerms.trim().length > 0
        ? input.paymentTerms.trim()
        : null

    try {
      order = await prisma.$transaction(async tx => {
        if (input.lines && input.lines.length > 0) {
          const skuByCode = new Map(skuRecordsForLines.map(sku => [sku.skuCode.toLowerCase(), sku]))

          const requiredCombos: Array<{ skuId: string; skuCode: string; batchCode: string }> = []
          const requiredKeySet = new Set<string>()
          for (const line of input.lines) {
            const skuRecord = skuByCode.get(line.skuCode.trim().toLowerCase())
            if (!skuRecord) continue

            const batchCode = line.batchLot?.trim().toUpperCase() ?? ''
            if (!batchCode || batchCode === 'DEFAULT') {
              throw new ValidationError(`Batch / lot is required for SKU ${skuRecord.skuCode}`)
            }

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
                  batchCode: { equals: combo.batchCode, mode: 'insensitive' },
                })),
              },
              select: { id: true, skuId: true, batchCode: true },
            })

            const existingMap = new Map(
              existing.map(row => [`${row.skuId}::${row.batchCode.toUpperCase()}`, row])
            )
            for (const combo of requiredCombos) {
              if (!existingMap.has(`${combo.skuId}::${combo.batchCode}`)) {
                throw new ValidationError(
                  `Batch ${combo.batchCode} not found for SKU ${combo.skuCode}. Create it in Products → Batches first.`
                )
              }
            }

            for (const line of input.lines) {
              const skuRecord = skuByCode.get(line.skuCode.trim().toLowerCase())
              if (!skuRecord) continue

              const batchCode = line.batchLot?.trim().toUpperCase() ?? ''
              if (!batchCode || batchCode === 'DEFAULT') continue

              const key = `${skuRecord.id}::${batchCode}`
              const batch = existingMap.get(key)
              if (!batch) continue

              const batchUpdate: Prisma.SkuBatchUpdateInput = {}
              if (line.storageCartonsPerPallet !== undefined) {
                batchUpdate.storageCartonsPerPallet = line.storageCartonsPerPallet
              }
              if (line.shippingCartonsPerPallet !== undefined) {
                batchUpdate.shippingCartonsPerPallet = line.shippingCartonsPerPallet
              }

              if (Object.keys(batchUpdate).length === 0) continue

              await tx.skuBatch.update({
                where: { id: batch.id },
                data: batchUpdate,
              })
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
            expectedDate,
            incoterms,
            paymentTerms,
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
                      batchLot: line.batchLot.trim().toUpperCase(),
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

  if (targetStatus === PurchaseOrderStatus.SHIPPED) {
    throw new ValidationError(
      'Purchase orders no longer ship inventory. Create a fulfillment order to ship stock.'
    )
  }

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
      oldValue: { status: currentStatus },
      newValue: {
        status: targetStatus,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        approvedBy: user.name,
      },
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
    case PurchaseOrderStatus.ISSUED:
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
  }

  const storageCostInputs: Array<{
    warehouseCode: string
    warehouseName: string
    skuCode: string
    skuDescription: string
    batchLot: string
    transactionDate: Date
  }> = []

  // Execute the transition + inventory impacts atomically.
  const updatedOrder = await prisma.$transaction(async tx => {
    const nextOrder = await tx.purchaseOrder.update({
      where: { id: orderId },
      data: updateData,
      include: { lines: true },
    })

    if (targetStatus === PurchaseOrderStatus.WAREHOUSE) {
      if (!nextOrder.warehouseCode || !nextOrder.warehouseName) {
        throw new ValidationError('Warehouse is required before receiving inventory')
      }

      if (!nextOrder.receiveType) {
        throw new ValidationError('Inbound type is required before receiving inventory')
      }

      const receivedAt = nextOrder.receivedDate ? new Date(nextOrder.receivedDate) : now

      const warehouse = await tx.warehouse.findFirst({
        where: { code: nextOrder.warehouseCode },
        select: { id: true, code: true, name: true, address: true },
      })

      if (!warehouse) {
        throw new ValidationError(`Invalid warehouse code: ${nextOrder.warehouseCode}`)
      }

      const activeLines = nextOrder.lines.filter(
        line => line.status !== PurchaseOrderLineStatus.CANCELLED
      )
      if (activeLines.length === 0) {
        throw new ValidationError('Cannot receive an order with no active cargo lines')
      }

      const skuCodes = activeLines.map(line => line.skuCode)
      const skus = await tx.sku.findMany({
        where: { skuCode: { in: skuCodes } },
        select: {
          id: true,
          skuCode: true,
          description: true,
          unitsPerCarton: true,
          unitDimensionsCm: true,
          unitWeightKg: true,
          cartonDimensionsCm: true,
          cartonWeightKg: true,
          packagingType: true,
        },
      })
      const skuMap = new Map(skus.map(sku => [sku.skuCode, sku]))

      for (const line of activeLines) {
        if (!skuMap.has(line.skuCode)) {
          throw new ValidationError(`SKU ${line.skuCode} not found. Create the SKU first.`)
        }
      }

      const batchCodes = Array.from(new Set(activeLines.map(line => String(line.batchLot))))
      const batchRecords = await tx.skuBatch.findMany({
        where: {
          skuId: { in: skus.map(sku => sku.id) },
          batchCode: { in: batchCodes },
        },
        select: {
          skuId: true,
          batchCode: true,
          unitsPerCarton: true,
          unitDimensionsCm: true,
          unitWeightKg: true,
          cartonDimensionsCm: true,
          cartonWeightKg: true,
          packagingType: true,
          storageCartonsPerPallet: true,
          shippingCartonsPerPallet: true,
        },
      })
      const batchMap = new Map(
        batchRecords.map(batch => [`${batch.skuId}::${batch.batchCode}`, batch])
      )

      const createdTransactions: Array<{
        id: string
        skuCode: string
        cartons: number
        pallets: number
        cartonDimensionsCm: string | null
        warehouseCode: string
        warehouseName: string
        skuDescription: string
        batchLot: string
        transactionDate: Date
      }> = []

      let totalStoragePalletsIn = 0
      const referenceId =
        nextOrder.commercialInvoiceNumber ??
        nextOrder.proformaInvoiceNumber ??
        toPublicOrderNumber(nextOrder.orderNumber)

      for (const line of activeLines) {
        const sku = skuMap.get(line.skuCode)
        if (!sku) continue

        const batchLot = String(line.batchLot)
        const batch = batchMap.get(`${sku.id}::${batchLot}`)
        if (!batch) {
          throw new ValidationError(
            `Batch/Lot ${batchLot} is not configured for SKU ${line.skuCode}. Create it in Config → Products → Batches.`
          )
        }

        const storageCartonsPerPallet = batch.storageCartonsPerPallet ?? null
        const shippingCartonsPerPallet = batch.shippingCartonsPerPallet ?? null

        if (!storageCartonsPerPallet || storageCartonsPerPallet <= 0) {
          throw new ValidationError(
            `Storage cartons per pallet is required for SKU ${line.skuCode} batch ${batchLot}. Configure it on the batch in Config → Products → Batches.`
          )
        }

        if (!shippingCartonsPerPallet || shippingCartonsPerPallet <= 0) {
          throw new ValidationError(
            `Shipping cartons per pallet is required for SKU ${line.skuCode} batch ${batchLot}. Configure it on the batch in Config → Products → Batches.`
          )
        }

        const cartons = line.quantity
        if (!Number.isInteger(cartons) || cartons <= 0) {
          throw new ValidationError(`Invalid cartons quantity for SKU ${line.skuCode}`)
        }

        const unitsPerCarton = batch.unitsPerCarton ?? sku.unitsPerCarton ?? 1

        const { storagePalletsIn } = calculatePalletValues({
          transactionType: 'RECEIVE',
          cartons,
          storageCartonsPerPallet,
        })

        if (storagePalletsIn <= 0) {
          throw new ValidationError(`Storage pallet count is required for inbound transactions`)
        }

        const txRow = await tx.inventoryTransaction.create({
          data: {
            warehouseCode: warehouse.code,
            warehouseName: warehouse.name,
            warehouseAddress: warehouse.address,
            skuCode: sku.skuCode,
            skuDescription: line.skuDescription ?? sku.description,
            unitDimensionsCm: batch.unitDimensionsCm ?? sku.unitDimensionsCm,
            unitWeightKg: batch.unitWeightKg ?? sku.unitWeightKg,
            cartonDimensionsCm: batch.cartonDimensionsCm ?? sku.cartonDimensionsCm,
            cartonWeightKg: batch.cartonWeightKg ?? sku.cartonWeightKg,
            packagingType: batch.packagingType ?? sku.packagingType,
            unitsPerCarton,
            batchLot,
            transactionType: TransactionType.RECEIVE,
            referenceId,
            cartonsIn: cartons,
            cartonsOut: 0,
            storagePalletsIn,
            shippingPalletsOut: 0,
            storageCartonsPerPallet,
            shippingCartonsPerPallet,
            shipName: null,
            trackingNumber: null,
            supplier: nextOrder.counterpartyName ?? null,
            attachments: null,
            transactionDate: receivedAt,
            pickupDate: receivedAt,
            createdById: user.id,
            createdByName: user.name,
            purchaseOrderId: nextOrder.id,
            purchaseOrderLineId: line.id,
            isReconciled: false,
            isDemo: false,
          },
          select: {
            id: true,
            skuCode: true,
            cartonDimensionsCm: true,
            storagePalletsIn: true,
            warehouseCode: true,
            warehouseName: true,
            skuDescription: true,
            batchLot: true,
            transactionDate: true,
          },
        })

        totalStoragePalletsIn += Number(txRow.storagePalletsIn || 0)

        createdTransactions.push({
          id: txRow.id,
          skuCode: txRow.skuCode,
          cartons,
          pallets: Number(txRow.storagePalletsIn || 0),
          cartonDimensionsCm: txRow.cartonDimensionsCm,
          warehouseCode: txRow.warehouseCode,
          warehouseName: txRow.warehouseName,
          skuDescription: txRow.skuDescription,
          batchLot: txRow.batchLot,
          transactionDate: txRow.transactionDate,
        })

        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: {
            postedQuantity: cartons,
            quantityReceived: cartons,
            status:
              cartons >= line.quantity
                ? PurchaseOrderLineStatus.POSTED
                : PurchaseOrderLineStatus.PENDING,
          },
        })
      }

      if (createdTransactions.length === 0) {
        throw new ValidationError('No inventory transactions were created for this receipt')
      }

      if (totalStoragePalletsIn <= 0) {
        throw new ValidationError('Storage pallet count is required for inbound transactions')
      }

      const rates = await tx.costRate.findMany({
        where: {
          warehouseId: warehouse.id,
          isActive: true,
          effectiveDate: { lte: receivedAt },
          OR: [{ endDate: null }, { endDate: { gte: receivedAt } }],
        },
        orderBy: [{ costName: 'asc' }, { effectiveDate: 'desc' }],
      })

      const ratesByCostName = new Map<
        string,
        { costName: string; costValue: number; unitOfMeasure: string }
      >()
      for (const rate of rates) {
        if (!ratesByCostName.has(rate.costName)) {
          ratesByCostName.set(rate.costName, {
            costName: rate.costName,
            costValue: Number(rate.costValue),
            unitOfMeasure: rate.unitOfMeasure,
          })
        }
      }

      const costLedgerEntries = buildTacticalCostLedgerEntries({
        transactionType: 'RECEIVE',
        receiveType: nextOrder.receiveType,
        shipMode: null,
        ratesByCostName,
        lines: createdTransactions.map(row => ({
          transactionId: row.id,
          skuCode: row.skuCode,
          cartons: row.cartons,
          pallets: row.pallets,
          cartonDimensionsCm: row.cartonDimensionsCm,
        })),
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        createdAt: receivedAt,
        createdByName: user.name,
      })

      if (costLedgerEntries.length > 0) {
        await tx.costLedger.createMany({ data: costLedgerEntries })
      }

      await tx.purchaseOrder.update({
        where: { id: nextOrder.id },
        data: {
          postedAt: nextOrder.postedAt ?? receivedAt,
        },
      })

      storageCostInputs.push(
        ...createdTransactions.map(row => ({
          warehouseCode: row.warehouseCode,
          warehouseName: row.warehouseName,
          skuCode: row.skuCode,
          skuDescription: row.skuDescription,
          batchLot: row.batchLot,
          transactionDate: row.transactionDate,
        }))
      )
    }

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
  const auditOldValue: Record<string, unknown> = { status: currentStatus }
  const auditNewValue: Record<string, unknown> = {
    status: targetStatus,
    fromStatus: currentStatus,
    toStatus: targetStatus,
    approvedBy: user.name,
  }

  for (const key of Object.keys(stageData ?? {})) {
    if (key === 'targetStatus') continue
    const before = normalizeAuditValue((order as Record<string, unknown>)[key])
    const after = normalizeAuditValue((updatedOrder as Record<string, unknown>)[key])
    if (before === after) continue
    auditOldValue[key] = before
    auditNewValue[key] = after
  }

  await auditLog({
    userId: user.id,
    action: 'STATUS_TRANSITION',
    entityType: 'PurchaseOrder',
    entityId: orderId,
    oldValue: auditOldValue,
    newValue: auditNewValue,
  })

  await Promise.all(
    storageCostInputs.map(input =>
      recordStorageCostEntry(input).catch(storageError => {
        const message = storageError instanceof Error ? storageError.message : 'Unknown error'
        console.error(
          `Storage cost recording failed for ${input.warehouseCode}/${input.skuCode}/${input.batchLot}:`,
          message
        )
      })
    )
  )

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
      stage: 'DRAFT → ISSUED',
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
export function getStageData(order: PurchaseOrder): StageData {
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
function serializeStageData(data: StageData): SerializedStageData {
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
  order: PurchaseOrderWithOptionalLines,
  options?: { defaultCurrency?: string }
): Record<string, unknown> {
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
    incoterms: order.incoterms,
    paymentTerms: order.paymentTerms,
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
