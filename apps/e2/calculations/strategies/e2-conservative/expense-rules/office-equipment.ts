/**
 * Office Equipment Expense Rule
 * Capital expenditures that go to Asset account 1700
 * $1,000/year for 2025-2028, $100,000/year for 2029-2030
 */

import { API_BASE } from '../business-logic'

export async function createOfficeEquipmentExpenses(strategyId: string, year: number, quarter: number) {
  // Determine annual equipment spend based on year
  const annualSpend = year >= 2029 ? 100000 : 1000
  const quarterlySpend = annualSpend / 4
  
  // Only purchase equipment in Q2 (mid-year) to simplify
  if (quarter !== 2) {
    return []
  }
  
  const expenses: any[] = []
  const week = 20 // Mid-Q2
  
  expenses.push({
    strategyId,
    date: new Date(year, 4, 15), // May 15
    weekStarting: new Date(year, 4, 15),
    category: 'Office Equipment',
    subcategory: 'Capital Expenditure',
    description: `Office Equipment Purchase - ${year}`,
    amount: annualSpend,
    type: 'capital',
    isCapex: true,
    accountCode: '1700' // Office Equipment asset account
  })
  
  return expenses
}

export async function seedOfficeEquipment(strategyId: string) {
  console.log('  📦 Creating office equipment purchases...')
  
  let totalCreated = 0
  
  for (let year = 2025; year <= 2030; year++) {
    const annualSpend = year >= 2029 ? 100000 : 1000
    
    // Use expense-forecast API - it now correctly creates Asset GL entries for account 1700
    // Put in Q4, week 40 (first week of Q4)
    const response = await fetch(`${API_BASE}/expense-forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: [{
          week: 40,
          rowId: '1700', // Office Equipment account
          value: annualSpend
        }],
        year,
        quarter: 4,
        strategyId
      })
    })
    
    if (response.ok) {
      totalCreated++
      console.log(`    ${year}: $${annualSpend.toLocaleString()} equipment`)
    } else {
      const error = await response.text()
      console.error(`    ${year}: FAILED - ${response.status} ${response.statusText}`)
      console.error(`    Error: ${error}`)
    }
  }
  
  console.log(`    ✅ Created ${totalCreated} years of equipment purchases`)
  return totalCreated
}