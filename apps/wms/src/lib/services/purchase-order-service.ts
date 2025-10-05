import { createHash } from 'crypto'

import { prisma } from '@/lib/prisma'
import { NotFoundError, ConflictError, ValidationError } from '@/lib/api'
import {
  Prisma,
  PurchaseOrderLineStatus,
  PurchaseOrderStatus,
  PurchaseOrderType,
  TransactionType,
  MovementNoteStatus,
} from '@prisma/client'

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
}

export interface EnsurePurchaseOrderResult {
  purchaseOrderId: string
  purchaseOrderLineId: string
  batchLot: string
}

export type PurchaseOrderWithLines = Prisma.PurchaseOrderGetPayload<{
  include: { lines: true }
}>

export interface PurchaseOrderLineCreateInput {
  skuCode: string
  quantity: number
  unitCost?: number | null
  batchLot?: string | null
}

export interface CreatePurchaseOrderInput {
  orderNumber: string
  warehouseCode: string
  type: PurchaseOrderType
  status?: PurchaseOrderStatus
  counterpartyName?: string | null
  expectedDate?: Date | null
  notes?: string | null
  lines: PurchaseOrderLineCreateInput[]
  postedAt?: Date | null
  createdById?: string | null
  createdByName?: string | null
}

export function serializePurchaseOrder(order: PurchaseOrderWithLines) {
  return {
    ...order,
    expectedDate: order.expectedDate?.toISOString() ?? null,
    postedAt: order.postedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    lines: order.lines.map(line => ({
      ...line,
      unitCost: line.unitCost ? Number(line.unitCost) : null,
      createdAt: line.createdAt.toISOString(),
      updatedAt: line.updatedAt.toISOString(),
    })),
  }
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrderWithLines> {
  if (input.lines.length === 0) {
    throw new ValidationError('At least one line item is required')
  }

  const warehouse = await prisma.warehouse.findUnique({
    where: { code: input.warehouseCode },
  })

  if (!warehouse) {
    throw new NotFoundError(`Warehouse not found for code ${input.warehouseCode}`)
  }

  const existing = await prisma.purchaseOrder.findUnique({
    where: {
      warehouseCode_orderNumber: {
        warehouseCode: warehouse.code,
        orderNumber: input.orderNumber,
      },
    },
  })

  if (existing) {
    throw new ConflictError(`Purchase order ${input.orderNumber} already exists for warehouse ${warehouse.code}`)
  }

  const skuCodes = Array.from(new Set(input.lines.map((line) => line.skuCode)))
  const skus = await prisma.sku.findMany({
    where: { skuCode: { in: skuCodes } },
  })
  const skuMap = new Map(skus.map((sku) => [sku.skuCode, sku]))

  const lineData = input.lines.map((line, index) => {
    const sku = skuMap.get(line.skuCode)
    if (!sku) {
      throw new ValidationError(`SKU ${line.skuCode} does not exist`)
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new ValidationError(`Quantity must be a positive integer for SKU ${line.skuCode}`)
    }

    const batchLot = line.batchLot?.trim().length ? line.batchLot.trim() : `LOT-${index + 1}`

    return {
      skuCode: sku.skuCode,
      skuDescription: sku.description ?? null,
      batchLot,
      quantity: line.quantity,
      unitCost: line.unitCost != null ? new Prisma.Decimal(line.unitCost) : null,
    }
  })

  const expectedDate = input.expectedDate ?? null
  const status = input.status ?? PurchaseOrderStatus.DRAFT
  const postedAt = status === PurchaseOrderStatus.CLOSED ? input.postedAt ?? new Date() : input.postedAt ?? null

  const order = await prisma.purchaseOrder.create({
    data: {
      orderNumber: input.orderNumber,
      type: input.type,
      status,
      warehouseCode: warehouse.code,
      warehouseName: warehouse.name,
      counterpartyName: input.counterpartyName ?? null,
      expectedDate,
      postedAt,
      notes: input.notes ?? null,
      createdById: input.createdById ?? null,
      createdByName: input.createdByName ?? null,
      lines: {
        create: lineData,
      },
    },
    include: { lines: true },
  })

  return order
}

export interface UpdatePurchaseOrderInput {
  expectedDate?: string | null
  counterpartyName?: string | null
  notes?: string | null
}

const SYSTEM_FALLBACK_ID = 'system'
const SYSTEM_FALLBACK_NAME = 'System'

function normalizeNullable(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

function normalizeOrderNumber(value?: string | null): string {
  const provided = normalizeNullable(value)
  if (provided) return provided

  throw new ValidationError('A purchase order number or reference is required to link transactions')
}

function generateBatchHash(seedParts: string[]): string {
  const hash = createHash('sha256')
  for (const part of seedParts) {
    hash.update(part)
    hash.update('::')
  }

  const hexDigest = hash.digest('hex')
  const numericValue = BigInt('0x' + hexDigest) % (10n ** 12n)
  return numericValue.toString().padStart(12, '0')
}

export function resolveBatchLot(params: {
  rawBatchLot?: string | null
  orderNumber: string
  warehouseCode: string
  skuCode: string
  transactionDate: Date
}): string {
  const normalized = normalizeNullable(params.rawBatchLot)
  if (normalized) {
    return normalized
  }

  const fallback = generateBatchHash([
    params.orderNumber,
    params.warehouseCode,
    params.skuCode
  ])

  return fallback
}

function mapTransactionToOrderType(type: TransactionType): PurchaseOrderType {
  switch (type) {
    case 'RECEIVE':
    case 'ADJUST_IN':
      return PurchaseOrderType.PURCHASE
    case 'SHIP':
    case 'ADJUST_OUT':
      return PurchaseOrderType.FULFILLMENT
    default:
      return PurchaseOrderType.ADJUSTMENT
  }
}

export async function getPurchaseOrders() {
  return prisma.purchaseOrder.findMany({
    orderBy: { createdAt: 'desc' },
    include: { lines: true },
  })
}

export async function getPurchaseOrderById(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  })
}

