import { getTenantPrisma } from '@/lib/tenant/server'
import { NotFoundError, ConflictError, ValidationError } from '@/lib/api'
import { Prisma, PurchaseOrderLineStatus, PurchaseOrderStatus } from '@ecom-os/prisma-wms'
import { auditLog } from '@/lib/security/audit-logger'
import { toPublicOrderNumber } from './purchase-order-utils'
import { recalculateStorageLedgerForTransactions } from './storage-ledger-sync'

export interface UserContext {
  id?: string | null
  name?: string | null
}

export type PurchaseOrderWithLines = Prisma.PurchaseOrderGetPayload<{
  include: { lines: true }
}>

const VISIBLE_STATUSES: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.DRAFT,
  PurchaseOrderStatus.MANUFACTURING,
  PurchaseOrderStatus.OCEAN,
  PurchaseOrderStatus.WAREHOUSE,
  PurchaseOrderStatus.SHIPPED,
  PurchaseOrderStatus.CANCELLED,
]

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
    where: {
      isLegacy: false,
      poNumber: { not: null },
      status: { in: VISIBLE_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
    include: { lines: true },
  })
}

export async function getPurchaseOrderById(id: string) {
  const prisma = await getTenantPrisma()

  return prisma.purchaseOrder.findFirst({
    where: {
      id,
      isLegacy: false,
      poNumber: { not: null },
      status: { in: VISIBLE_STATUSES },
    },
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

  if (
    order.status === PurchaseOrderStatus.CANCELLED ||
    order.status === PurchaseOrderStatus.CLOSED
  ) {
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

  const counterpartyName =
    input.counterpartyName !== undefined ? input.counterpartyName : order.counterpartyName
  const notes = input.notes !== undefined ? input.notes : order.notes

  return prisma.purchaseOrder.update({
    where: { id },
    data: {
      counterpartyName,
      expectedDate,
      notes,
    },
    include: { lines: true },
  })
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

  const result = await prisma.$transaction(async tx => {
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

    const voidedAt = new Date()
    const previousStatus = order.status
    const targetStatus =
      previousStatus === PurchaseOrderStatus.POSTED
        ? PurchaseOrderStatus.CLOSED
        : PurchaseOrderStatus.CANCELLED

    const lineNeedsCleanup = order.lines.some(line => {
      return (
        line.status !== PurchaseOrderLineStatus.CANCELLED ||
        line.postedQuantity > 0 ||
        (line.quantityReceived != null && line.quantityReceived > 0)
      )
    })

    const transactionCount = await tx.inventoryTransaction.count({
      where: { purchaseOrderId: order.id },
    })

    const hasLedgerEntries = transactionCount > 0

    if (order.status === PurchaseOrderStatus.CANCELLED && !lineNeedsCleanup && !hasLedgerEntries) {
      return {
        order,
        voidedFromStatus: order.status,
        voidedAt,
        storageRecalcInputs: [] as Parameters<typeof recalculateStorageLedgerForTransactions>[0],
      }
    }

    const storageRecalcInputs: Parameters<typeof recalculateStorageLedgerForTransactions>[0] = []

    if (previousStatus !== PurchaseOrderStatus.POSTED) {
      const affectedTransactions = await tx.inventoryTransaction.findMany({
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

      storageRecalcInputs.push(
        ...affectedTransactions.map(transaction => ({
          warehouseCode: transaction.warehouseCode,
          warehouseName: transaction.warehouseName,
          skuCode: transaction.skuCode,
          skuDescription: transaction.skuDescription,
          batchLot: transaction.batchLot,
          transactionDate: transaction.transactionDate,
        }))
      )

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
      storageRecalcInputs,
    }
  })

  await recalculateStorageLedgerForTransactions(result.storageRecalcInputs)

  return {
    order: result.order,
    voidedFromStatus: result.voidedFromStatus,
    voidedAt: result.voidedAt,
  }
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
    typeof data.voidedAt === 'string' ? data.voidedAt : log.createdAt?.toISOString?.() || null

  return {
    voidedFromStatus: previousStatus,
    voidedAt,
  }
}
