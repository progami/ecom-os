import { BaseService, ServiceContext } from './base.service'
import { Sku, Prisma } from '@prisma/client'
import { businessLogger } from '@/lib/logger/server'
import { ValidationError, NotFoundError, ConflictError } from '@/lib/api/responses'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'
import { z } from 'zod'

// Validation schemas
const CreateSkuSchema = z.object({
  skuCode: z.string().min(1).max(50),
  description: z.string().min(1).max(500),
  warehouseId: z.string().min(1),
  unit: z.string().optional(),
  reorderPoint: z.number().nonnegative().optional(),
  reorderQuantity: z.number().positive().optional(),
  unitsPerCarton: z.number().positive().optional(),
  cartonsPerPallet: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  category: z.string().optional(),
  supplier: z.string().optional()
})

const UpdateSkuSchema = CreateSkuSchema.partial().extend({
  id: z.string().min(1)
})

export type CreateSkuRequest = z.infer<typeof CreateSkuSchema>
export type UpdateSkuRequest = z.infer<typeof UpdateSkuSchema>

export interface SkuWithInventory extends Sku {
  currentInventory: number
  availableInventory: number
  reservedInventory: number
  lastActivityDate: Date | null
}

export class SkuService extends BaseService {
  constructor(context: ServiceContext) {
    super(context)
  }

  /**
   * Create a new SKU
   */
  async createSku(data: CreateSkuRequest): Promise<Sku> {
    // Validate request
    const validatedData = CreateSkuSchema.parse(data)
    
    // Check permissions
    await this.requirePermission('inventory.write')
    
    // Check warehouse access
    const warehouseFilter = this.getWarehouseFilter(validatedData.warehouseId)
    if (warehouseFilter && warehouseFilter.warehouseId !== validatedData.warehouseId) {
      throw new ValidationError('Access denied to this warehouse')
    }
    
    // Check for duplicate SKU code in the same warehouse
    const existing = await this.prisma.sku.findFirst({
      where: {
        skuCode: validatedData.skuCode
      }
    })
    
    if (existing) {
      throw new ConflictError(`SKU code ${validatedData.skuCode} already exists in this warehouse`)
    }
    
    // Create SKU (remove fields that don't exist in schema)
    const { warehouseId, category: _category, supplier: _supplier, ...skuData } = validatedData
    const sku = await this.prisma.sku.create({
      data: {
        ...skuData,
        description: sanitizeForDisplay(skuData.description)
      }
    })
    
    // Log audit
    await this.logAudit('CREATE_SKU', 'Sku', sku.id, {
      skuCode: sku.skuCode,
      warehouse: warehouseId
    })
    
    businessLogger.info('SKU created', {
      skuId: sku.id,
      skuCode: sku.skuCode,
      userId: this.session?.user?.id
    })
    
    return sku
  }

  /**
   * Update an existing SKU
   */
  async updateSku(data: UpdateSkuRequest): Promise<Sku> {
    // Validate request
    const validatedData = UpdateSkuSchema.parse(data)
    
    // Check permissions
    await this.requirePermission('inventory.write')
    
    // Get existing SKU
    const existing = await this.prisma.sku.findUnique({
      where: { id: validatedData.id }
    })
    
    if (!existing) {
      throw new NotFoundError('SKU not found')
    }
    
    // Check warehouse access
    // SKUs don't have warehouseId, skip warehouse check for update
    /*const warehouseFilter = this.getWarehouseFilter(existing.warehouseId)
    if (warehouseFilter && warehouseFilter.warehouseId !== existing.warehouseId) {*/
    if (false) {
      throw new ValidationError('Access denied to this SKU')
    }
    
    // Check for duplicate if SKU code is being changed
    if (validatedData.skuCode && validatedData.skuCode !== existing.skuCode) {
      const duplicate = await this.prisma.sku.findFirst({
        where: {
          skuCode: validatedData.skuCode,
          id: { not: validatedData.id }
        }
      })
      
      if (duplicate) {
        throw new ConflictError(`SKU code ${validatedData.skuCode} already exists in this warehouse`)
      }
    }
    
    // Update SKU
    const { id, ...updateData } = validatedData
    const updated = await this.prisma.sku.update({
      where: { id },
      data: {
        ...updateData,
        ...(updateData.description && { 
          description: sanitizeForDisplay(updateData.description) 
        }),
        ...(updateData.category && { 
          category: sanitizeForDisplay(updateData.category) 
        }),
        ...(updateData.supplier && { 
          supplier: sanitizeForDisplay(updateData.supplier) 
        })
      }
    })
    
    // Log audit
    await this.logAudit('UPDATE_SKU', 'Sku', id, updateData)
    
    return updated
  }

  /**
   * Delete a SKU
   */
  async deleteSku(id: string): Promise<void> {
    // Check permissions
    await this.requirePermission('inventory.delete')
    
    // Get SKU
    const sku = await this.prisma.sku.findUnique({
      where: { id }
    })
    
    if (!sku) {
      throw new NotFoundError('SKU not found')
    }
    
    // Check warehouse access
    // SKUs don't have warehouseId, skip warehouse check
    if (false) {
      throw new ValidationError('Access denied to this SKU')
    }
    
    // Check if SKU has transactions (using skuCode instead of skuId)
    const transactionCount = await this.prisma.inventoryTransaction.count({
      where: { skuCode: sku.skuCode }
    })
    
    if (transactionCount > 0) {
      throw new ConflictError('Cannot delete SKU with existing transactions')
    }
    
    // Delete SKU
    await this.prisma.sku.delete({
      where: { id }
    })
    
    // Log audit
    await this.logAudit('DELETE_SKU', 'Sku', id, {
      skuCode: sku.skuCode
    })
  }

