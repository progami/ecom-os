import { getTenantPrisma } from '@/lib/tenant/server'
import { NotFoundError, ConflictError, ValidationError } from '@/lib/api'
import {
  Prisma,
  InboundReceiveType,
  OutboundShipMode,
  PurchaseOrder,
  PurchaseOrderLineStatus,
  PurchaseOrderStatus,
  PurchaseOrderType,
  TransactionType,
  MovementNoteStatus,
} from '@ecom-os/prisma-wms'
import { auditLog } from '@/lib/security/audit-logger'
import { buildTacticalCostLedgerEntries } from '@/lib/costing/tactical-costing'
import { recordStorageCostEntry } from '@/services/storageCost.service'
import {
  getRequiredDocuments,
  getDocumentLabel,
  type DocumentCategory,
} from '@/lib/config/po-document-requirements'
import {
  toPublicOrderNumber,
  normalizeNullable,
  normalizeOrderNumber,
  resolveBatchLot,
  mapTransactionToOrderType,
  SYSTEM_FALLBACK_ID,
  SYSTEM_FALLBACK_NAME,
  ORDER_NUMBER_SEPARATOR,
} from './purchase-order-utils'

export { toPublicOrderNumber, resolveBatchLot } from './purchase-order-utils'

export interface UserContext {
 id?: string | null
 name?: string | null
}

export interface EnsurePurchaseOrderForTransactionInput {
  orderNumber?: string | null
  transactionType: TransactionType
  warehouseCode: string
  warehouseName: string
  counterpartyName?: string | null
  receiveType?: InboundReceiveType | null
  shipMode?: OutboundShipMode | null
  transactionDate: Date
  expectedDate?: Date | null
  skuCode: string
  skuDescription?: string | null
  batchLot?: string | null
  quantity: number
  unitsPerCarton: number
  createdById?: string | null
  createdByName?: string | null
  notes?: string | null
  purchaseOrderId?: string | null
}

export interface EnsurePurchaseOrderResult {
  purchaseOrderId: string
  purchaseOrderLineId: string
  batchLot: string
}

export type PurchaseOrderWithLines = Prisma.PurchaseOrderGetPayload<{
 include: { lines: true }
}>

export function serializePurchaseOrder(
 order: PurchaseOrderWithLines,
 metadata?: {
 voidedFromStatus?: PurchaseOrderStatus | null
 voidedAt?: Date | string | null
 }
) {
  return {
    ...order,
    expectedDate: order.expectedDate?.toISOString() ?? null,
    postedAt: order.postedAt?.toISOString() ?? null,
    voidedFromStatus: metadata?.voidedFromStatus ?? null,
    voidedAt: metadata?.voidedAt
      ? typeof metadata.voidedAt === 'string'
        ? metadata.voidedAt
        : metadata.voidedAt.toISOString()
      : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    orderNumber: toPublicOrderNumber(order.orderNumber),
    lines: order.lines.map(line => ({
      ...line,
      unitCost: line.unitCost ? Number(line.unitCost) : null,
 createdAt: line.createdAt.toISOString(),
 updatedAt: line.updatedAt.toISOString(),
 })),
 }
}

export interface UpdatePurchaseOrderInput {
  expectedDate?: string | null
  counterpartyName?: string | null
  notes?: string | null
}

export async function getPurchaseOrders() {
 const prisma = await getTenantPrisma()
 return prisma.purchaseOrder.findMany({
 orderBy: { createdAt: 'desc' },
 include: { lines: true },
 })
}

export async function getPurchaseOrderById(id: string) {
 const prisma = await getTenantPrisma()
 return prisma.purchaseOrder.findUnique({
 where: { id },
 include: { lines: true },
 })
}

