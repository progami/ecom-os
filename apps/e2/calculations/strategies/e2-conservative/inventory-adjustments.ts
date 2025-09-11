#!/usr/bin/env npx tsx
/**
 * Create year-end inventory adjustment entries
 * These balance the inventory asset that appears from the unit-sales calculation
 * Now using dynamic calculation based on actual purchases and COGS
 */

import { API_BASE, TIMELINE, FINANCIAL } from './business-logic'

interface InventoryCalculation {
  year: number
  beginningInventory: number
  purchases: number
  cogs: number
  endingInventory: number
  yearOverYearChange: number
}

/**
 * Extract unit costs from GL entries for each SKU using weighted average
 */
function extractUnitCostsFromEntries(entries: any[]): Record<string, { totalCost: number; units: number; unitCost: number }> {
  const skuCosts: Record<string, { totalCost: number; units: number; unitCost: number }> = {}
  
  // Group entries by order
  const orderGroups: Record<string, any[]> = {}
  
  entries
    .filter(e => 
      ['5020', '5030', '5040', '5031'].includes(e.account) &&
      e.source === 'order-timeline'
    )
    .forEach(entry => {
      const sku = entry.metadata?.sku || ''
      const week = entry.metadata?.week
      const year = entry.metadata?.year
      const orderKey = `${year}-W${week}-${sku}`
      
      if (!orderGroups[orderKey]) {
        orderGroups[orderKey] = []
      }
      orderGroups[orderKey].push(entry)
    })
  
  // Calculate cost per unit for each order
  Object.entries(orderGroups).forEach(([orderKey, orderEntries]) => {
    const sku = orderEntries[0]?.metadata?.sku
    if (!sku) return
    
    // Get units from the manufacturing entry (5020)
    const mfgEntry = orderEntries.find(e => e.account === '5020')
    const units = mfgEntry?.metadata?.quantity || 0
    
    // Sum all costs for this order
    const totalCost = orderEntries.reduce((sum, e) => sum + (e.debit || 0), 0)
    
    if (units > 0) {
      // Use weighted average cost
      if (!skuCosts[sku]) {
        skuCosts[sku] = { totalCost: 0, units: 0, unitCost: 0 }
      }
      
      // Accumulate for weighted average
      skuCosts[sku].totalCost += totalCost
      skuCosts[sku].units += units
      skuCosts[sku].unitCost = skuCosts[sku].totalCost / skuCosts[sku].units
    }
  })
  
  return skuCosts
}

/**
 * Calculate inventory for a specific year dynamically
 */
async function calculateYearInventory(year: number, beginningInventory: number = 0): Promise<InventoryCalculation> {
  // Determine date range
  const startDate = FINANCIAL.INVENTORY_ADJUSTMENT_START_DATE(year)
  const endDate = `${year}-12-31`
  
  // Fetch GL entries for the year
  const glResponse = await fetch(`${API_BASE}/gl/raw-entries?startDate=${startDate}&endDate=${endDate}`)
  const { entries } = await glResponse.json()
  
  // Calculate total purchases - include ALL manufacturing costs, not just order-timeline
  const purchases = entries
    .filter((e: any) => 
      ['5020', '5030', '5040', '5031'].includes(e.account)
      // Remove source filter to include one-time manufacturing payments
    )
    .reduce((sum: number, e: any) => sum + (e.debit || 0), 0)
  
  // Fetch unit sales for the year
  const salesResponse = await fetch(`${API_BASE}/unit-sales?year=${year}`)
  const { unitSales } = await salesResponse.json()
  
  // Extract unit costs from GL entries (weighted average)
  const skuCosts = extractUnitCostsFromEntries(entries)
  
  // Calculate COGS
  let totalCOGS = 0
  
  unitSales.forEach((sale: any) => {
    const sku = sale.sku
    const units = sale.units || 0
    
    const skuCostInfo = skuCosts[sku]
    if (skuCostInfo) {
      const cogs = units * skuCostInfo.unitCost
      totalCOGS += cogs
    }
  })
  
  // Calculate ending inventory
  const endingInventory = beginningInventory + purchases - totalCOGS
  const yearOverYearChange = endingInventory - beginningInventory
  
  console.log(`Year ${year}: Purchases=$${purchases.toFixed(0)}, COGS=$${totalCOGS.toFixed(0)}, Ending Inventory=$${endingInventory.toFixed(0)}`)
  
  return {
    year,
    beginningInventory,
    purchases,
    cogs: totalCOGS,
    endingInventory,
    yearOverYearChange
  }
}

async function createInventoryAdjustments(strategyId?: string) {
  console.log('Creating year-end inventory adjustments...')
  
  // Calculate inventory dynamically for all years
  let runningInventory = 0
  
  for (let year = TIMELINE.START_YEAR; year <= TIMELINE.END_YEAR; year++) {
    const calc = await calculateYearInventory(year, runningInventory)
    const inventoryChange = calc.yearOverYearChange
    runningInventory = calc.endingInventory
    
    if (inventoryChange !== 0) {
      console.log(`\nYear ${year}: Creating adjustment for $${inventoryChange.toFixed(2)} (${inventoryChange > 0 ? 'increase' : 'decrease'})`)
      
      // Create GL entries using expense-forecast API with changes array
      const changes = [
        // Credit to Contra-COGS account (5025) - reduces COGS expense when inventory increases
        {
          week: 52,
          rowId: '5025',
          value: -inventoryChange, // Negative when inventory increases (reduces expense)
          description: `Year-end inventory adjustment - ${inventoryChange > 0 ? 'capitalize unsold goods' : 'expense from inventory'}`
        },
        // Debit to Inventory (1200)
        {
          week: 52,
          rowId: '1200',
          value: inventoryChange, // Positive when inventory increases
          description: `Year-end inventory adjustment - ${inventoryChange > 0 ? 'increase inventory asset' : 'reduce inventory asset'}`
        }
      ]
      
      // Post to expense-forecast API
      const response = await fetch(`${API_BASE}/expense-forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes,
          year,
          quarter: 4,
          strategyId: strategyId || null // Use provided strategyId or active
        })
      })
      
      if (response.ok) {
        console.log(`  ✅ Created adjustment entries for ${year}`)
      } else {
        const error = await response.text()
        console.error(`  ❌ Failed for ${year}: ${error}`)
      }
    }
  }
}

export default createInventoryAdjustments

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createInventoryAdjustments().catch(console.error)
}