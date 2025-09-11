/**
 * Bank Statement Expenses - Actual Paid Expenses from Bank Records
 * Source: X-E2 Visa Documentation PDF Invoices + Transferred Payroll
 */

export const BANK_STATEMENT_EXPENSES = [
  // Legal & Compliance (5410)
  {
    date: new Date('2025-03-19'),
    description: 'Texas Secretary of State Filing - Targon LLC',
    amount: 1.00,
    category: '5410'
  },
  {
    date: new Date('2025-09-01'),
    description: 'Trademark Attorney Invoice - Muhammad Hassan',
    amount: 1420.00,
    category: '5410'
  },
  
  // IT Software - Business Research Tools (5500)
  {
    date: new Date('2025-04-27'),
    description: 'Amazon Competitor Research Order - Drop Cloths',
    amount: 17.99,
    category: '5500'
  },
  
  // IT Software (5500)
  {
    date: new Date('2025-06-20'),
    description: 'Claude AI - Max Plan 5x (June)',
    amount: 106.60,
    category: '5500'
  },
  {
    date: new Date('2025-06-20'),
    description: 'Claude AI - Upgrade to Max Plan 20x',
    amount: 106.65,
    category: '5500'
  },
  {
    date: new Date('2025-07-20'),
    description: 'Claude AI - Max Plan 20x (July)',
    amount: 213.20,
    category: '5500'
  },
  {
    date: new Date('2025-07-31'),
    description: 'Google Workspace Business Standard (July)',
    amount: 59.49,
    category: '5500'
  },
  {
    date: new Date('2025-08-01'),
    description: 'AWS Services Invoice - July 2025',
    amount: 33.44,
    category: '5500'
  },
  {
    date: new Date('2025-08-20'),
    description: 'Claude AI - Max Plan 20x (August)',
    amount: 213.20,
    category: '5500'
  },
  {
    date: new Date('2025-08-31'),
    description: 'Google Workspace Business Standard (August)',
    amount: 73.35,
    category: '5500'
  },
  {
    date: new Date('2025-09-01'),
    description: 'AWS Services Invoice - August 2025',
    amount: 33.53,
    category: '5500'
  },
  {
    date: new Date('2025-09-03'),
    description: 'Cloudflare Domain Registration - caelumstar.net',
    amount: 11.86,
    category: '5500'
  },
  
  // Payroll & Payroll Tax (Transferred from recurring)
  {
    date: new Date('2025-08-27'),
    description: 'August Payroll - Manager (from bank statement)',
    amount: 3229.21,
    category: '5100'
  },
  {
    date: new Date('2025-08-27'),
    description: 'August Payroll Tax - Manager (from bank statement)',
    amount: 770.79,
    category: '5110'
  },

]

// Note: Manufacturing expenses handled separately via order forecast system:
// - D-1 Manufacturing Invoice July 2025: $32,567.196 (accounted via COGS)
// - D-6 Packaging Invoice August 2025: $5,321.794 (accounted via COGS)
// 
// Note: Excluded pending invoices:
// - D-2_Proforma_Invoice_July2025_13831.pdf ($13,830.768) - PENDING
// - D-3_Proforma_Invoice_Aug2025_1385.pdf ($1,385) - PENDING

export async function seedBankStatementExpenses(strategyId: string, API_BASE: string) {
  console.log('🏦 CREATING BANK STATEMENT EXPENSES...')
  
  let created = 0
  let failed = 0
  
  for (const expense of BANK_STATEMENT_EXPENSES) {
    try {
      const response = await fetch(`${API_BASE}/expense-forecast/onetime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: expense.date.toISOString().split('T')[0],
          description: expense.description,
          category: expense.category,
          amount: expense.amount,
          strategyId: strategyId
        })
      })
      
      if (response.ok) {
        console.log(`  ✅ Created ${expense.description}: $${expense.amount}`)
        created++
      } else {
        const error = await response.text()
        console.log(`  ❌ Failed to create ${expense.description}: ${error}`)
        failed++
      }
    } catch (error) {
      console.log(`  ❌ Error creating ${expense.description}:`, error)
      failed++
    }
  }
  
  console.log(`\n🏦 BANK STATEMENT EXPENSES SUMMARY:`)
  console.log(`   Created: ${created} expenses`)
  console.log(`   Failed: ${failed} expenses`)
  console.log(`   Total: ${BANK_STATEMENT_EXPENSES.length} expenses`)
  console.log(`   Total Amount: $${BANK_STATEMENT_EXPENSES.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}`)
  
  return true
}