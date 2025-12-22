import { withAuth, withRole, ApiResponses, z } from '@/lib/api'
import { getTenantPrisma } from '@/lib/tenant/server'
import { Prisma, type Sku } from '@ecom-os/prisma-wms'
import { sanitizeForDisplay, sanitizeSearchQuery, escapeRegex } from '@/lib/security/input-sanitization'
export const dynamic = 'force-dynamic'

type SkuWithCounts = Sku & { _count: { inventoryTransactions: number } }
type DeleteSkuResponse = { message: string } | { message: string; sku: Sku }

// Validation schemas with sanitization
const supplierIdSchema = z.preprocess(
  (value) => {
    if (value === undefined) return undefined
    if (value === null) return null
    if (typeof value === 'string' && value.trim() === '') return null
    return value
  },
  z.string().uuid().nullable().optional()
)

const createSkuSchema = z.object({
 skuCode: z.string().trim().min(1).max(50).transform(val => sanitizeForDisplay(val)),
 asin: z
  .string()
  .trim()
  .max(64)
  .optional()
  .nullable()
  .transform((val) => {
    if (val === undefined) return undefined
    if (val === null) return null
    const sanitized = sanitizeForDisplay(val)
    return sanitized ? sanitized : null
  }),
 description: z.string().trim().min(1).transform(val => sanitizeForDisplay(val)),
 packSize: z.number().int().positive(),
 defaultSupplierId: supplierIdSchema,
 secondarySupplierId: supplierIdSchema,
 material: z
  .string()
  .trim()
  .max(120)
  .optional()
  .nullable()
  .transform((val) => {
    if (val === undefined) return undefined
    if (val === null) return null
    const sanitized = sanitizeForDisplay(val)
    return sanitized ? sanitized : null
  }),
 unitDimensionsCm: z
  .string()
  .trim()
  .max(120)
  .optional()
  .nullable()
  .transform((val) => {
    if (val === undefined) return undefined
    if (val === null) return null
    const sanitized = sanitizeForDisplay(val)
    return sanitized ? sanitized : null
  }),
 unitWeightKg: z.number().positive().optional().nullable(),
 unitsPerCarton: z.number().int().positive(),
 cartonDimensionsCm: z
  .string()
  .trim()
  .max(120)
  .optional()
  .nullable()
  .transform((val) => {
    if (val === undefined) return undefined
    if (val === null) return null
    const sanitized = sanitizeForDisplay(val)
    return sanitized ? sanitized : null
  }),
 cartonWeightKg: z.number().positive().optional().nullable(),
 packagingType: z
  .string()
  .trim()
  .max(80)
  .optional()
  .nullable()
  .transform((val) => {
    if (val === undefined) return undefined
    if (val === null) return null
    const sanitized = sanitizeForDisplay(val)
    return sanitized ? sanitized : null
  }),
 isActive: z.boolean().default(true)
})

const updateSkuSchema = createSkuSchema.partial()

// GET /api/skus - List SKUs
export const GET = withAuth(async (request, _session) => {
 const prisma = await getTenantPrisma()
 const searchParams = request.nextUrl.searchParams
 const search = searchParams.get('search') ? sanitizeSearchQuery(searchParams.get('search')!) : null
 const includeInactive = searchParams.get('includeInactive') === 'true'

 const where: Prisma.SkuWhereInput = {}
 
 if (!includeInactive) {
 where.isActive = true
 }

 if (search) {
 const escapedSearch = escapeRegex(search)
 where.OR = [
 { skuCode: { contains: escapedSearch, mode: 'insensitive' } },
 { description: { contains: escapedSearch, mode: 'insensitive' } },
 { asin: { contains: escapedSearch, mode: 'insensitive' } }
 ]
 }

 const skus = await prisma.sku.findMany({
 where,
 orderBy: { skuCode: 'asc' }
 })

 // Get transaction counts for all SKUs in a single query
 const transactionCounts = await prisma.inventoryTransaction.groupBy({
 by: ['skuCode'],
 _count: {
 id: true
 },
 where: {
 skuCode: {
 in: skus.map(sku => sku.skuCode)
 }
 }
 })

 const countMap = new Map(transactionCounts.map(tc => [tc.skuCode, tc._count.id]))

 const skusWithCounts: SkuWithCounts[] = skus.map(sku => ({
 ...sku,
 _count: {
 inventoryTransactions: countMap.get(sku.skuCode) || 0
 }
 }))

 return ApiResponses.success(skusWithCounts)
})

