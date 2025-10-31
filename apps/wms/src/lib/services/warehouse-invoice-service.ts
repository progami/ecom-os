import { prisma } from '@/lib/prisma'
import { WarehouseInvoiceStatus } from '@prisma/client'
import { ValidationError, ConflictError, NotFoundError } from '@/lib/api'

export interface UserContext {
 id?: string | null
 name?: string | null
}

export interface WarehouseInvoiceLineInput {
 purchaseOrderId?: string | null
 purchaseOrderLineId?: string | null
 movementNoteLineId?: string | null
 chargeCode: string
 description?: string | null
 quantity?: number | null
 unitRate?: number | null
 total?: number | null
 notes?: string | null
}

export interface CreateWarehouseInvoiceInput {
 invoiceNumber: string
 issuedAt?: Date | null
 dueAt?: Date | null
 warehouseCode: string
 warehouseName: string
 warehouseId?: string | null
 currency?: string | null
 subtotal?: number | null
 total?: number | null
 notes?: string | null
 lines: WarehouseInvoiceLineInput[]
}

export async function listWarehouseInvoices(filter?: { purchaseOrderId?: string | null }) {
 return prisma.warehouseInvoice.findMany({
 where: filter?.purchaseOrderId
 ? {
 lines: {
 some: {
 purchaseOrderId: filter.purchaseOrderId,
 },
 },
 }
 : undefined,
 orderBy: { createdAt: 'desc' },
 include: {
 lines: true,
 },
 })
}

export async function getWarehouseInvoiceById(id: string) {
 const invoice = await prisma.warehouseInvoice.findUnique({
 where: { id },
 include: { lines: true },
 })

 if (!invoice) {
 throw new NotFoundError('Warehouse invoice not found')
 }

 return invoice
}

export async function createWarehouseInvoice(input: CreateWarehouseInvoiceInput, _user: UserContext) {
 if (!input.invoiceNumber.trim()) {
 throw new ValidationError('Invoice number is required')
 }

 if (input.lines.length === 0) {
 throw new ValidationError('At least one invoice line is required')
 }

 const existing = await prisma.warehouseInvoice.findFirst({
 where: {
 invoiceNumber: input.invoiceNumber,
 },
 })

 if (existing) {
 throw new ConflictError('An invoice with this number already exists')
 }

 const issuedAt = input.issuedAt ?? new Date()
 const dueAt = input.dueAt ?? null

 return prisma.warehouseInvoice.create({
 data: {
 invoiceNumber: input.invoiceNumber,
 status: WarehouseInvoiceStatus.DRAFT,
 issuedAt,
 dueAt,
 warehouseId: input.warehouseId ?? null,
 warehouseCode: input.warehouseCode,
 warehouseName: input.warehouseName,
 currency: input.currency ?? 'USD',
 subtotal: input.subtotal ?? 0,
 total: input.total ?? 0,
 notes: input.notes ?? null,
 lines: {
 create: input.lines.map(line => ({
 purchaseOrderId: line.purchaseOrderId ?? null,
 purchaseOrderLineId: line.purchaseOrderLineId ?? null,
 movementNoteLineId: line.movementNoteLineId ?? null,
 chargeCode: line.chargeCode,
 description: line.description ?? null,
 quantity: line.quantity ?? 0,
 unitRate: line.unitRate ?? 0,
 total: line.total ?? 0,
 varianceAmount: null,
 notes: line.notes ?? null,
 })),
 },
 createdAt: new Date(),
 updatedAt: new Date(),
 },
 include: {
 lines: true,
 },
 })
}

export async function updateWarehouseInvoiceStatus(id: string, status: WarehouseInvoiceStatus) {
 const invoice = await prisma.warehouseInvoice.findUnique({ where: { id } })
 if (!invoice) {
 throw new NotFoundError('Warehouse invoice not found')
 }

 return prisma.warehouseInvoice.update({
 where: { id },
 data: {
 status,
 updatedAt: new Date(),
 },
 include: { lines: true },
 })
}
