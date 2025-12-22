import { getTenantPrisma } from '@/lib/tenant/server'
import {
  Prisma,
  MovementNoteStatus,
  PurchaseOrderLineStatus,
  PurchaseOrderStatus,
} from '@ecom-os/prisma-wms'
import { ValidationError, ConflictError, NotFoundError } from '@/lib/api'
import { toPublicOrderNumber } from '@/lib/services/purchase-order-service'

export interface UserContext {
 id?: string | null
 name?: string | null
}

export interface MovementNoteLineInput {
 purchaseOrderLineId: string
 quantity: number
 batchLot?: string | null
 storageCartonsPerPallet?: number | null
 shippingCartonsPerPallet?: number | null
 attachments?: Record<string, unknown> | null
}

export interface CreateMovementNoteInput {
 purchaseOrderId: string
 referenceNumber?: string | null
 receivedAt?: Date | null
 notes?: string | null
 lines: MovementNoteLineInput[]
}

export async function listMovementNotes(filter?: { purchaseOrderId?: string | null }) {
 const prisma = await getTenantPrisma()
 const notes = await prisma.movementNote.findMany({
 where: filter?.purchaseOrderId ? { purchaseOrderId: filter.purchaseOrderId } : undefined,
 orderBy: { createdAt: 'desc' },
 include: {
 lines: true,
 purchaseOrder: {
 select: {
 id: true,
 orderNumber: true,
 type: true,
 status: true,
 warehouseCode: true,
 warehouseName: true,
 },
 },
 },
 })

 return notes.map((note) => formatNoteOrderNumber(note))
}

export async function getMovementNoteById(id: string) {
 const prisma = await getTenantPrisma()
 const note = await prisma.movementNote.findUnique({
 where: { id },
 include: {
 lines: true,
 purchaseOrder: {
 select: {
 id: true,
 orderNumber: true,
 type: true,
 status: true,
 warehouseCode: true,
 warehouseName: true,
 },
 },
 },
 })

 if (!note) {
 throw new NotFoundError('Delivery note not found')
 }

 return formatNoteOrderNumber(note)
}

export async function createMovementNote(input: CreateMovementNoteInput, user: UserContext) {
 if (input.lines.length === 0) {
 throw new ValidationError('At least one line is required')
 }

 const prisma = await getTenantPrisma()
 return prisma.$transaction(async tx => {
 const purchaseOrder = await tx.purchaseOrder.findUnique({
 where: { id: input.purchaseOrderId },
 })

 if (!purchaseOrder) {
 throw new NotFoundError('Purchase order not found')
 }

 if (purchaseOrder.status === PurchaseOrderStatus.CANCELLED || purchaseOrder.status === PurchaseOrderStatus.CLOSED) {
 throw new ConflictError('Cannot record a note against a closed or cancelled purchase order')
 }

 if (!purchaseOrder.warehouseCode || !purchaseOrder.warehouseName) {
 throw new ValidationError('Select a warehouse on the purchase order before creating a movement note')
 }

 const receivedAt = input.receivedAt ?? new Date()

  const note = await tx.movementNote.create({
    data: {
      purchaseOrderId: input.purchaseOrderId,
      status: MovementNoteStatus.DRAFT,
      referenceNumber: input.referenceNumber ?? null,
 receivedAt,
 receivedById: user.id ?? null,
 receivedByName: user.name ?? null,
 warehouseCode: purchaseOrder.warehouseCode,
 warehouseName: purchaseOrder.warehouseName,
 notes: input.notes ?? null,
 lines: {
 create: await Promise.all(
 input.lines.map(async line => {
 const poLine = await tx.purchaseOrderLine.findUnique({
 where: { id: line.purchaseOrderLineId },
 })

 if (!poLine || poLine.purchaseOrderId !== input.purchaseOrderId) {
 throw new ValidationError('Line does not belong to the purchase order')
 }

 return {
 purchaseOrderLineId: line.purchaseOrderLineId,
 skuCode: poLine.skuCode,
 skuDescription: poLine.skuDescription,
 batchLot: line.batchLot ?? null,
 quantity: line.quantity,
 storageCartonsPerPallet: line.storageCartonsPerPallet ?? null,
 shippingCartonsPerPallet: line.shippingCartonsPerPallet ?? null,
 attachments: line.attachments ? (line.attachments as Prisma.JsonObject) : null,
 }
 })
 ),
 },
    },
    include: {
      lines: true,
      purchaseOrder: {
        select: {
          id: true,
          orderNumber: true,
          type: true,
          status: true,
          warehouseCode: true,
          warehouseName: true,
        },
      },
    },
  })

 if (purchaseOrder.isLegacy && purchaseOrder.status === PurchaseOrderStatus.DRAFT) {
 await tx.purchaseOrder.update({
 where: { id: purchaseOrder.id },
 data: { status: PurchaseOrderStatus.AWAITING_PROOF },
 })
 }

 return formatNoteOrderNumber(note)
 })
}

