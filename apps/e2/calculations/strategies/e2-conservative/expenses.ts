/**
 * Operating Expenses Generation for E2 Conservative Strategy
 * Uses expense rules from expense-rules folder
 */

import { EXPENSE_RULES } from './expense-rules/index'
import { seedOfficeEquipment } from './expense-rules/office-equipment'
import { seedDepreciation } from './expense-rules/depreciation'
import { API_BASE, TIMELINE } from './business-logic'

export async function seedExpenses(strategyId: string) {
  console.log('📊 SEEDING OPERATING EXPENSES...')
  
  let totalExpensesCreated = 0
  
  // Process expenses for each year
  for (let year = TIMELINE.START_YEAR; year <= TIMELINE.END_YEAR; year++) {
    const expensesByQuarter: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [] }
    
    // Apply expense rules for each week
    for (let week = 1; week <= 52; week++) {
      if (year === TIMELINE.START_YEAR && week < TIMELINE.PREPARATION_START_WEEK) continue
      
      const quarter = Math.ceil(week / 13)
      
      // Apply each expense rule
      for (const [code, rule] of Object.entries(EXPENSE_RULES)) {
        const expense = rule.getExpense(year, week, quarter)
        if (expense) {
          // Handle combined rules (like payroll that returns multiple expenses)
          if (Array.isArray(expense)) {
            for (const exp of expense) {
              if (exp && exp.code && exp.amount !== undefined) {
                expensesByQuarter[quarter].push({
                  week,
                  rowId: exp.code,
                  value: exp.amount
                })
              }
            }
          } else if (expense.code && expense.amount !== undefined) {
            expensesByQuarter[quarter].push({
              week,
              rowId: expense.code,
              value: expense.amount
            })
          }
        }
      }
    }
    
    // Send expense data to API
    for (let quarter = 1; quarter <= 4; quarter++) {
      if (expensesByQuarter[quarter].length > 0) {
        const response = await fetch(`${API_BASE}/expense-forecast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            changes: expensesByQuarter[quarter],
            year,
            quarter,
            strategyId
          })
        })
        
        if (response.ok) {
          totalExpensesCreated += expensesByQuarter[quarter].length
          console.log(`    ${year} Q${quarter}: ${expensesByQuarter[quarter].length} expense records`)
        }
      }
    }
  }
  
  console.log(`  ✅ Created ${totalExpensesCreated} operating expense records total`)
  
  // Seed office equipment purchases (capital expenditures)
  await seedOfficeEquipment(strategyId)
  
  // Seed depreciation expenses (20% of equipment balance per year)
  await seedDepreciation(strategyId)
  
  return totalExpensesCreated
}