export async function updatePurchaseOrderDetails(
 id: string,
 input: UpdatePurchaseOrderInput
): Promise<PurchaseOrderWithLines> {
 const prisma = await getTenantPrisma()
 const order = await prisma.purchaseOrder.findUnique({
 where: { id },
 })

 if (!order) {
 throw new NotFoundError('Purchase order not found')
 }

 if (order.status === PurchaseOrderStatus.CANCELLED || order.status === PurchaseOrderStatus.CLOSED) {
 throw new ConflictError('Closed or cancelled purchase orders cannot be edited')
 }

 let expectedDate: Date | null | undefined = order.expectedDate
 if (input.expectedDate !== undefined) {
 if (input.expectedDate === null || input.expectedDate === '') {
 expectedDate = null
 } else {
 const parsed = new Date(input.expectedDate)
 if (Number.isNaN(parsed.getTime())) {
 throw new ValidationError('Invalid expected date value')
 }
 expectedDate = parsed
 }
 }

 const counterpartyName = input.counterpartyName !== undefined ? input.counterpartyName : order.counterpartyName
 const notes = input.notes !== undefined ? input.notes : order.notes

 const updated = await prisma.purchaseOrder.update({
 where: { id },
 data: {
 counterpartyName,
 expectedDate,
 notes,
 },
 include: { lines: true },
 })

 return updated
}

export async function postPurchaseOrder(id: string, user: UserContext): Promise<PurchaseOrderWithLines> {
 const prisma = await getTenantPrisma()
 return prisma.$transaction(async (tx) => {
 const order = await tx.purchaseOrder.findUnique({
 where: { id },
 include: { lines: true },
 })

 if (!order) {
 throw new Error('Purchase order not found')
 }

 if (order.status !== PurchaseOrderStatus.DRAFT) {
 throw new Error('Only draft purchase orders can be posted')
 }

 const postedAt = new Date()
 const isInbound = order.type === PurchaseOrderType.PURCHASE
 const transactionType = isInbound ? TransactionType.RECEIVE : TransactionType.SHIP

 const warehouse = await tx.warehouse.findFirst({ where: { code: order.warehouseCode } })

 for (const line of order.lines) {
 if (line.quantity === 0) continue

 const sku = await tx.sku.findFirst({ where: { skuCode: line.skuCode } })
 const unitsPerCarton = sku?.unitsPerCarton ?? 1

 const normalizedBatchLot = resolveBatchLot({
 rawBatchLot: line.batchLot,
 orderNumber: order.orderNumber,
 warehouseCode: order.warehouseCode,
 skuCode: line.skuCode,
 transactionDate: postedAt,
 })

 await tx.inventoryTransaction.create({
 data: {
 warehouseCode: order.warehouseCode,
 warehouseName: order.warehouseName,
 warehouseAddress: warehouse?.address ?? null,
 skuCode: line.skuCode,
 skuDescription: line.skuDescription ?? (sku?.description ?? ''),
 unitDimensionsCm: sku?.unitDimensionsCm ?? null,
 unitWeightKg: sku?.unitWeightKg ?? null,
 cartonDimensionsCm: sku?.cartonDimensionsCm ?? null,
 cartonWeightKg: sku?.cartonWeightKg ?? null,
 packagingType: sku?.packagingType ?? null,
 unitsPerCarton,
 batchLot: normalizedBatchLot,
 transactionType,
 referenceId: order.orderNumber,
 cartonsIn: isInbound ? line.quantity : 0,
 cartonsOut: isInbound ? 0 : line.quantity,
 storagePalletsIn: isInbound ? 0 : 0,
 shippingPalletsOut: isInbound ? 0 : 0,
 transactionDate: postedAt,
 pickupDate: postedAt,
 isReconciled: false,
 isDemo: false,
 createdById: normalizeNullable(user.id) ?? SYSTEM_FALLBACK_ID,
 createdByName: normalizeNullable(user.name) ?? SYSTEM_FALLBACK_NAME,
 shippingCartonsPerPallet: null,
 storageCartonsPerPallet: null,
 shipName: isInbound ? null : order.counterpartyName ?? null,
 trackingNumber: null,
 attachments: null,
 supplier: isInbound ? order.counterpartyName ?? null : null,
 purchaseOrderId: order.id,
 purchaseOrderLineId: line.id,
 },
 })

 await tx.purchaseOrderLine.update({
 where: { id: line.id },
 data: {
 status: PurchaseOrderLineStatus.POSTED,
 postedQuantity: line.quantity,
 },
 })
 }

 return tx.purchaseOrder.update({
 where: { id: order.id },
 data: {
 status: PurchaseOrderStatus.POSTED,
 postedAt,
 },
 include: { lines: true },
 })
 })
}

