/**
 * Amazon Storage AWD (Account 5032) expense rule
 * Calculates Amazon AWD storage costs based on sales volume
 * Formula: units * warehouseCost (AWD cost per unit from products)
 */

import { ExpenseRule } from '../types'

import { API_BASE } from '../business-logic'

export const amazonStorageAWD: ExpenseRule = {
  name: 'Amazon Storage AWD',
  account: '5032',
  accountCategory: 'Expense',
  
  async calculate(context) {
    const { week, year, quarter, strategyId } = context
    const entries = []
    
    // Get sales data for the week
    const salesRes = await fetch(`${API_BASE}/unit-sales?year=${year}&quarter=${quarter}&week=${week}&strategyId=${strategyId}`)
    if (!salesRes.ok) {
      console.error(`Failed to fetch sales for ${year} Q${quarter} W${week}`)
      return []
    }
    const salesResponse = await salesRes.json()
    const salesData = salesResponse.unitSales || salesResponse || []
    
    // Get products with AWD costs
    const productsRes = await fetch(`${API_BASE}/products?strategyId=${strategyId}`)
    if (!productsRes.ok) {
      console.error('Failed to fetch products')
      return []
    }
    const products = await productsRes.json()
    
    // Create AWD cost map
    const awdCostMap: Record<string, number> = {}
    for (const product of products) {
      awdCostMap[product.sku] = product.warehouseCost || 0
    }
    
    // Calculate AWD storage costs per SKU
    let totalAWDCost = 0
    const skuDetails: string[] = []
    
    // Ensure salesData is an array
    const sales = Array.isArray(salesData) ? salesData : []
    
    for (const sale of sales) {
      const awdCost = (awdCostMap[sale.sku] || 0) * sale.units
      if (awdCost > 0) {
        totalAWDCost += awdCost
        skuDetails.push(`${sale.sku}: ${sale.units} units`)
      }
    }
    
    if (totalAWDCost > 0) {
      // Helper to get week dates
      const firstDayOfYear = new Date(year, 0, 1)
      const dayOfWeek = firstDayOfYear.getDay()
      const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek)
      const firstMonday = new Date(year, 0, 1 + daysToMonday)
      const weekStart = new Date(firstMonday)
      weekStart.setDate(firstMonday.getDate() + (week - 1) * 7)
      
      // Create expense entry (debit expense, credit cash)
      entries.push({
        date: weekStart.toISOString(),
        account: '5032',
        accountCategory: 'Expense',
        description: `Storage AWD - W${week} (${skuDetails.join(', ')})`,
        debit: totalAWDCost,
        credit: 0,
        reference: `AWD-${year}-W${week}`,
        source: 'expense-rule',
        metadata: { 
          expenseRule: 'amazonStorageAWD', 
          week, 
          year, 
          quarter,
          units: sales.reduce((sum: number, s: any) => sum + s.units, 0)
        }
      })
      
      entries.push({
        date: weekStart.toISOString(),
        account: '1000',
        accountCategory: 'Asset',
        description: `Storage AWD - W${week} (${skuDetails.join(', ')})`,
        debit: 0,
        credit: totalAWDCost,
        reference: `AWD-${year}-W${week}`,
        source: 'expense-rule',
        metadata: { 
          expenseRule: 'amazonStorageAWD', 
          week, 
          year, 
          quarter 
        }
      })
    }
    
    return entries
  }
}