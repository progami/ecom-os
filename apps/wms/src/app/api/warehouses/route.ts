import { withAuth, withRole, ApiResponses, z } from '@/lib/api'
import { getTenantPrisma } from '@/lib/tenant/server'
import { Prisma, WarehouseKind } from '@ecom-os/prisma-wms'
import { sanitizeForDisplay, validateAlphanumeric } from '@/lib/security/input-sanitization'
import { SHIPMENT_PLANNING_CONFIG } from '@/lib/config/shipment-planning'
export const dynamic = 'force-dynamic'

const optionalEmailSchema = z.preprocess(
 (val) => {
 if (typeof val === 'string') {
 const trimmed = val.trim()
 return trimmed === '' ? undefined : trimmed
 }
 return val
 },
 z.string().email().optional()
)

const optionalNullableEmailSchema = z.preprocess(
 (val) => {
 if (typeof val === 'string') {
 const trimmed = val.trim()
 return trimmed === '' ? null : trimmed
 }
 return val ?? null
 },
 z.string().email().optional().nullable()
)

const normalizeWarehouseCode = (value: string) =>
 sanitizeForDisplay(value.trim().replace(/\s+/g, '-').toUpperCase())

const warehouseCodeSchema = z
 .string()
 .min(1)
 .max(10)
 .transform(normalizeWarehouseCode)
 .refine(validateAlphanumeric, {
  message: 'Warehouse code must be alphanumeric'
 })

type RateListAttachmentResponse = {
  fileName: string
  size: number
  contentType: string
  uploadedAt: string
  uploadedBy?: string | null
} | null

const parseRateListAttachment = (value: Prisma.JsonValue | null): RateListAttachmentResponse => {
 if (!value || typeof value !== 'object' || Array.isArray(value)) {
  return null
 }

 const record = value as Record<string, unknown>

 if (typeof record.fileName !== 'string' || typeof record.s3Key !== 'string') {
  return null
 }

 return {
  fileName: record.fileName,
  size: typeof record.size === 'number' ? record.size : 0,
  contentType:
   typeof record.contentType === 'string' ? record.contentType : 'application/octet-stream',
  uploadedAt:
   typeof record.uploadedAt === 'string' ? record.uploadedAt : new Date().toISOString(),
  uploadedBy: typeof record.uploadedBy === 'string' ? record.uploadedBy : null,
 }
}

// Validation schemas with sanitization
const createWarehouseSchema = z.object({
 code: warehouseCodeSchema,
 name: z.string().min(1).transform(val => sanitizeForDisplay(val)),
 address: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
 latitude: z.number().min(-90).max(90).optional().nullable(),
 longitude: z.number().min(-180).max(180).optional().nullable(),
 contactEmail: optionalEmailSchema,
 contactPhone: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
 kind: z.nativeEnum(WarehouseKind).optional(),
})

const updateWarehouseSchema = z.object({
 code: warehouseCodeSchema.optional(),
 name: z.string().min(1).optional().transform(val => val ? sanitizeForDisplay(val) : val),
 address: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
 latitude: z.number().min(-90).max(90).optional().nullable(),
 longitude: z.number().min(-180).max(180).optional().nullable(),
 contactEmail: optionalNullableEmailSchema,
 contactPhone: z.string().optional().nullable().transform(val => val ? sanitizeForDisplay(val) : val),
 kind: z.nativeEnum(WarehouseKind).optional(),
})

// GET /api/warehouses - List warehouses
export const GET = withAuth(async (req, _session) => {
 const prisma = await getTenantPrisma()
 const searchParams = req.nextUrl.searchParams
 const includeAmazon = searchParams.get('includeAmazon') === 'true'
 const id = searchParams.get('id')
 
 const where: Prisma.WarehouseWhereInput = {}
 if (id) {
  where.id = id
 }
 
 // Exclude Amazon FBA UK warehouse unless explicitly requested
 if (!includeAmazon) {
 where.NOT = {
 OR: [
 { code: 'AMZN' },
 { code: 'AMZN-UK' }
 ]
 }
 }

 const warehouses = await prisma.warehouse.findMany({
 where,
 orderBy: { name: 'asc' },
 include: {
 _count: {
 select: {
 users: true,
 costRates: true
 }
 }
 }
 })

 // Get transaction counts for all warehouses in a single query
 const transactionCounts = await prisma.inventoryTransaction.groupBy({
 by: ['warehouseCode'],
 _count: {
 id: true
 },
 where: {
 warehouseCode: {
 in: warehouses.map(w => w.code)
 }
 }
 })

 const countMap = new Map(transactionCounts.map(tc => [tc.warehouseCode, tc._count.id]))

 const warehousesWithCounts = warehouses.map(warehouse => ({
 ...warehouse,
 rateListAttachment: parseRateListAttachment(
 warehouse.rateListAttachment as Prisma.JsonValue | null
 ),
 _count: {
 ...warehouse._count,
 inventoryTransactions: countMap.get(warehouse.code) || 0
 }
}))

 return ApiResponses.success(warehousesWithCounts)
})