export async function ensurePurchaseOrderForTransaction(
  client: Prisma.TransactionClient,
  input: EnsurePurchaseOrderForTransactionInput
): Promise<EnsurePurchaseOrderResult> {
  const orderType = mapTransactionToOrderType(input.transactionType)
  const orderNumber = normalizeOrderNumber(input.orderNumber)
  const transactionDate = input.transactionDate
 const hasExpectedDateUpdate = Object.prototype.hasOwnProperty.call(input, 'expectedDate')
 const providedExpectedDate = hasExpectedDateUpdate ? input.expectedDate ?? null : undefined
 const defaultExpectedDate = providedExpectedDate ?? transactionDate
 const hasCounterpartyUpdate = Object.prototype.hasOwnProperty.call(input, 'counterpartyName')
 const counterparty = hasCounterpartyUpdate ? normalizeNullable(input.counterpartyName) : undefined
 const hasNotesUpdate = Object.prototype.hasOwnProperty.call(input, 'notes')
 const notes = hasNotesUpdate ? normalizeNullable(input.notes) : undefined
 const skuDescription = normalizeNullable(input.skuDescription)
 const batchLot = resolveBatchLot({
 rawBatchLot: input.batchLot,
 orderNumber,
 warehouseCode: input.warehouseCode,
 skuCode: input.skuCode,
 transactionDate
 })
 const absoluteQuantity = Math.abs(input.quantity)
 const isOutbound = input.transactionType === 'SHIP' || input.transactionType === 'ADJUST_OUT'

 let order: PurchaseOrder | null = null
 if (input.purchaseOrderId) {
   order = await client.purchaseOrder.findUnique({
     where: { id: input.purchaseOrderId },
   })
   if (order && (order.status === PurchaseOrderStatus.CANCELLED || order.status === PurchaseOrderStatus.CLOSED)) {
     throw new ConflictError('Transactions cannot be linked to a closed or cancelled purchase order')
   }
  }

 if (!order) {
  order = await client.purchaseOrder.findFirst({
   where: {
    warehouseCode: input.warehouseCode,
    OR: [
     { orderNumber },
     { orderNumber: { startsWith: `${orderNumber}${ORDER_NUMBER_SEPARATOR}` } },
    ],
    },
   orderBy: { createdAt: 'asc' },
  })

  if (order && (order.status === PurchaseOrderStatus.CANCELLED || order.status === PurchaseOrderStatus.CLOSED)) {
   throw new ConflictError('Transactions cannot be linked to a closed or cancelled purchase order')
  }
 }

 if (order && order.type !== orderType) {
  throw new ConflictError('Order type does not match existing order configuration')
 }

 if (!order) {
  order = await createPurchaseOrderRecord(client, {
   orderNumber,
   orderType,
   warehouseCode: input.warehouseCode,
   warehouseName: input.warehouseName,
   counterparty,
   receiveType: input.receiveType ?? null,
   shipMode: input.shipMode ?? null,
   expectedDate: defaultExpectedDate,
   notes,
   createdById: normalizeNullable(input.createdById),
   createdByName: normalizeNullable(input.createdByName),
  })
 }

 if (order.type !== orderType) {
  throw new ConflictError('Order type does not match existing order configuration')
 }

  if (input.receiveType) {
    if (order.receiveType && order.receiveType !== input.receiveType) {
      throw new ConflictError('Inbound type does not match existing order configuration')
    }
    if (!order.receiveType) {
      order = await client.purchaseOrder.update({
        where: { id: order.id },
        data: { receiveType: input.receiveType },
      })
    }
  }

  if (input.shipMode) {
    if (order.shipMode && order.shipMode !== input.shipMode) {
      throw new ConflictError('Outbound mode does not match existing order configuration')
    }
    if (!order.shipMode) {
      order = await client.purchaseOrder.update({
        where: { id: order.id },
        data: { shipMode: input.shipMode },
      })
    }
  }

 const lineKey = {
 purchaseOrderId_skuCode_batchLot: {
 purchaseOrderId: order.id,
 skuCode: input.skuCode,
 batchLot,
 },
 }

 const existingLine = await client.purchaseOrderLine.findUnique({ where: lineKey })

 if (!existingLine) {
 const line = await client.purchaseOrderLine.create({
 data: {
 purchaseOrderId: order.id,
 skuCode: input.skuCode,
 skuDescription,
 batchLot,
 quantity: absoluteQuantity,
 postedQuantity: absoluteQuantity,
 status: PurchaseOrderLineStatus.POSTED,
 },
 })

 return {
 purchaseOrderId: order.id,
 purchaseOrderLineId: line.id,
 batchLot,
 }
 }

 const existingOrderType = order.type

 let nextQuantity = existingLine.quantity

 if (isOutbound) {
 if (existingOrderType === PurchaseOrderType.PURCHASE) {
 nextQuantity = Math.max(0, existingLine.quantity - absoluteQuantity)
 } else {
 nextQuantity = Math.max(existingLine.quantity, absoluteQuantity)
 }
 } else {
 nextQuantity = Math.max(existingLine.quantity, absoluteQuantity)
 }

 const nextPostedQuantity = Math.abs(existingLine.postedQuantity) + absoluteQuantity
 const lineStatus = nextPostedQuantity >= nextQuantity
 ? PurchaseOrderLineStatus.POSTED
 : PurchaseOrderLineStatus.PENDING

 const updatedLine = await client.purchaseOrderLine.update({
 where: lineKey,
 data: {
 skuDescription: skuDescription ?? existingLine.skuDescription ?? null,
 batchLot,
 quantity: nextQuantity,
 postedQuantity: nextPostedQuantity,
 status: lineStatus,
 },
 })

 return {
 purchaseOrderId: order.id,
 purchaseOrderLineId: updatedLine.id,
 batchLot,
 }
}

