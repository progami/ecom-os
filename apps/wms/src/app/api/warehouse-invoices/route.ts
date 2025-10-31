import { withAuth, ApiResponses, z } from '@/lib/api'
import {
 createWarehouseInvoice,
 listWarehouseInvoices,
 type CreateWarehouseInvoiceInput,
} from '@/lib/services/warehouse-invoice-service'

const invoiceLineSchema = z.object({
 purchaseOrderId: z.string().optional().nullable(),
 purchaseOrderLineId: z.string().optional().nullable(),
 movementNoteLineId: z.string().optional().nullable(),
 chargeCode: z.string().min(1, 'Charge code is required'),
 description: z.string().optional().nullable(),
 quantity: z.number().optional().nullable(),
 unitRate: z.number().optional().nullable(),
 total: z.number().optional().nullable(),
 notes: z.string().optional().nullable(),
})

const createSchema = z.object({
 invoiceNumber: z.string().min(1, 'Invoice number is required'),
 issuedAt: z.string().optional().nullable(),
 dueAt: z.string().optional().nullable(),
 warehouseCode: z.string().min(1, 'Warehouse code is required'),
 warehouseName: z.string().min(1, 'Warehouse name is required'),
 warehouseId: z.string().optional().nullable(),
 currency: z.string().optional().nullable(),
 subtotal: z.number().optional().nullable(),
 total: z.number().optional().nullable(),
 notes: z.string().optional().nullable(),
 lines: z.array(invoiceLineSchema).min(1, 'At least one invoice line is required'),
})

export const GET = withAuth(async (request) => {
 const searchParams = request.nextUrl.searchParams
 const purchaseOrderId = searchParams.get('purchaseOrderId')

 const invoices = await listWarehouseInvoices({ purchaseOrderId: purchaseOrderId ?? undefined })
 return ApiResponses.success({ data: invoices })
})

export const POST = withAuth(async (request, session) => {
 const body = await request.json().catch(() => null)
 if (!body) {
 return ApiResponses.badRequest('Invalid JSON payload')
 }

 const parsed = createSchema.safeParse(body)
 if (!parsed.success) {
 return ApiResponses.validationError(parsed.error.flatten().fieldErrors)
 }

 const issuedAt = parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : null
 if (issuedAt && Number.isNaN(issuedAt.getTime())) {
 return ApiResponses.validationError({ issuedAt: 'Invalid issuedAt value' })
 }

 const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null
 if (dueAt && Number.isNaN(dueAt.getTime())) {
 return ApiResponses.validationError({ dueAt: 'Invalid dueAt value' })
 }

 const payload: CreateWarehouseInvoiceInput = {
 invoiceNumber: parsed.data.invoiceNumber,
 issuedAt,
 dueAt,
 warehouseCode: parsed.data.warehouseCode,
 warehouseName: parsed.data.warehouseName,
 warehouseId: parsed.data.warehouseId ?? null,
 currency: parsed.data.currency ?? 'USD',
 subtotal: parsed.data.subtotal ?? null,
 total: parsed.data.total ?? null,
 notes: parsed.data.notes ?? null,
 lines: parsed.data.lines.map(line => ({
 purchaseOrderId: line.purchaseOrderId ?? null,
 purchaseOrderLineId: line.purchaseOrderLineId ?? null,
 movementNoteLineId: line.movementNoteLineId ?? null,
 chargeCode: line.chargeCode,
 description: line.description ?? null,
 quantity: line.quantity ?? null,
 unitRate: line.unitRate ?? null,
 total: line.total ?? null,
 notes: line.notes ?? null,
 })),
 }

 const invoice = await createWarehouseInvoice(payload, {
 id: session.user.id,
 name: session.user.name,
 })

 return ApiResponses.created(invoice)
})
