import { withAuth, withRole, ApiResponses, z } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { Prisma, type Sku } from '@ecom-os/prisma-wms'
import { sanitizeForDisplay, sanitizeSearchQuery, escapeRegex } from '@/lib/security/input-sanitization'
export const dynamic = 'force-dynamic'

type SkuWithCounts = Sku & { _count: { inventoryTransactions: number } }
type DeleteSkuResponse = { message: string } | { message: string; sku: Sku }

// Validation schemas with sanitization
const createSkuSchema = z.object({
 skuCode: z.string().min(1).max(50).transform(val => sanitizeForDisplay(val)),
 asin: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
 description: z.string().min(1).transform(val => sanitizeForDisplay(val)),
 packSize: z.number().int().positive(),
 material: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
 unitDimensionsCm: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
 unitWeightKg: z.number().positive().optional(),
 unitsPerCarton: z.number().int().positive(),
 cartonDimensionsCm: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
 cartonWeightKg: z.number().positive().optional(),
 packagingType: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
 isActive: z.boolean().default(true)
})

const updateSkuSchema = createSkuSchema.partial().extend({
 skuCode: z.string().min(1).max(50).optional()
})

// GET /api/skus - List SKUs
export const GET = withAuth<SkuWithCounts[]>(async (request, _session) => {

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
export const POST = withRole<Sku>(['admin', 'staff'], async (request, _session) => {

 const body = await request.json()
 const validatedData = createSkuSchema.parse(body)

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
 asin: validatedData.asin || null,
 description: validatedData.description,
 packSize: validatedData.packSize,
 material: validatedData.material || null,
 unitDimensionsCm: validatedData.unitDimensionsCm || null,
 unitWeightKg: validatedData.unitWeightKg || null,
 unitsPerCarton: validatedData.unitsPerCarton,
 cartonDimensionsCm: validatedData.cartonDimensionsCm || null,
 cartonWeightKg: validatedData.cartonWeightKg || null,
 packagingType: validatedData.packagingType || null,
 isActive: validatedData.isActive
 }
 })

 return ApiResponses.created<Sku>(sku)
})

// PATCH /api/skus - Update SKU
export const PATCH = withRole<Sku>(['admin', 'staff'], async (request, _session) => {

 const searchParams = request.nextUrl.searchParams
 const skuId = searchParams.get('id')
 
 if (!skuId) {
 return ApiResponses.badRequest('SKU ID is required')
 }

 const body = await request.json()
 const validatedData = updateSkuSchema.parse(body)

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
export const DELETE = withRole<DeleteSkuResponse>(['admin'], async (request, _session) => {

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
