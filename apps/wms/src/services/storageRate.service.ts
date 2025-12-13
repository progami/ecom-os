import { prisma } from '@/lib/prisma'

export interface StorageRateResult {
 ratePerPalletDay: number
 costRateId: string
 effectiveDate: Date
}

export type StorageTier = 'STANDARD' | 'SIX_PLUS'

function storageCostNameForTier(tier: StorageTier) {
 return tier === 'SIX_PLUS' ? 'Warehouse Storage (6+ Months)' : 'Warehouse Storage'
}

/**
 * Get the active storage rate for a warehouse on a specific date
 * @param warehouseCode - The warehouse code to lookup rates for
 * @param effectiveDate - The date to find the rate for (defaults to current date)
 * @param tier - Storage tier for age-based pricing
 * @returns Storage rate information or null if not found
 */
export async function getStorageRate(
 warehouseCode: string, 
 effectiveDate: Date = new Date(),
 tier: StorageTier = 'STANDARD'
): Promise<StorageRateResult | null> {
 const requestedCostName = storageCostNameForTier(tier)
 
 // Get active storage rate for warehouse
 const costRate = await prisma.costRate.findFirst({
 where: {
 warehouse: { code: warehouseCode },
 costCategory: 'Storage',
 costName: requestedCostName,
 effectiveDate: { lte: effectiveDate },
 OR: [{ endDate: null }, { endDate: { gte: effectiveDate } }],
 isActive: true,
 },
 orderBy: { effectiveDate: 'desc' },
 })

 const resolved =
 costRate ??
 (tier === 'SIX_PLUS'
 ? await prisma.costRate.findFirst({
 where: {
 warehouse: { code: warehouseCode },
 costCategory: 'Storage',
 costName: storageCostNameForTier('STANDARD'),
 effectiveDate: { lte: effectiveDate },
 OR: [{ endDate: null }, { endDate: { gte: effectiveDate } }],
 isActive: true,
 },
 orderBy: { effectiveDate: 'desc' },
 })
 : null)

 if (!resolved) {
 return null
 }

 return {
 ratePerPalletDay: Number(resolved.costValue),
 costRateId: resolved.id,
 effectiveDate: resolved.effectiveDate
 }
}

/**
 * Calculate weekly storage cost
 * @param palletDays - Sum of daily pallet counts
 * @param ratePerPalletDay - Rate per pallet per day
 * @returns Total weekly storage cost
 */
export async function calculateStorageCost(
 palletDays: number,
 ratePerPalletDay: number
): Promise<number> {
 return palletDays * ratePerPalletDay
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
