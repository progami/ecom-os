import { BaseService, ServiceContext } from './base.service'
import { z } from 'zod'
import { 
 sanitizeForDisplay, 
 validateAlphanumeric 
} from '@/lib/security/input-sanitization'
import { businessLogger } from '@/lib/logger/server'
import { Prisma } from '@prisma/client'

// Validation schemas
const createWarehouseSchema = z.object({
 code: z.string().min(1).max(10).refine(validateAlphanumeric, {
 message: "Warehouse code must be alphanumeric"
 }).transform(val => sanitizeForDisplay(val)),
 name: z.string().min(1).transform(val => sanitizeForDisplay(val)),
 address: z.string().optional().transform(val => val ? sanitizeForDisplay(val) : val),
 latitude: z.number().min(-90).max(90).optional().nullable(),
 longitude: z.number().min(-180).max(180).optional().nullable(),
 contactEmail: z.string().email().optional(),
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
 contactEmail: z.string().email().optional().nullable(),
 contactPhone: z.string().optional().nullable().transform(val => val ? sanitizeForDisplay(val) : val),
 isActive: z.boolean().optional()
})

export interface WarehouseFilters {
 includeInactive?: boolean
 includeAmazon?: boolean
}

export interface PaginationParams {
 page?: number
 limit?: number
}

// Transform snake_case warehouse to camelCase for frontend compatibility
type WarehouseWithCounts = Prisma.WarehouseGetPayload<{ include: { _count: true } }>

function transformWarehouse(warehouse: WarehouseWithCounts) {
 return {
 id: warehouse.id,
 code: warehouse.code,
 name: warehouse.name,
 address: warehouse.address,
 latitude: warehouse.latitude,
 longitude: warehouse.longitude,
 contactEmail: warehouse.contactEmail,
 contactPhone: warehouse.contactPhone,
 isActive: warehouse.isActive,
 createdAt: warehouse.createdAt,
 updatedAt: warehouse.updatedAt,
 _count: warehouse._count || {}
 }
}

export class WarehouseService extends BaseService {
 constructor(context: ServiceContext) {
 super(context)
 }

 /**
 * List warehouses with filtering and pagination
 */
 async listWarehouses(filters: WarehouseFilters, pagination: PaginationParams) {
 try {
 await this.requirePermission('warehouse:read')

 const { page, limit } = this.getPaginationParams(pagination)
 const skip = (page - 1) * limit

 const where: Prisma.WarehouseWhereInput = filters.includeInactive 
 ? {} 
 : { isActive: true }
 
 // Exclude Amazon FBA warehouses unless explicitly requested
 if (!filters.includeAmazon) {
 where.NOT = {
 OR: [
 { code: 'AMZN' },
 { code: 'AMZN-UK' }
 ]
 }
 }

 const [warehouses, total] = await Promise.all([
 this.prisma.warehouse.findMany({
 where,
 orderBy: { name: 'asc' },
 skip,
 take: limit,
 include: {
 _count: true
 }
 }),
 this.prisma.warehouse.count({ where })
 ])

 // Transform snake_case to camelCase for frontend
 const transformedWarehouses = warehouses.map(transformWarehouse)
 
 return this.createPaginatedResponse(transformedWarehouses, total, { page, limit })
 } catch (_error) {
 this.handleError(_error, 'listWarehouses')
 }
 }

 /**
 * Get warehouse by ID
 */
 async getWarehouse(warehouseId: string) {
 try {
 await this.requirePermission('warehouse:read')

 const warehouse = await this.prisma.warehouse.findUnique({
 where: { id: warehouseId },
 include: {
 _count: true
 }
 })

 if (!warehouse) {
 throw new Error('Warehouse not found')
 }

 return transformWarehouse(warehouse)
 } catch (_error) {
 this.handleError(_error, 'getWarehouse')
 }
 }