export interface DocumentValidationResult {
  valid: boolean
  requiredDocuments: DocumentCategory[]
  uploadedDocuments: DocumentCategory[]
  missingDocuments: DocumentCategory[]
}

export async function validateDocumentsForTransition(
  orderId: string,
  fromStatus: PurchaseOrderStatus,
  toStatus: PurchaseOrderStatus
): Promise<DocumentValidationResult> {
  const prisma = await getTenantPrisma()
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    select: { type: true },
  })

  if (!order) {
    return {
      valid: true,
      requiredDocuments: [],
      uploadedDocuments: [],
      missingDocuments: [],
    }
  }

  const requiredDocuments = getRequiredDocuments(order.type, fromStatus, toStatus)

  if (requiredDocuments.length === 0) {
    return {
      valid: true,
      requiredDocuments: [],
      uploadedDocuments: [],
      missingDocuments: [],
    }
  }

  // Fetch movement notes with their attachments
  const movementNotes = await prisma.movementNote.findMany({
    where: { purchaseOrderId: orderId },
    select: {
      attachments: true,
      lines: {
        select: { attachments: true },
      },
    },
  })

  // Collect all uploaded document categories
  const uploadedSet = new Set<DocumentCategory>()

  // Check if there's at least one movement note (for 'movement_note' requirement)
  if (movementNotes.length > 0) {
    uploadedSet.add('movement_note')
  }

  // Extract document categories from movement note attachments
  for (const note of movementNotes) {
    if (note.attachments && typeof note.attachments === 'object' && !Array.isArray(note.attachments)) {
      for (const category of Object.keys(note.attachments)) {
        const value = (note.attachments as Record<string, unknown>)[category]
        if (value && (typeof value === 'object' || Array.isArray(value))) {
          uploadedSet.add(category as DocumentCategory)
        }
      }
    }

    // Also check line-level attachments
    for (const line of note.lines) {
      if (line.attachments && typeof line.attachments === 'object' && !Array.isArray(line.attachments)) {
        for (const category of Object.keys(line.attachments)) {
          const value = (line.attachments as Record<string, unknown>)[category]
          if (value && (typeof value === 'object' || Array.isArray(value))) {
            uploadedSet.add(category as DocumentCategory)
          }
        }
      }
    }
  }

  const uploadedDocuments = requiredDocuments.filter(doc => uploadedSet.has(doc))
  const missingDocuments = requiredDocuments.filter(doc => !uploadedSet.has(doc))

  return {
    valid: missingDocuments.length === 0,
    requiredDocuments,
    uploadedDocuments,
    missingDocuments,
  }
}

