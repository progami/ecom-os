import { createHash } from 'crypto'

import { prisma } from '@/lib/prisma'
import { NotFoundError, ConflictError, ValidationError } from '@/lib/api'
import {
  Prisma,
  PurchaseOrderLineStatus,
  PurchaseOrderStatus,
  PurchaseOrderType,
  TransactionType,
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

export async function postPurchaseOrder(id: string, user: UserContext): Promise<PurchaseOrderWithLines> {
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
        status: PurchaseOrderStatus.AWAITING_PROOF,
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

  if (order.status === PurchaseOrderStatus.POSTED && targetStatus !== PurchaseOrderStatus.POSTED) {
    throw new Error('Posted purchase orders cannot be reverted')
  }

  if (targetStatus === PurchaseOrderStatus.POSTED) {
    if (order.status !== PurchaseOrderStatus.REVIEW) {
      throw new Error('Only purchase orders in review can be posted')
    }

    return prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.POSTED,
        postedAt: new Date(),
      },
      include: { lines: true },
    })
  }

  const allowedTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
    [PurchaseOrderStatus.DRAFT]: [PurchaseOrderStatus.AWAITING_PROOF],
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
