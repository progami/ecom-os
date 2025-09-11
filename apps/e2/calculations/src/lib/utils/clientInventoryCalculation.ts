// Client-side inventory calculation utilities
// Mirrors the logic from DynamicInventoryService but works with fetched data

export interface ClientInventoryCalculation {
  beginningInventory: number
  purchases: number
  cogs: number
  endingInventory: number
  details: {
    purchasesByAccount: Record<string, number>
    unitCosts: Record<string, number>
    unitsSold: Record<string, number>
    cogsBreakdown: Record<string, number>
  }
}

/**
 * Extract unit costs from GL entries by parsing descriptions
 * Returns full unit cost (manufacturing + freight + tariffs) per SKU
 */
function extractUnitCosts(glEntries: any[]): Record<string, number> {
  // Group entries by SKU and account type
  const skuData: Record<string, {
    costs: { [account: string]: number }
    units: { [account: string]: number }
  }> = {}

  glEntries.forEach(entry => {
    // Parse SKU and units from description
    // Format: "Manufacturing for PACK6-7M - 12544 units"
    const match = entry.description?.match(/(PACK\d+-\d+M).*?(\d+)\s+units/)
    if (match) {
      const sku = match[1]
      const units = parseInt(match[2])
      const cost = Number(entry.debit) || 0

      if (!skuData[sku]) {
        skuData[sku] = { costs: {}, units: {} }
      }

      // Accumulate costs and units by account
      skuData[sku].costs[entry.account] = (skuData[sku].costs[entry.account] || 0) + cost
      skuData[sku].units[entry.account] = (skuData[sku].units[entry.account] || 0) + units
    }
  })

  // Calculate full unit cost for each SKU
  const unitCosts: Record<string, number> = {}
  
  Object.entries(skuData).forEach(([sku, data]) => {
    let totalCost = 0
    let totalUnits = 0

    // Sum all costs (5020 + 5030 + 5040 + 5031)
    Object.values(data.costs).forEach(cost => {
      totalCost += cost
    })

    // Use the units from manufacturing (5020) as the base
    // All accounts should have the same units for a given order
    totalUnits = data.units['5020'] || Object.values(data.units)[0] || 1

    unitCosts[sku] = totalUnits > 0 ? totalCost / totalUnits : 0
  })

  return unitCosts
}

/**
 * Calculate inventory for a given period from GL entries and unit sales
 * @param glEntries - GL entries for the period
 * @param unitSales - Unit sales for the period  
 * @param startDate - Period start date
 * @param endDate - Period end date
 * @param beginningInventory - Starting inventory value (default 0)
 */
export function calculateInventoryFromData(
  glEntries: any[],
  unitSales: any[],
  startDate: Date,
  endDate: Date,
  beginningInventory: number = 0
): ClientInventoryCalculation {
  // 1. Get purchases from GL (5020, 5030, 5040, 5031 with source='order-timeline')
  const purchaseEntries = glEntries.filter(entry => {
    const entryDate = new Date(entry.date)
    return ['5020', '5030', '5040', '5031'].includes(entry.account) &&
           entry.source === 'order-timeline' &&
           entryDate >= startDate &&
           entryDate <= endDate
  })

  // Calculate total purchases and breakdown by account
  const purchasesByAccount: Record<string, number> = {}
  let totalPurchases = 0

  purchaseEntries.forEach(entry => {
    const amount = Number(entry.debit) || 0
    purchasesByAccount[entry.account] = (purchasesByAccount[entry.account] || 0) + amount
    totalPurchases += amount
  })

  // 2. Extract unit costs from GL entries
  const unitCosts = extractUnitCosts(purchaseEntries)

  // 3. Filter unit sales for the period
  const periodSales = unitSales.filter(sale => {
    // Unit sales have year/week fields, not weekStarting
    if (!sale.year || sale.week === undefined) return false
    
    const saleYear = sale.year
    
    // For yearly filtering, just check the year
    const startYear = startDate.getFullYear()
    const endYear = endDate.getFullYear()
    
    // For quarterly/monthly, we'd need more complex logic
    // But for now, yearly comparison is sufficient
    return saleYear >= startYear && saleYear <= endYear
  })

  // 4. Calculate COGS from units sold × full unit cost
  const unitsSold: Record<string, number> = {}
  const cogsBreakdown: Record<string, number> = {}
  let totalCOGS = 0

  periodSales.forEach(sale => {
    // Convert sale SKU format (e.g., "6PK - 7M") to match GL format (e.g., "PACK6-7M")
    let glSku = sale.sku
    if (sale.sku && sale.sku.includes('PK')) {
      const match = sale.sku.match(/(\d+)PK\s*-\s*(\d+M)/)
      if (match) {
        glSku = `PACK${match[1]}-${match[2]}`
      }
    }
    
    const unitCost = unitCosts[glSku] || unitCosts[sale.sku] || 0
    const cogs = sale.units * unitCost
    
    unitsSold[sale.sku] = (unitsSold[sale.sku] || 0) + sale.units
    cogsBreakdown[sale.sku] = (cogsBreakdown[sale.sku] || 0) + cogs
    totalCOGS += cogs
  })

  // 5. Calculate ending inventory
  const endingInventory = beginningInventory + totalPurchases - totalCOGS
  
  // Always log for debugging
  console.log(`Inventory Calc for ${startDate.getFullYear()}:`, {
    beginningInventory,
    totalPurchases,
    totalCOGS,
    endingInventory,
    periodSalesCount: periodSales.length,
    unitsSold,
    unitCosts
  })

  return {
    beginningInventory,
    purchases: totalPurchases,
    cogs: totalCOGS,
    endingInventory: Math.max(0, endingInventory), // Don't show negative inventory
    details: {
      purchasesByAccount,
      unitCosts,
      unitsSold,
      cogsBreakdown
    }
  }
}