export async function updatePurchaseOrderDetails(
  id: string,
  input: UpdatePurchaseOrderInput
): Promise<PurchaseOrderWithLines> {
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
  const signedQuantity = isOutbound ? -absoluteQuantity : absoluteQuantity

  const orderKey = {
    warehouseCode_orderNumber: {
      warehouseCode: input.warehouseCode,
      orderNumber,
    },
  }

  const existingOrder = await client.purchaseOrder.findUnique({ where: orderKey })

  if (existingOrder && existingOrder.status === PurchaseOrderStatus.CANCELLED) {
    throw new ConflictError('Transactions cannot be linked to a cancelled purchase order')
  }

  if (existingOrder && existingOrder.status === PurchaseOrderStatus.CLOSED) {
    throw new ConflictError('Transactions cannot be linked to a closed purchase order')
  }

  let order = existingOrder

  if (!order) {
    order = await client.purchaseOrder.create({
      data: {
        orderNumber,
        type: orderType,
        status: PurchaseOrderStatus.SHIPPED,
        warehouseCode: input.warehouseCode,
        warehouseName: input.warehouseName,
        counterpartyName: counterparty ?? null,
        expectedDate: defaultExpectedDate,
        notes: notes ?? null,
        createdById: normalizeNullable(input.createdById) ?? undefined,
        createdByName: normalizeNullable(input.createdByName) ?? undefined,
      },
    })
  } else {
    const updateData: Prisma.PurchaseOrderUpdateInput = {}

    const existingOrderType = order.type

    if (existingOrderType !== orderType && existingOrderType !== PurchaseOrderType.PURCHASE) {
      updateData.type = orderType
    }

    if (order.warehouseName !== input.warehouseName) {
      updateData.warehouseName = input.warehouseName
    }

    if (hasCounterpartyUpdate && counterparty !== order.counterpartyName) {
      updateData.counterpartyName = counterparty ?? null
    }

    if (hasExpectedDateUpdate) {
      const normalizedExpectedDate = providedExpectedDate ?? null
      const existingExpectedDate = order.expectedDate ?? null

      const hasChanged =
        (normalizedExpectedDate === null && existingExpectedDate !== null) ||
        (normalizedExpectedDate !== null &&
          (existingExpectedDate === null || existingExpectedDate.getTime() !== normalizedExpectedDate.getTime()))

      if (hasChanged) {
        updateData.expectedDate = normalizedExpectedDate
      }
    } else if (!order.expectedDate && defaultExpectedDate) {
      updateData.expectedDate = defaultExpectedDate
    }

    if (hasNotesUpdate && notes !== order.notes) {
      updateData.notes = notes ?? null
    }

    if (Object.keys(updateData).length > 0) {
      order = await client.purchaseOrder.update({
        where: orderKey,
        data: updateData,
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
        postedQuantity: signedQuantity,
        status: Math.abs(signedQuantity) >= absoluteQuantity
          ? PurchaseOrderLineStatus.POSTED
          : PurchaseOrderLineStatus.PENDING,
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

  const nextPostedQuantity = existingLine.postedQuantity + signedQuantity
  const lineStatus = Math.abs(nextPostedQuantity) >= nextQuantity
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

export async function transitionPurchaseOrderStatus(
  id: string,
  targetStatus: PurchaseOrderStatus,
  user: { id?: string | null; role?: string | null } = {},
): Promise<PurchaseOrderWithLines> {
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

  const allowedTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
    [PurchaseOrderStatus.DRAFT]: [PurchaseOrderStatus.SHIPPED],
    [PurchaseOrderStatus.SHIPPED]: [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.WAREHOUSE],
    [PurchaseOrderStatus.WAREHOUSE]: [PurchaseOrderStatus.SHIPPED, PurchaseOrderStatus.CLOSED],
    [PurchaseOrderStatus.CLOSED]: [],
    [PurchaseOrderStatus.CANCELLED]: [],
  }

  const nextStatuses = allowedTransitions[order.status] ?? []
  if (!nextStatuses.includes(targetStatus)) {
    throw new Error(`Cannot change purchase order status from ${order.status} to ${targetStatus}`)
  }

  if (targetStatus === PurchaseOrderStatus.WAREHOUSE && user.role !== 'admin') {
    throw new Error('Only administrators can approve delivery notes')
  }

  if (targetStatus === PurchaseOrderStatus.WAREHOUSE) {
    const postedNote = await prisma.movementNote.findFirst({
      where: {
        purchaseOrderId: id,
        status: MovementNoteStatus.POSTED,
      },
    })

    if (!postedNote) {
      throw new Error('A posted delivery note is required before approving the warehouse stage')
    }
  }

  if (targetStatus === PurchaseOrderStatus.CLOSED && order.status !== PurchaseOrderStatus.WAREHOUSE) {
    throw new Error('Orders must reach the warehouse stage before closing')
  }

  if (targetStatus === PurchaseOrderStatus.CLOSED) {
    return prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.CLOSED,
        postedAt: new Date(),
      },
      include: { lines: true },
    })
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
  return prisma.$transaction(tx => ensurePurchaseOrderForTransaction(tx, input))
}

export async function voidPurchaseOrder(id: string): Promise<PurchaseOrderWithLines> {
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
      return order
    }

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

    return tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        status: PurchaseOrderStatus.CANCELLED,
        postedAt: null,
      },
      include: { lines: true },
    })
  })
}