export async function transitionPurchaseOrderStatus(
 id: string,
 targetStatus: PurchaseOrderStatus,
): Promise<PurchaseOrderWithLines> {
  const prisma = await getTenantPrisma()
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  })

 if (!order) {
 throw new Error('Purchase order not found')
 }

 if (order.status === PurchaseOrderStatus.CANCELLED || order.status === PurchaseOrderStatus.CLOSED) {
 throw new Error('Closed or cancelled purchase orders cannot be updated')
 }

 if (order.status === targetStatus) {
 return order
 }

 if (order.status === PurchaseOrderStatus.POSTED && targetStatus !== PurchaseOrderStatus.POSTED) {
 throw new Error('Posted purchase orders cannot be reverted')
 }

 if (targetStatus === PurchaseOrderStatus.POSTED) {
    if (order.status !== PurchaseOrderStatus.REVIEW) {
      throw new Error('Only purchase orders in review can be posted')
    }

    const { postedOrder, createdTransactions } = await prisma.$transaction(async (tx) => {
      const freshOrder = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { lines: true },
      })

      if (!freshOrder) throw new Error('Purchase order not found')

      const warehouse = await tx.warehouse.findFirst({
        where: { code: freshOrder.warehouseCode },
        select: { id: true },
      })

      if (!warehouse) {
        throw new NotFoundError('Warehouse not found for purchase order')
      }

      const movementNotes = await tx.movementNote.findMany({
        where: { purchaseOrderId: id, status: MovementNoteStatus.POSTED },
        include: { lines: true },
      })

      if (movementNotes.length === 0) {
        throw new ConflictError('Cannot post without posted movement notes')
      }

      const allLinesPosted = freshOrder.lines.every(line => line.status === PurchaseOrderLineStatus.POSTED)
      if (!allLinesPosted) {
        throw new ConflictError('All purchase order lines must be posted before finalizing')
      }

      await tx.inventoryTransaction.deleteMany({ where: { purchaseOrderId: id } })

      const transactionType = (() => {
        switch (freshOrder.type) {
          case PurchaseOrderType.PURCHASE:
            return TransactionType.RECEIVE
          case PurchaseOrderType.FULFILLMENT:
            return TransactionType.SHIP
          default:
            return TransactionType.ADJUST_IN
        }
      })()

      const isInbound = transactionType === TransactionType.RECEIVE || transactionType === TransactionType.ADJUST_IN

      const created: Array<{
        id: string
        warehouseCode: string
        warehouseName: string
        skuCode: string
        skuDescription: string
        batchLot: string
        cartonsIn: number
        cartonsOut: number
        storagePalletsIn: number
        shippingPalletsOut: number
        cartonDimensionsCm: string | null
        transactionDate: Date
      }> = []

      let costingDate: Date | null = null

      for (const note of movementNotes) {
        const transactionDate = note.receivedAt ?? new Date()
        if (!costingDate || transactionDate < costingDate) {
          costingDate = transactionDate
        }
        for (const line of note.lines) {
          const poLine = freshOrder.lines.find(l => l.id === line.purchaseOrderLineId)
          if (!poLine) {
            throw new ConflictError('Purchase order line missing for movement note line')
          }

          const sku = await tx.sku.findFirst({ where: { skuCode: poLine.skuCode } })
          const unitsPerCarton = sku?.unitsPerCarton ?? 1
          const batchLot = resolveBatchLot({
            rawBatchLot: line.batchLot ?? poLine.batchLot,
            orderNumber: freshOrder.orderNumber,
            warehouseCode: freshOrder.warehouseCode,
            skuCode: poLine.skuCode,
            transactionDate,
          })

          const createdTx = await tx.inventoryTransaction.create({
            data: {
              warehouseCode: freshOrder.warehouseCode,
              warehouseName: freshOrder.warehouseName,
              warehouseAddress: null,
              skuCode: poLine.skuCode,
              skuDescription: poLine.skuDescription ?? sku?.description ?? '',
              unitDimensionsCm: sku?.unitDimensionsCm ?? null,
              unitWeightKg: sku?.unitWeightKg ?? null,
              cartonDimensionsCm: sku?.cartonDimensionsCm ?? null,
              cartonWeightKg: sku?.cartonWeightKg ?? null,
              packagingType: sku?.packagingType ?? null,
              unitsPerCarton,
              batchLot,
              transactionType,
              referenceId: note.referenceNumber ?? toPublicOrderNumber(freshOrder.orderNumber),
              cartonsIn: isInbound ? line.quantity : 0,
              cartonsOut: isInbound ? 0 : line.quantity,
              storagePalletsIn: isInbound
                ? Math.ceil(line.quantity / Math.max(1, line.storageCartonsPerPallet ?? unitsPerCarton))
                : 0,
              shippingPalletsOut: !isInbound
                ? Math.ceil(line.quantity / Math.max(1, line.shippingCartonsPerPallet ?? unitsPerCarton))
                : 0,
              storageCartonsPerPallet: line.storageCartonsPerPallet ?? null,
              shippingCartonsPerPallet: line.shippingCartonsPerPallet ?? null,
              transactionDate,
              pickupDate: transactionDate,
              shipName: !isInbound ? note.referenceNumber ?? freshOrder.counterpartyName ?? null : null,
              trackingNumber: null,
              supplier: isInbound ? freshOrder.counterpartyName ?? null : null,
              attachments: line.attachments as Prisma.JsonValue ?? null,
              purchaseOrderId: freshOrder.id,
              purchaseOrderLineId: poLine.id,
              createdById: SYSTEM_FALLBACK_ID,
              createdByName: SYSTEM_FALLBACK_NAME,
              isReconciled: false,
              isDemo: false,
            },
            select: {
              id: true,
              warehouseCode: true,
              warehouseName: true,
              skuCode: true,
              skuDescription: true,
              batchLot: true,
              cartonsIn: true,
              cartonsOut: true,
              storagePalletsIn: true,
              shippingPalletsOut: true,
              cartonDimensionsCm: true,
              transactionDate: true,
            },
          })

          created.push({
            ...createdTx,
            cartonsIn: Number(createdTx.cartonsIn || 0),
            cartonsOut: Number(createdTx.cartonsOut || 0),
            storagePalletsIn: Number(createdTx.storagePalletsIn || 0),
            shippingPalletsOut: Number(createdTx.shippingPalletsOut || 0),
          })
        }
      }

      if (transactionType === TransactionType.RECEIVE || transactionType === TransactionType.SHIP) {
        const effectiveAt = costingDate ?? new Date()
        const rates = await tx.costRate.findMany({
          where: {
            warehouseId: warehouse.id,
            isActive: true,
            effectiveDate: { lte: effectiveAt },
            OR: [{ endDate: null }, { endDate: { gte: effectiveAt } }],
          },
          orderBy: [{ costName: 'asc' }, { effectiveDate: 'desc' }],
        })

        const ratesByCostName = new Map<string, { costName: string; costValue: number; unitOfMeasure: string }>()
        for (const rate of rates) {
          if (!ratesByCostName.has(rate.costName)) {
            ratesByCostName.set(rate.costName, {
              costName: rate.costName,
              costValue: Number(rate.costValue),
              unitOfMeasure: rate.unitOfMeasure,
            })
          }
        }

        let ledgerEntries: Prisma.CostLedgerCreateManyInput[] = []
        try {
          ledgerEntries = buildTacticalCostLedgerEntries({
            transactionType,
            receiveType: transactionType === TransactionType.RECEIVE ? freshOrder.receiveType : null,
            shipMode: transactionType === TransactionType.SHIP ? freshOrder.shipMode : null,
            ratesByCostName,
            lines: created.map((t) => ({
              transactionId: t.id,
              skuCode: t.skuCode,
              cartons: transactionType === TransactionType.RECEIVE ? t.cartonsIn : t.cartonsOut,
              pallets: transactionType === TransactionType.SHIP ? t.shippingPalletsOut : t.storagePalletsIn,
              cartonDimensionsCm: t.cartonDimensionsCm,
            })),
            warehouseCode: freshOrder.warehouseCode,
            warehouseName: freshOrder.warehouseName,
            createdAt: effectiveAt,
            createdByName: SYSTEM_FALLBACK_NAME,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Cost calculation failed'
          throw new ValidationError(message)
        }

        if (ledgerEntries.length > 0) {
          await tx.costLedger.createMany({ data: ledgerEntries })
        }
      }

      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: PurchaseOrderStatus.POSTED,
          postedAt: new Date(),
        },
        include: { lines: true },
      })

      return { postedOrder: updatedOrder, createdTransactions: created }
    })

    await Promise.all(
      createdTransactions.map((t) =>
        recordStorageCostEntry({
          warehouseCode: t.warehouseCode,
          warehouseName: t.warehouseName,
          skuCode: t.skuCode,
          skuDescription: t.skuDescription,
          batchLot: t.batchLot,
          transactionDate: t.transactionDate,
        }).catch((storageError) => {
          const message = storageError instanceof Error ? storageError.message : 'Unknown error'
          console.error(`Storage cost recording failed for ${t.warehouseCode}/${t.skuCode}/${t.batchLot}:`, message)
        })
      )
    )

    return postedOrder
 }

 const allowedTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
   // New 5-stage workflow (handled by po-stage-service.ts)
   [PurchaseOrderStatus.DRAFT]: [PurchaseOrderStatus.AWAITING_PROOF],
   [PurchaseOrderStatus.MANUFACTURING]: [],
   [PurchaseOrderStatus.OCEAN]: [],
   [PurchaseOrderStatus.WAREHOUSE]: [],
   [PurchaseOrderStatus.SHIPPED]: [],
   [PurchaseOrderStatus.ARCHIVED]: [],
   // Legacy workflow statuses
   [PurchaseOrderStatus.AWAITING_PROOF]: [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.REVIEW],
   [PurchaseOrderStatus.REVIEW]: [PurchaseOrderStatus.AWAITING_PROOF],
   [PurchaseOrderStatus.POSTED]: [],
   [PurchaseOrderStatus.CLOSED]: [],
   [PurchaseOrderStatus.CANCELLED]: [],
 }

 const nextStatuses = allowedTransitions[order.status] ?? []
 if (!nextStatuses.includes(targetStatus)) {
 throw new Error(`Cannot change purchase order status from ${order.status} to ${targetStatus}`)
 }

 // Validate required documents for AWAITING_PROOF → REVIEW transition
 if (order.status === PurchaseOrderStatus.AWAITING_PROOF && targetStatus === PurchaseOrderStatus.REVIEW) {
   const validation = await validateDocumentsForTransition(id, order.status, targetStatus)
   if (!validation.valid) {
     const missingLabels = validation.missingDocuments.map(doc => getDocumentLabel(doc)).join(', ')
     throw new ValidationError(`Missing required documents: ${missingLabels}`)
   }
 }

 return prisma.purchaseOrder.update({
 where: { id },
 data: {
 status: targetStatus,
 postedAt: targetStatus === PurchaseOrderStatus.DRAFT ? null : order.postedAt,
 },
 include: { lines: true },
 })
}

