import { withAuth, withRole, ApiResponses, z } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { sanitizeForDisplay, validateAlphanumeric } from '@/lib/security/input-sanitization'
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

// Validation schemas with sanitization
const createWarehouseSchema = z.object({
 code: z.string().min(1).max(10).refine(validateAlphanumeric, {
 message: "Warehouse code must be alphanumeric"
 }).transform(val => sanitizeForDisplay(val)),
 name: z.string().min(1).transform(val => sanitizeForDisplay(val)),
 address: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
 latitude: z.number().min(-90).max(90).optional().nullable(),
 longitude: z.number().min(-180).max(180).optional().nullable(),
 contactEmail: optionalEmailSchema,
 contactPhone: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
 isActive: z.boolean().default(true)
})

const updateWarehouseSchema = z.object({
 code: z.string().min(1).max(10).optional().refine(val => !val || validateAlphanumeric(val), {
 message: "Warehouse code must be alphanumeric"
 }).transform(val => val ? sanitizeForDisplay(val) : val),
 name: z.string().min(1).optional().transform(val => val ? sanitizeForDisplay(val) : val),
 address: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
 latitude: z.number().min(-90).max(90).optional().nullable(),
 longitude: z.number().min(-180).max(180).optional().nullable(),
 contactEmail: optionalNullableEmailSchema,
 contactPhone: z.string().optional().nullable().transform(val => val ? sanitizeForDisplay(val) : val),
 isActive: z.boolean().optional()
})

// GET /api/warehouses - List warehouses
export const GET = withAuth(async (req, _session) => {

 const searchParams = req.nextUrl.searchParams
 const includeInactive = searchParams.get('includeInactive') === 'true'
 const includeAmazon = searchParams.get('includeAmazon') === 'true'

 const where: Prisma.WarehouseWhereInput = includeInactive ? {} : { isActive: true }
 
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
 _count: {
 ...warehouse._count,
 inventoryTransactions: countMap.get(warehouse.code) || 0
 }
 }))

 return ApiResponses.success(warehousesWithCounts)
})

// POST /api/warehouses - Create warehouse
export const POST = withRole(['admin', 'staff'], async (request, _session) => {
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

 const warehouse = await prisma.warehouse.create({
 data: {
 code: validatedData.code,
 name: validatedData.name,
 address: validatedData.address || null,
 latitude: validatedData.latitude || null,
 longitude: validatedData.longitude || null,
 contactEmail: validatedData.contactEmail || null,
 contactPhone: validatedData.contactPhone || null,
 isActive: validatedData.isActive
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

 return ApiResponses.created(warehouse)
})

// PATCH /api/warehouses - Update warehouse
export const PATCH = withRole(['admin', 'staff'], async (request, _session) => {
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
 // Soft delete - just mark as inactive
 const updatedWarehouse = await prisma.warehouse.update({
 where: { id: warehouseId },
 data: { isActive: false }
 })

 return ApiResponses.success({
 message: 'Warehouse deactivated (has related data)',
 warehouse: updatedWarehouse
 })
 } else {
 // Hard delete - no related data
 await prisma.warehouse.delete({
 where: { id: warehouseId }
 })

 return ApiResponses.success({
 message: 'Warehouse deleted successfully'
 })
 }
})
