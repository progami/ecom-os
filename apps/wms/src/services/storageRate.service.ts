import { prisma } from '@/lib/prisma'

export interface StorageRateResult {
 ratePerCarton: number
 costRateId: string
 effectiveDate: Date
 rateName: string
}

/**
 * Get the active storage rate for a warehouse on a specific date
 * @param warehouseCode - The warehouse code to lookup rates for
 * @param effectiveDate - The date to find the rate for (defaults to current date)
 * @returns Storage rate information or null if not found
 */
export async function getStorageRate(
 warehouseCode: string, 
 effectiveDate: Date = new Date()
): Promise<StorageRateResult | null> {
 
 // Get active storage rate for warehouse
 const costRate = await prisma.costRate.findFirst({
 where: {
 warehouse: { code: warehouseCode },
 costCategory: 'Storage',
 effectiveDate: { lte: effectiveDate },
 OR: [
 { endDate: null },
 { endDate: { gte: effectiveDate }}
 ],
 isActive: true
 },
 orderBy: { effectiveDate: 'desc' }
 })

 if (!costRate) {
 return null
 }

 return {
 ratePerCarton: Number(costRate.costValue),
 costRateId: costRate.id,
 effectiveDate: costRate.effectiveDate,
 rateName: costRate.costName
 }
}

/**
 * Calculate weekly storage cost
 * @param cartonCount - Number of cartons to calculate cost for
 * @param ratePerCarton - Rate per carton per week
 * @returns Total weekly storage cost
 */
export async function calculateStorageCost(
 cartonCount: number, 
 ratePerCarton: number
): Promise<number> {
 // Weekly storage cost = cartons × rate per carton per week
 return cartonCount * ratePerCarton
}

/**
 * Get storage rates for multiple warehouses
 * @param warehouseCodes - Array of warehouse codes
 * @param effectiveDate - The date to find rates for
 * @returns Map of warehouse code to storage rate
 */
export async function getStorageRatesForWarehouses(
 warehouseCodes: string[],
 effectiveDate: Date = new Date()
): Promise<Map<string, StorageRateResult>> {
 const rates = new Map<string, StorageRateResult>()
 
 for (const warehouseCode of warehouseCodes) {
 const rate = await getStorageRate(warehouseCode, effectiveDate)
 if (rate) {
 rates.set(warehouseCode, rate)
 }
 }
 
 return rates
}

/**
 * Validate that storage rates exist for a warehouse
 * @param warehouseCode - Warehouse code to check
 * @param effectiveDate - Date to check rates for
 * @returns True if valid rate exists, false otherwise
 */
export async function hasValidStorageRate(
 warehouseCode: string,
 effectiveDate: Date = new Date()
): Promise<boolean> {
 const rate = await getStorageRate(warehouseCode, effectiveDate)
 return rate !== null
}