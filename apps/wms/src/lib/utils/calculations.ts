/**
 * Common calculation utilities
 */

/**
 * Sum a numeric property from an array of objects
 * @param items Array of objects
 * @param key Property key to sum
 * @returns Total sum
 */
export function sumBy<T>(items: T[], key: keyof T): number {
 if (!items || !Array.isArray(items)) return 0
 return items.reduce((sum, item) => {
 const value = item[key]
 return sum + (typeof value === 'number' ? value : 0)
 }, 0)
}

/**
 * Sum using a custom getter function
 * @param items Array of items
 * @param getter Function to extract numeric value from each item
 * @returns Total sum
 */
export function sum<T>(items: T[], getter: (item: T) => number): number {
 return items.reduce((total, item) => total + getter(item), 0)
}

/**
 * Calculate totals for shipment items
 * @param items Array of shipment line items
 * @returns Object with total cartons, pallets, and units
 */
export function calculateShipmentTotals(items: Array<{ cartons: number; pallets: number; units: number }>) {
 return {
 totalCartons: sumBy(items, 'cartons'),
 totalPallets: sumBy(items, 'pallets'),
 totalUnits: sumBy(items, 'units')
 }
}

/**
 * Calculate cost totals by category
 * @param costs Array of cost entries
 * @returns Object with totals by cost type
 */
export function calculateCostTotals<T extends { costType: string; totalCost: number }>(costs: T[]) {
 const totals: Record<string, number> = {}
 
 costs.forEach(cost => {
 totals[cost.costType] = (totals[cost.costType] || 0) + cost.totalCost
 })
 
 totals.total = sum(costs, cost => cost.totalCost)
 
 return totals
}

/**
 * Group and sum by a property
 * @param items Array of items
 * @param groupKey Property to group by
 * @param sumKey Property to sum
 * @returns Map of group key to sum
 */
export function groupAndSum<T>(
 items: T[],
 groupKey: keyof T,
 sumKey: keyof T
): Map<string, number> {
 const result = new Map<string, number>()
 
 items.forEach(item => {
 const group = String(item[groupKey])
 const value = item[sumKey]
 const numValue = typeof value === 'number' ? value : 0
 
 result.set(group, (result.get(group) || 0) + numValue)
 })
 
 return result
}

/**
 * Calculate percentage
 * @param value Current value
 * @param total Total value
 * @param decimals Number of decimal places
 * @returns Percentage string
 */
export function calculatePercentage(value: number, total: number, decimals = 1): string {
 if (total === 0) return '0%'
 return ((value / total) * 100).toFixed(decimals) + '%'
}

/**
 * Calculate unit costs
 * @param totalCost Total cost
 * @param quantity Quantity
 * @param decimals Number of decimal places
 * @returns Unit cost
 */
export function calculateUnitCost(totalCost: number, quantity: number, decimals = 2): number {
 if (quantity === 0) return 0
 return Number((totalCost / quantity).toFixed(decimals))
}