// POST /api/warehouses - Create warehouse
export const POST = withRole(['admin', 'staff'], async (request, _session) => {
 const prisma = await getTenantPrisma()
 const body = await request.json()
 const validatedData = createWarehouseSchema.parse(body)

 // Check if warehouse code already exists (case-insensitive)
 const existingWarehouse = await prisma.warehouse.findFirst({
 where: {
 OR: [
 { code: { equals: validatedData.code, mode: 'insensitive' } },
 { name: { equals: validatedData.name, mode: 'insensitive' } }
 ]
 }
 })

 if (existingWarehouse) {
 if (existingWarehouse.code.toLowerCase() === validatedData.code.toLowerCase()) {
 return ApiResponses.badRequest('Warehouse code already exists (case-insensitive match)')
 } else {
 return ApiResponses.badRequest('Warehouse name already exists (case-insensitive match)')
 }
 }

 const warehouse = await prisma.$transaction(async tx => {
  const created = await tx.warehouse.create({
   data: {
    code: validatedData.code,
    name: validatedData.name,
    address: validatedData.address || null,
    latitude: validatedData.latitude || null,
    longitude: validatedData.longitude || null,
    contactEmail: validatedData.contactEmail || null,
    contactPhone: validatedData.contactPhone || null,
    kind: validatedData.kind,
    isActive: true
   },
   include: {
    _count: {
     select: {
      users: true,
      costRates: true
     }
    }
   }
  })

  const skus = await tx.sku.findMany({ select: { id: true } })
  if (skus.length > 0) {
   const defaultCartonsPerPallet = SHIPMENT_PLANNING_CONFIG.DEFAULT_CARTONS_PER_PALLET
   await tx.warehouseSkuStorageConfig.createMany({
    data: skus.map(sku => ({
     warehouseId: created.id,
     skuId: sku.id,
     storageCartonsPerPallet: defaultCartonsPerPallet,
     shippingCartonsPerPallet: defaultCartonsPerPallet,
    })),
    skipDuplicates: true,
   })
  }

  return created
 })

 return ApiResponses.created(warehouse)
})

// PATCH /api/warehouses - Update warehouse
export const PATCH = withRole(['admin', 'staff'], async (request, _session) => {
 const prisma = await getTenantPrisma()
 const searchParams = request.nextUrl.searchParams
 const warehouseId = searchParams.get('id')
 
 if (!warehouseId) {
 return ApiResponses.badRequest('Warehouse ID is required')
 }

 const body = await request.json()
 const validatedData = updateWarehouseSchema.parse(body)

 // If updating code or name, check if they're already in use (case-insensitive)
 if (validatedData.code || validatedData.name) {
 const whereConditions = []
 
 if (validatedData.code) {
 whereConditions.push({
 code: { equals: validatedData.code, mode: 'insensitive' as const },
 id: { not: warehouseId }
 })
 }
 
 if (validatedData.name) {
 whereConditions.push({
 name: { equals: validatedData.name, mode: 'insensitive' as const },
 id: { not: warehouseId }
 })
 }
 
 const existingWarehouse = await prisma.warehouse.findFirst({
 where: { OR: whereConditions }
 })

 if (existingWarehouse) {
 if (validatedData.code && existingWarehouse.code.toLowerCase() === validatedData.code.toLowerCase()) {
 return ApiResponses.badRequest('Warehouse code already in use (case-insensitive match)')
 } else if (validatedData.name && existingWarehouse.name.toLowerCase() === validatedData.name.toLowerCase()) {
 return ApiResponses.badRequest('Warehouse name already in use (case-insensitive match)')
 }
 }
 }

 const updatedWarehouse = await prisma.warehouse.update({
 where: { id: warehouseId },
 data: validatedData,
 include: {
 _count: {
 select: {
 users: true,
 costRates: true
 }
 }
 }
 })

 return ApiResponses.success(updatedWarehouse)
})

// DELETE /api/warehouses - Delete warehouse
export const DELETE = withRole(['admin'], async (request, _session) => {
 const prisma = await getTenantPrisma()
 const searchParams = request.nextUrl.searchParams
 const warehouseId = searchParams.get('id')
 
 if (!warehouseId) {
 return ApiResponses.badRequest('Warehouse ID is required')
 }

 // Check if warehouse has related data
 const relatedData = await prisma.warehouse.findUnique({
 where: { id: warehouseId },
 include: {
 _count: {
 select: {
 users: true,
 costRates: true
 }
 }
 }
 })

 if (!relatedData) {
 return ApiResponses.notFound('Warehouse not found')
 }

 // Check if warehouse has any related data
 const hasRelatedData = Object.values(relatedData._count).some(count => (count as number) > 0)
 
 if (hasRelatedData) {
  return ApiResponses.conflict(
   `Cannot delete warehouse "${relatedData.code}". References found: users=${relatedData._count.users}, cost rates=${relatedData._count.costRates}.`
  )
 }

 await prisma.warehouse.delete({
  where: { id: warehouseId }
 })

 return ApiResponses.success({
  message: 'Warehouse deleted successfully'
 })
})