 /**
 * Create a new warehouse
 */
 async createWarehouse(data: z.infer<typeof createWarehouseSchema>) {
 try {
 await this.requirePermission('warehouse:create')
 
 const validatedData = createWarehouseSchema.parse(data)

 const warehouse = await this.executeInTransaction(async (tx) => {
 // Check if warehouse code or name already exists (case-insensitive)
 const existingWarehouse = await tx.warehouse.findFirst({
 where: {
 OR: [
 { code: { equals: validatedData.code, mode: 'insensitive' } },
 { name: { equals: validatedData.name, mode: 'insensitive' } }
 ]
 }
 })

 if (existingWarehouse) {
 if (existingWarehouse.code.toLowerCase() === validatedData.code.toLowerCase()) {
 throw new Error('Warehouse code already exists (case-insensitive match)')
 } else {
 throw new Error('Warehouse name already exists (case-insensitive match)')
 }
 }

 const newWarehouse = await tx.warehouse.create({
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
 _count: true
 }
 })

 await this.logAudit('WAREHOUSE_CREATED', 'Warehouse', newWarehouse.id, {
 code: newWarehouse.code,
 name: newWarehouse.name
 })

 return newWarehouse
 })

 businessLogger.info('Warehouse created successfully', {
 warehouseId: warehouse.id,
 code: warehouse.code,
 name: warehouse.name
 })

 return transformWarehouse(warehouse)
 } catch (_error) {
 this.handleError(_error, 'createWarehouse')
 }
 }

 /**
 * Update warehouse
 */
 async updateWarehouse(warehouseId: string, data: z.infer<typeof updateWarehouseSchema>) {
 try {
 await this.requirePermission('warehouse:update')
 
 const validatedData = updateWarehouseSchema.parse(data)

 const updatedWarehouse = await this.executeInTransaction(async (tx) => {
 // Check if warehouse exists
 const currentWarehouse = await tx.warehouse.findUnique({
 where: { id: warehouseId },
 include: {
 _count: true
 }
 })

 if (!currentWarehouse) {
 throw new Error('Warehouse not found')
 }

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
 
 const existingWarehouse = await tx.warehouse.findFirst({
 where: { OR: whereConditions }
 })

 if (existingWarehouse) {
 if (validatedData.code && existingWarehouse.code.toLowerCase() === validatedData.code.toLowerCase()) {
 throw new Error('Warehouse code already in use (case-insensitive match)')
 } else if (validatedData.name && existingWarehouse.name.toLowerCase() === validatedData.name.toLowerCase()) {
 throw new Error('Warehouse name already in use (case-insensitive match)')
 }
 }
 }

 // Transform camelCase to snake_case for database update
 const updateData: Prisma.WarehouseUpdateInput = {}
 if (validatedData.code !== undefined) updateData.code = validatedData.code
 if (validatedData.name !== undefined) updateData.name = validatedData.name
 if (validatedData.address !== undefined) updateData.address = validatedData.address
 if (validatedData.latitude !== undefined) updateData.latitude = validatedData.latitude
 if (validatedData.longitude !== undefined) updateData.longitude = validatedData.longitude
 if (validatedData.contactEmail !== undefined) updateData.contactEmail = validatedData.contactEmail
 if (validatedData.contactPhone !== undefined) updateData.contactPhone = validatedData.contactPhone
 if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive

 const updated = await tx.warehouse.update({
 where: { id: warehouseId },
 data: updateData,
 include: {
 _count: true
 }
 })

 await this.logAudit('WAREHOUSE_UPDATED', 'Warehouse', warehouseId, {
 previousData: transformWarehouse(currentWarehouse as WarehouseWithCounts),
 newData: JSON.parse(JSON.stringify(updateData))
 })

 return updated
 })

 businessLogger.info('Warehouse updated successfully', {
 warehouseId,
 changes: validatedData
 })

 return transformWarehouse(updatedWarehouse)
 } catch (_error) {
 this.handleError(_error, 'updateWarehouse')
 }
 }

 /**
 * Delete warehouse (soft delete if has related data)
 */
 async deleteWarehouse(warehouseId: string) {
 try {
 await this.requirePermission('warehouse:delete')

 const result = await this.executeInTransaction(async (tx) => {
 // Check if warehouse has related data
 const relatedData = await tx.warehouse.findUnique({
 where: { id: warehouseId },
 include: {
 _count: true
 }
 })

 if (!relatedData) {
 throw new Error('Warehouse not found')
 }

 // Check if warehouse has any related data
 const countData = relatedData._count || {}
 const hasRelatedData = Object.values(countData).some(count => (count as number) > 0)
 
 if (hasRelatedData) {
 // Soft delete - just mark as inactive
 const updatedWarehouse = await tx.warehouse.update({
 where: { id: warehouseId },
 data: { isActive: false },
 include: {
 _count: true
 }
 })

 await this.logAudit('WAREHOUSE_DEACTIVATED', 'Warehouse', warehouseId, {
 code: relatedData.code,
 name: relatedData.name,
 reason: 'Has related data'
 })

 return {
 action: 'deactivated',
 warehouse: transformWarehouse(updatedWarehouse)
 }
 } else {
 // Hard delete - no related data
 await tx.warehouse.delete({
 where: { id: warehouseId }
 })

 await this.logAudit('WAREHOUSE_DELETED', 'Warehouse', warehouseId, {
 code: relatedData.code,
 name: relatedData.name
 })

 return {
 action: 'deleted'
 }
 }
 })

 businessLogger.info('Warehouse deletion completed', {
 warehouseId,
 action: result.action
 })

 return result
 } catch (_error) {
 this.handleError(_error, 'deleteWarehouse')
 }
 }

 /**
 * Get warehouse statistics
 */
 async getWarehouseStats(warehouseId: string) {
 try {
 await this.requirePermission('warehouse:read')

 const warehouse = await this.prisma.warehouse.findUnique({
 where: { id: warehouseId },
 select: { code: true }
 })

 if (!warehouse) {
 throw new Error('Warehouse not found')
 }

 const thirtyDaysAgo = new Date()
 thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

 const [inventoryAggregates, transactionStats, userCount] = await Promise.all([
 this.prisma.inventoryTransaction.groupBy({
 by: ['skuCode', 'batchLot'],
 where: { warehouseCode: warehouse.code },
 _sum: {
 cartonsIn: true,
 cartonsOut: true
 }
 }),
 this.prisma.inventoryTransaction.groupBy({
 by: ['transactionType'],
 where: {
 warehouseCode: warehouse.code,
 transactionDate: { gte: thirtyDaysAgo }
 },
 _count: {
 _all: true
 }
 }),
 this.prisma.user.count({ where: { warehouseId } })
 ])

 const skuSet = new Set<string>()
 let totalCartons = 0

 inventoryAggregates.forEach(aggregate => {
 skuSet.add(aggregate.skuCode)
 const net = Number(aggregate._sum.cartonsIn || 0) - Number(aggregate._sum.cartonsOut || 0)
 if (net > 0) {
 totalCartons += net
 }
 })

 const transactionSummary = transactionStats.reduce<Record<string, number>>((acc, stat) => {
 acc[stat.transactionType.toLowerCase()] = stat._count._all
 return acc
 }, {})

 return {
 inventory: {
 totalSkus: skuSet.size,
 totalCartons,
 totalPallets: 0,
 totalUnits: 0
 },
 transactions: {
 last30Days: transactionSummary
 },
 invoices: {
 total: 0,
 totalAmount: 0
 },
 users: userCount
 }
 } catch (_error) {
 this.handleError(_error, 'getWarehouseStats')
 }
 }
}