export async function ensurePurchaseOrderForTransactionStandalone(
 input: EnsurePurchaseOrderForTransactionInput
): Promise<EnsurePurchaseOrderResult> {
 const prisma = await getTenantPrisma()
 return prisma.$transaction(tx => ensurePurchaseOrderForTransaction(tx, input))
}

async function createPurchaseOrderRecord(
 client: Prisma.TransactionClient,
 params: {
   orderNumber: string
   orderType: PurchaseOrderType
   warehouseCode: string
   warehouseName: string
   counterparty: string | null
   receiveType: InboundReceiveType | null
   shipMode: OutboundShipMode | null
   expectedDate: Date | null
   notes: string | null
   createdById?: string | null
   createdByName?: string | null
 }
): Promise<PurchaseOrder> {
 try {
  return await client.purchaseOrder.create({
   data: {
    orderNumber: params.orderNumber,
    type: params.orderType,
    status: PurchaseOrderStatus.DRAFT,
    warehouseCode: params.warehouseCode,
    warehouseName: params.warehouseName,
    counterpartyName: params.counterparty,
    expectedDate: params.expectedDate ?? undefined,
    notes: params.notes,
    receiveType: params.receiveType ?? undefined,
    shipMode: params.shipMode ?? undefined,
    createdById: params.createdById ?? undefined,
    createdByName: params.createdByName ?? undefined,
   },
  })
 } catch (error) {
  if (
   error instanceof Prisma.PrismaClientKnownRequestError &&
   error.code === 'P2002'
  ) {
   const existing = await client.purchaseOrder.findFirst({
    where: {
     warehouseCode: params.warehouseCode,
     orderNumber: params.orderNumber,
    },
   })
   if (existing) {
    return existing
   }
  }
  throw error
 }
}