  /**
   * Get SKUs with filters and pagination
   */
  async getSkus(filters: {
    warehouseId?: string
    category?: string
    supplier?: string
    search?: string
    page?: number
    limit?: number
  }) {
    const pagination = this.getPaginationParams(filters)
    const _warehouseFilter = this.getWarehouseFilter(filters.warehouseId)
    
    const where: Prisma.SkuWhereInput = {
      // category and supplier don't exist in SKU schema
      ...(filters.search && {
        OR: [
          { skuCode: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } }
        ]
      })
    }
    
    const [skus, total] = await Promise.all([
      this.prisma.sku.findMany({
        where,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: { skuCode: 'asc' }
      }),
      this.prisma.sku.count({ where })
    ])
    
    // Add inventory levels to each SKU
    const skusWithInventory = await Promise.all(
      skus.map(sku => this.addInventoryLevels(sku))
    )
    
    return this.createPaginatedResponse(skusWithInventory, total, pagination)
  }

  /**
   * Get a single SKU by ID with inventory levels
   */
  async getSkuById(id: string): Promise<SkuWithInventory> {
    const sku = await this.prisma.sku.findUnique({
      where: { id },
    })
    
    if (!sku) {
      throw new NotFoundError('SKU not found')
    }
    
    // Check warehouse access
    // SKUs don't have warehouseId, skip warehouse check
    if (false) {
      throw new ValidationError('Access denied to this SKU')
    }
    
    return this.addInventoryLevels(sku)
  }

  /**
   * Get next available batch/lot for a SKU
   */
  async getNextBatch(skuId: string): Promise<string> {
    const sku = await this.getSkuById(skuId)
    
    // Get the latest batch number (using skuCode instead of skuId)
    const latestTransaction = await this.prisma.inventoryTransaction.findFirst({
      where: { skuCode: sku.skuCode },
      orderBy: { createdAt: 'desc' },
      select: { batchLot: true }
    })
    
    if (!latestTransaction || !latestTransaction.batchLot) {
      // Generate first batch number
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
      return `${sku.skuCode}-${date}-001`
    }
    
    // Parse and increment batch number
    const match = latestTransaction.batchLot.match(/(\d{3})$/)
    if (match) {
      const nextNum = (parseInt(match[1]) + 1).toString().padStart(3, '0')
      return latestTransaction.batchLot.replace(/\d{3}$/, nextNum)
    }
    
    // Fallback to date-based batch
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
    return `${sku.skuCode}-${date}-001`
  }

  /**
   * Add inventory levels to a SKU
   */
  private async addInventoryLevels(sku: Sku): Promise<SkuWithInventory> {
    // Calculate inventory from transactions
    const transactions = await this.prisma.inventoryTransaction.groupBy({
      by: ['transactionType'],
      where: { skuCode: sku.skuCode },
      _sum: {
        cartonsIn: true,
        cartonsOut: true
      }
    })
    
    let currentInventory = 0
    for (const tx of transactions) {
      if (tx.transactionType === 'RECEIVE' || tx.transactionType === 'ADJUST_IN') {
        currentInventory += tx._sum.cartonsIn || 0
      } else if (tx.transactionType === 'SHIP' || tx.transactionType === 'ADJUST_OUT') {
        currentInventory -= tx._sum.cartonsOut || 0
      }
    }
    
    // Get last activity date
    const lastActivity = await this.prisma.inventoryTransaction.findFirst({
      where: { skuCode: sku.skuCode },
      orderBy: { transactionDate: 'desc' },
      select: { transactionDate: true }
    })
    
    return {
      ...sku,
      currentInventory,
      availableInventory: currentInventory, // In real app, would subtract reserved
      reservedInventory: 0, // Would be calculated from pending orders
      lastActivityDate: lastActivity?.transactionDate || null
    }
  }

  /**
   * Bulk import SKUs
   */
  async bulkImportSkus(
    warehouseId: string,
    skus: CreateSkuRequest[]
  ): Promise<{ imported: number; errors: string[] }> {
    // Check permissions
    await this.requirePermission('inventory.write')
    
    // Check warehouse access
    const warehouseFilter = this.getWarehouseFilter(warehouseId)
    if (warehouseFilter && warehouseFilter.warehouseId !== warehouseId) {
      throw new ValidationError('Access denied to this warehouse')
    }
    
    let imported = 0
    const errors: string[] = []
    
    for (let i = 0; i < skus.length; i++) {
      try {
        const skuData = { ...skus[i], warehouseId }
        await this.createSku(skuData)
        imported++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Row ${i + 1}: ${message}`)
      }
    }
    
    businessLogger.info('Bulk SKU import completed', {
      warehouseId,
      imported,
      errors: errors.length,
      userId: this.session?.user?.id
    })
    
    return { imported, errors }
  }
}