export async function cancelMovementNote(id: string) {
 const prisma = await getTenantPrisma()
 return prisma.$transaction(async tx => {
 const note = await tx.movementNote.findUnique({
 where: { id },
 })

 if (!note) {
 throw new NotFoundError('Movement note not found')
 }

 if (note.status !== MovementNoteStatus.DRAFT) {
 throw new ConflictError('Only draft notes can be cancelled')
 }

 await tx.movementNote.update({
 where: { id },
 data: {
 status: MovementNoteStatus.CANCELLED,
 },
 })
  })
}

function formatNoteOrderNumber<T extends { purchaseOrder: { orderNumber: string } | null }>(note: T): T {
 const purchaseOrder = note.purchaseOrder
 if (!purchaseOrder) return note
 return {
   ...note,
   purchaseOrder: {
     ...purchaseOrder,
     orderNumber: toPublicOrderNumber(purchaseOrder.orderNumber),
   },
 } as T
}

export async function postMovementNote(id: string, _user: UserContext) {
 const prisma = await getTenantPrisma()
 return prisma.$transaction(async tx => {
 const note = await tx.movementNote.findUnique({
 where: { id },
 include: {
 lines: true,
 purchaseOrder: {
 include: { lines: true },
 },
 },
 })

 if (!note) {
 throw new NotFoundError('Movement note not found')
 }

 if (note.status !== MovementNoteStatus.DRAFT) {
 throw new ConflictError('Only draft notes can be posted')
 }

 const po = note.purchaseOrder
 if (!po) {
 throw new NotFoundError('Purchase order missing for delivery note')
 }
 if (po.status === PurchaseOrderStatus.CANCELLED || po.status === PurchaseOrderStatus.CLOSED) {
 throw new ConflictError('Cannot post a note for a closed or cancelled purchase order')
 }

 for (const line of note.lines) {
 if (!line.purchaseOrderLineId) {
 throw new ValidationError('Delivery note line missing purchase order line reference')
 }

 const poLine = po.lines.find(l => l.id === line.purchaseOrderLineId)
 if (!poLine) {
 throw new NotFoundError('Purchase order line not found')
 }

 if (poLine.status === PurchaseOrderLineStatus.CANCELLED) {
 throw new ConflictError('Cannot post against a cancelled line')
 }

 await tx.sku.findFirst({ where: { skuCode: poLine.skuCode } })

 const newPostedQuantity = poLine.postedQuantity + line.quantity
 const lineStatus = newPostedQuantity >= poLine.quantity ? PurchaseOrderLineStatus.POSTED : PurchaseOrderLineStatus.PENDING

 await tx.purchaseOrderLine.update({
 where: { id: poLine.id },
 data: {
 postedQuantity: newPostedQuantity,
 status: lineStatus,
 },
 })

 await tx.movementNoteLine.update({
 where: { id: line.id },
 data: {
 varianceQuantity: newPostedQuantity - poLine.quantity,
 },
 })
 }

 const allLines = await tx.purchaseOrderLine.findMany({
 where: { purchaseOrderId: po.id },
 })

 const allPosted = allLines.every(line => line.status === PurchaseOrderLineStatus.POSTED)

 await tx.movementNote.update({
 where: { id },
 data: {
 status: MovementNoteStatus.POSTED,
 updatedAt: new Date(),
 },
 })

 const nextStatus = allPosted ? PurchaseOrderStatus.REVIEW : PurchaseOrderStatus.AWAITING_PROOF

 await tx.purchaseOrder.update({
 where: { id: po.id },
 data: {
 status: nextStatus,
 postedAt: po.postedAt,
 },
 })

 const updated = await tx.movementNote.findUnique({
 where: { id },
 include: {
 lines: true,
 purchaseOrder: {
 select: {
 id: true,
 orderNumber: true,
 type: true,
 status: true,
 warehouseCode: true,
 warehouseName: true,
 },
 },
 },
 })
 if (!updated) {
 throw new NotFoundError('Movement note not found after posting')
 }

 return formatNoteOrderNumber(updated)
 })
}