// POST /api/skus - Create new SKU
export const POST = withRole(['admin', 'staff'], async (request, _session) => {
 const prisma = await getTenantPrisma()
 const body = await request.json()
 const validatedData = createSkuSchema.parse(body)

 if (
  validatedData.defaultSupplierId &&
  validatedData.secondarySupplierId &&
  validatedData.defaultSupplierId === validatedData.secondarySupplierId
 ) {
  return ApiResponses.badRequest('Default and secondary supplier must be different')
 }

 const supplierIds = [
  validatedData.defaultSupplierId ?? undefined,
  validatedData.secondarySupplierId ?? undefined,
 ].filter((id): id is string => Boolean(id))

 if (supplierIds.length > 0) {
  const suppliers = await prisma.supplier.findMany({
   where: { id: { in: supplierIds } },
   select: { id: true },
  })

  const foundIds = new Set(suppliers.map((s) => s.id))
  const missing = supplierIds.filter((id) => !foundIds.has(id))
  if (missing.length > 0) {
   return ApiResponses.badRequest('Supplier not found')
  }
 }

 // Check if SKU code already exists
 const existingSku = await prisma.sku.findUnique({
 where: { skuCode: validatedData.skuCode }
 })

 if (existingSku) {
 return ApiResponses.badRequest('SKU code already exists')
 }

 const sku = await prisma.sku.create({
 data: {
 skuCode: validatedData.skuCode,
 asin: validatedData.asin ?? null,
 description: validatedData.description,
 packSize: validatedData.packSize,
 defaultSupplierId: validatedData.defaultSupplierId ?? null,
 secondarySupplierId: validatedData.secondarySupplierId ?? null,
 material: validatedData.material ?? null,
 unitDimensionsCm: validatedData.unitDimensionsCm ?? null,
 unitWeightKg: validatedData.unitWeightKg ?? null,
 unitsPerCarton: validatedData.unitsPerCarton,
 cartonDimensionsCm: validatedData.cartonDimensionsCm ?? null,
 cartonWeightKg: validatedData.cartonWeightKg ?? null,
 packagingType: validatedData.packagingType ?? null,
 isActive: validatedData.isActive
 }
 })

 return ApiResponses.created<Sku>(sku)
})

// PATCH /api/skus - Update SKU
export const PATCH = withRole(['admin', 'staff'], async (request, _session) => {
 const prisma = await getTenantPrisma()
 const searchParams = request.nextUrl.searchParams
 const skuId = searchParams.get('id')
 
 if (!skuId) {
 return ApiResponses.badRequest('SKU ID is required')
 }

 const body = await request.json()
 const validatedData = updateSkuSchema.parse(body)

 if (
  validatedData.defaultSupplierId &&
  validatedData.secondarySupplierId &&
  validatedData.defaultSupplierId === validatedData.secondarySupplierId
 ) {
  return ApiResponses.badRequest('Default and secondary supplier must be different')
 }

 const supplierIds = [
  validatedData.defaultSupplierId ?? undefined,
  validatedData.secondarySupplierId ?? undefined,
 ].filter((id): id is string => Boolean(id))

 if (supplierIds.length > 0) {
  const suppliers = await prisma.supplier.findMany({
   where: { id: { in: supplierIds } },
   select: { id: true },
  })

  const foundIds = new Set(suppliers.map((s) => s.id))
  const missing = supplierIds.filter((id) => !foundIds.has(id))
  if (missing.length > 0) {
   return ApiResponses.badRequest('Supplier not found')
  }
 }

 // If updating code, check if it's already in use
 if (validatedData.skuCode) {
 const existingSku = await prisma.sku.findFirst({
 where: {
 skuCode: validatedData.skuCode,
 id: { not: skuId }
 }
 })

 if (existingSku) {
 return ApiResponses.badRequest('SKU code already in use')
 }
 }

 const updatedSku = await prisma.sku.update({
 where: { id: skuId },
 data: validatedData
 })

 return ApiResponses.success<Sku>(updatedSku)
})

// DELETE /api/skus - Delete SKU
export const DELETE = withRole(['admin'], async (request, _session) => {
 const prisma = await getTenantPrisma()
 const searchParams = request.nextUrl.searchParams
 const skuId = searchParams.get('id')
 
 if (!skuId) {
 return ApiResponses.badRequest('SKU ID is required')
 }

 // Check if SKU exists
 const sku = await prisma.sku.findUnique({
 where: { id: skuId }
 })

 if (!sku) {
 return ApiResponses.notFound('SKU not found')
 }

 // Check if SKU is used in any transactions
 const transactionCount = await prisma.inventoryTransaction.count({
 where: { skuCode: sku.skuCode }
 })
 
 if (transactionCount > 0) {
 // Soft delete - just mark as inactive
 const updatedSku = await prisma.sku.update({
 where: { id: skuId },
 data: { isActive: false }
 })

 return ApiResponses.success<DeleteSkuResponse>({
 message: 'SKU deactivated (has related transactions)',
 sku: updatedSku
 })
 } else {
 // Hard delete - no related data
 await prisma.sku.delete({
 where: { id: skuId }
 })

 return ApiResponses.success<DeleteSkuResponse>({
 message: 'SKU deleted successfully'
 })
 }
})
