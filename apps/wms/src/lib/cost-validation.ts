import { prisma } from '@/lib/prisma'
import { CostCategory } from '@prisma/client'

/**
 * Validates that cost entries match defined cost rates for a warehouse
 */
export async function validateCostAgainstRates(
 warehouseCode: string,
 costCategory: CostCategory,
 costName: string
): Promise<{ valid: boolean; message?: string }> {
 // Get warehouse
 const warehouse = await prisma.warehouse.findUnique({
 where: { code: warehouseCode }
 })
 
 if (!warehouse) {
 return { 
 valid: false, 
 message: `Warehouse ${warehouseCode} not found` 
 }
 }
 
 // Check if a cost rate exists for this category and warehouse
 const costRate = await prisma.costRate.findFirst({
 where: {
 warehouseId: warehouse.id,
 costCategory: costCategory,
 costName: costName
 }
 })
 
 if (!costRate) {
 // Check if ANY rate exists for this category
 const categoryRate = await prisma.costRate.findFirst({
 where: {
 warehouseId: warehouse.id,
 costCategory: costCategory
 }
 })
 
 if (!categoryRate) {
 return {
 valid: false,
 message: `No ${costCategory} cost rates defined for warehouse ${warehouseCode}`
 }
 }
 
 return {
 valid: false,
 message: `Cost rate "${costName}" not found for ${costCategory} in warehouse ${warehouseCode}`
 }
 }
 
 return { valid: true }
}

/**
 * Get valid cost categories for a warehouse
 */
export async function getValidCostCategories(warehouseCode: string): Promise<CostCategory[]> {
 const warehouse = await prisma.warehouse.findUnique({
 where: { code: warehouseCode },
 include: {
 costRates: {
 select: {
 costCategory: true
 },
 distinct: ['costCategory']
 }
 }
 })
 
 if (!warehouse) return []
 
 return warehouse.costRates.map(r => r.costCategory)
}

/**
 * Get cost rate for specific category and warehouse
 */
export async function getCostRate(
 warehouseCode: string,
 costCategory: CostCategory,
 costName?: string
) {
 const warehouse = await prisma.warehouse.findUnique({
 where: { code: warehouseCode }
 })
 
 if (!warehouse) return null
 
 return await prisma.costRate.findFirst({
 where: {
 warehouseId: warehouse.id,
 costCategory: costCategory,
 ...(costName && { costName })
 }
 })
}