export async function voidPurchaseOrder(
  id: string,
  user?: UserContext
): Promise<{
  order: PurchaseOrderWithLines
  voidedFromStatus: PurchaseOrderStatus
  voidedAt: Date
}> {
  const prisma = await getTenantPrisma()
  return prisma.$transaction(async tx => {
    const order = await tx.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    })

    if (!order) {
      throw new Error('Purchase order not found')
    }

    if (order.status === PurchaseOrderStatus.CLOSED) {
      throw new Error('Closed purchase orders cannot be voided')
    }

    if (order.status === PurchaseOrderStatus.CANCELLED) {
      return {
        order,
        voidedFromStatus: order.status,
        voidedAt: new Date(),
      }
    }

    const previousStatus = order.status
    const targetStatus =
      previousStatus === PurchaseOrderStatus.POSTED
        ? PurchaseOrderStatus.CLOSED
        : PurchaseOrderStatus.CANCELLED

    const voidedAt = new Date()

    if (previousStatus !== PurchaseOrderStatus.POSTED) {
      await tx.inventoryTransaction.deleteMany({
        where: { purchaseOrderId: order.id },
      })

      await tx.purchaseOrderLine.updateMany({
        where: { purchaseOrderId: order.id },
        data: {
          status: PurchaseOrderLineStatus.CANCELLED,
          postedQuantity: 0,
        },
      })
    }

    const updated = await tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        status: targetStatus,
        postedAt: targetStatus === PurchaseOrderStatus.CLOSED ? order.postedAt : null,
      },
      include: { lines: true },
    })

    await auditLog({
      entityType: 'PurchaseOrder',
      entityId: order.id,
      action: 'VOID',
      userId: user?.id || 'SYSTEM',
      data: {
        previousStatus,
        targetStatus,
        voidedAt: voidedAt.toISOString(),
        voidedBy: user?.name || null,
      },
    })

    return {
      order: updated,
      voidedFromStatus: previousStatus,
      voidedAt,
    }
  })
}

export async function getPurchaseOrderVoidMetadata(id: string): Promise<{
  voidedFromStatus: PurchaseOrderStatus | null
  voidedAt: string | null
} | null> {
  const prisma = await getTenantPrisma()
  const log = await prisma.auditLog.findFirst({
    where: {
      entity: 'PurchaseOrder',
      entityId: id,
      action: 'VOID',
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!log) return null

  const data = (log.newValue ?? {}) as Record<string, unknown>
  const previousStatus = (data.previousStatus as PurchaseOrderStatus | undefined) ?? null
  const voidedAt =
    typeof data.voidedAt === 'string'
      ? data.voidedAt
      : log.createdAt?.toISOString?.() || null

  return {
    voidedFromStatus: previousStatus,
    voidedAt,
  }
}
