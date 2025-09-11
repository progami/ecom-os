/**
 * Depreciation Expense Rule
 * Creates depreciation entries at 20% per year of Office Equipment balance
 */

import { API_BASE } from '../business-logic'

export async function seedDepreciation(strategyId: string) {
  console.log('  📉 Creating depreciation entries...')
  
  let totalCreated = 0
  
  // Office Equipment purchases by year
  const equipmentBalances = {
    2025: 1000,
    2026: 2000,    // cumulative: 1000 + 1000
    2027: 3000,    // cumulative: 2000 + 1000
    2028: 4000,    // cumulative: 3000 + 1000
    2029: 104000,  // cumulative: 4000 + 100000
    2030: 204000   // cumulative: 104000 + 100000
  }
  
  for (let year = 2025; year <= 2030; year++) {
    // Calculate annual depreciation as 20% of cumulative equipment balance
    const annualDepreciation = equipmentBalances[year] * 0.20
    
    // Put depreciation in Q4, week 52 (end of year)
    const response = await fetch(`${API_BASE}/expense-forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: [{
          week: 52,
          rowId: '5720', // This will trigger special depreciation handling
          value: annualDepreciation
        }],
        year,
        quarter: 4,
        strategyId
      })
    })
    
    if (response.ok) {
      totalCreated++
      console.log(`    ${year}: $${annualDepreciation.toLocaleString()} depreciation (20% of $${equipmentBalances[year].toLocaleString()})`)
    } else {
      const error = await response.text()
      console.error(`    ${year}: FAILED - ${response.status} ${response.statusText}`)
      console.error(`    Error: ${error}`)
    }
  }
  
  console.log(`    ✅ Created ${totalCreated} years of depreciation entries`)
  return totalCreated
}